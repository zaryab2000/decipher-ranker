import { db } from "@/lib/db";
import { merchants, resources, categories } from "@/lib/db/schema";
import { sql } from "drizzle-orm";
import type { BazaarResource } from "@/lib/types";
import {
  extractPayeeAddress,
  extractPriceUsd,
  extractChain,
  hasInputSchema,
  hasSchemaExample,
} from "./bazaar";

interface SyncResult {
  merchantsUpserted: number;
  resourcesUpserted: number;
  categoriesUpdated: number;
}

/** Neon HTTP has a per-statement size limit; keep multi-row inserts bounded. */
const INSERT_CHUNK_SIZE = 500;

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

/**
 * Strip NUL bytes (0x00), which Postgres text columns reject, from free-text
 * Bazaar fields. Returns null for empty/absent input.
 */
function sanitizeText(value: string | null | undefined): string | null {
  if (value == null) return null;
  const cleaned = value.replace(/\u0000/g, "");
  return cleaned.length > 0 ? cleaned : null;
}

export async function upsertCatalog(
  bazaarResources: BazaarResource[],
): Promise<SyncResult> {
  const merchantMap = new Map<string, BazaarResource[]>();
  const tagSet = new Set<string>();

  for (const resource of bazaarResources) {
    const payee = extractPayeeAddress(resource);
    if (!payee) continue;

    if (!merchantMap.has(payee)) {
      merchantMap.set(payee, []);
    }
    merchantMap.get(payee)!.push(resource);

    for (const tag of resource.tags ?? []) {
      tagSet.add(tag);
    }
  }

  const categoriesUpdated = await upsertCategories([...tagSet]);
  const merchantsUpserted = await upsertMerchants(merchantMap);
  const resourcesUpserted = await upsertResources(bazaarResources);

  // Update category merchant counts (set-based, single statement)
  await db.execute(sql`
    UPDATE categories c
    SET merchant_count = (
      SELECT COUNT(DISTINCT m.id)
      FROM merchants m
      JOIN resources r ON r.merchant_id = m.id
      WHERE c.name = ANY(r.tags)
    )
  `);

  return { merchantsUpserted, resourcesUpserted, categoriesUpdated };
}

async function upsertCategories(tags: string[]): Promise<number> {
  if (tags.length === 0) return 0;

  let inserted = 0;
  for (const batch of chunk(tags, INSERT_CHUNK_SIZE)) {
    const rows = await db
      .insert(categories)
      .values(batch.map((name) => ({ name: sanitizeText(name) ?? name })))
      .onConflictDoNothing({ target: categories.name })
      .returning({ id: categories.id });
    inserted += rows.length;
  }
  return inserted;
}

async function upsertMerchants(
  merchantMap: Map<string, BazaarResource[]>,
): Promise<number> {
  const rows = [...merchantMap.entries()].map(([payee, payeeResources]) => ({
    payeeAddress: payee,
    chain: extractChain(payeeResources[0]),
    facilitator: null,
    txCount30d: payeeResources.reduce(
      (sum, r) => sum + (r.quality?.l30DaysTotalCalls ?? 0),
      0,
    ),
    buyers30d: payeeResources.reduce(
      (sum, r) => sum + (r.quality?.l30DaysUniquePayers ?? 0),
      0,
    ),
    // Bazaar reports call counts but not USD volume. Estimate it as
    // Σ(calls × price) across the merchant's resources — the ranker's volume
    // signal weights dollar throughput equally with raw call count.
    volume30d: payeeResources
      .reduce((sum, r) => {
        const calls = r.quality?.l30DaysTotalCalls ?? 0;
        const price = extractPriceUsd(r) ?? 0;
        return sum + calls * price;
      }, 0)
      .toString(),
    lastUpdated: new Date(),
  }));

  let upserted = 0;
  for (const batch of chunk(rows, INSERT_CHUNK_SIZE)) {
    await db
      .insert(merchants)
      .values(batch)
      .onConflictDoUpdate({
        target: merchants.payeeAddress,
        set: {
          chain: sql`excluded.chain`,
          txCount30d: sql`excluded.tx_count_30d`,
          buyers30d: sql`excluded.buyers_30d`,
          volume30d: sql`excluded.volume_30d`,
          lastUpdated: sql`excluded.last_updated`,
        },
      });
    upserted += batch.length;
  }
  return upserted;
}

async function upsertResources(
  bazaarResources: BazaarResource[],
): Promise<number> {
  // Resolve every payee → merchant id in one query instead of one per resource.
  const merchantIdByPayee = new Map<string, string>();
  const merchantRows = await db
    .select({ id: merchants.id, payeeAddress: merchants.payeeAddress })
    .from(merchants);
  for (const m of merchantRows) {
    merchantIdByPayee.set(m.payeeAddress, m.id);
  }

  // Deduplicate by resourceUrl — a batch insert cannot contain two rows that
  // conflict on the same unique key within a single statement.
  const rowByUrl = new Map<string, typeof resources.$inferInsert>();
  for (const resource of bazaarResources) {
    const payee = extractPayeeAddress(resource);
    if (!payee) continue;

    const merchantId = merchantIdByPayee.get(payee);
    if (!merchantId) continue;

    const priceUsd = extractPriceUsd(resource);
    const chain = extractChain(resource);

    rowByUrl.set(resource.resource, {
      resourceUrl: resource.resource,
      merchantId,
      serviceName: sanitizeText(resource.serviceName),
      description: sanitizeText(resource.description),
      tags: resource.tags
        ?.map((t) => sanitizeText(t))
        .filter((t): t is string => t !== null),
      hasInputSchema: hasInputSchema(resource),
      hasOutputExample: hasSchemaExample(resource),
      priceUsd: priceUsd?.toString(),
      chain,
      l30dCalls: resource.quality?.l30DaysTotalCalls,
      l30dUniquePayers: resource.quality?.l30DaysUniquePayers,
      lastCalledAt: resource.quality?.lastCalledAt
        ? new Date(resource.quality.lastCalledAt)
        : null,
      lastUpdated: new Date(),
    });
  }

  const rows = [...rowByUrl.values()];
  let upserted = 0;
  for (const batch of chunk(rows, INSERT_CHUNK_SIZE)) {
    await db
      .insert(resources)
      .values(batch)
      .onConflictDoUpdate({
        target: resources.resourceUrl,
        set: {
          serviceName: sql`excluded.service_name`,
          description: sql`excluded.description`,
          tags: sql`excluded.tags`,
          hasInputSchema: sql`excluded.has_input_schema`,
          hasOutputExample: sql`excluded.has_output_example`,
          priceUsd: sql`excluded.price_usd`,
          l30dCalls: sql`excluded.l30d_calls`,
          l30dUniquePayers: sql`excluded.l30d_unique_payers`,
          lastCalledAt: sql`excluded.last_called_at`,
          lastUpdated: sql`excluded.last_updated`,
        },
      });
    upserted += batch.length;
  }
  return upserted;
}
