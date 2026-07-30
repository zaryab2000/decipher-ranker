import { z } from "zod";
import { router } from "@/lib/router";
import {
  getMerchantByOrigin,
  computeDescriptionQuality,
  computeListingCompleteness,
  generateTips,
} from "@/lib/analytics/ranker";
import { scoreToGrade } from "@/lib/analytics/grade";
import { withRateLimit } from "@/lib/rate-limit";

const PreviewQuerySchema = z.object({
  origin: z
    .string()
    .min(3)
    .max(500)
    .describe("Domain or URL of the x402 merchant to look up"),
});

const PreviewResponseSchema = z.object({
  found: z.boolean(),
  origin: z.string(),
  message: z.string().optional(),
  merchant: z
    .object({
      name: z.string().nullable(),
      category: z.string().nullable(),
      score: z.number(),
      grade: z.string(),
      rank: z.number().nullable(),
      total_in_category: z.number(),
      resource_count: z.number(),
      chain: z.string(),
    })
    .optional(),
  teaser: z
    .object({
      has_tips: z.boolean(),
      tip_count: z.number(),
      available_reports: z.array(z.string()),
    })
    .optional(),
  links: z.record(z.string(), z.string()),
});

function extractHost(input: string): string | null {
  try {
    return new URL(input.startsWith("http") ? input : `https://${input}`).host.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Candidate brand labels of a host, most-specific first:
 * "arbipulse.theaslangroupllc.com" -> ["arbipulse", "theaslangroupllc"].
 * The subdomain often carries the product name; the registrable label carries
 * the company name. Either can match a service name.
 */
function domainLabels(host: string): string[] {
  const parts = host.split(".").filter(Boolean);
  if (parts.length <= 1) return [host];
  const labels: string[] = [];
  if (parts.length >= 3) labels.push(parts[0]!);
  labels.push(parts[parts.length - 2]!);
  return [...new Set(labels)];
}

/** Lowercase alphanumeric tokens of a string, e.g. "Heurist Mesh" -> ["heurist","mesh"]. */
function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

/**
 * Pick the merchant's display name from its resources' service names.
 *
 * A single merchant (one origin/host) can expose many resources, and an
 * aggregator's resources are named after the sub-services it proxies
 * (e.g. mesh.heurist.xyz lists both "Firecrawl" and "Heurist Mesh"). Picking
 * the first service name misidentifies the merchant. Prefer the service name
 * whose tokens match the origin's brand label; fall back to the title-cased
 * label, then any service name.
 */
function resolveMerchantName(
  serviceNames: readonly (string | null)[],
  originHost: string | null,
): string | null {
  const names = serviceNames.filter((n): n is string => Boolean(n && n.trim()));
  const labels = originHost ? domainLabels(originHost) : [];

  if (names.length === 0) {
    const label = labels[0];
    return label ? label.charAt(0).toUpperCase() + label.slice(1) : null;
  }

  for (const label of labels) {
    const exact = names.find((n) => tokenize(n).includes(label));
    if (exact) return exact;
  }

  for (const label of labels) {
    const partial = names.find((n) =>
      tokenize(n).some((t) => t.includes(label) || label.includes(t)),
    );
    if (partial) return partial;
  }

  // No service name references the brand — derive one from the most specific
  // label so the card shows the merchant's identity, not an unrelated
  // sub-service.
  const label = labels[0];
  if (label) return label.charAt(0).toUpperCase() + label.slice(1);

  return names[0] ?? null;
}

const handler = router
  .route({ path: "preview", method: "GET" })
  .unprotected()
  .query(PreviewQuerySchema)
  .output(PreviewResponseSchema)
  .description(
    "Quick merchant lookup for the homepage instant-win feature. Returns rank, score, grade, and category — enough to show value, with upsell links to the full report endpoints.",
  )
  .inputExample({ origin: "https://bitrefill.com" })
  .outputExample({
    found: true,
    origin: "https://bitrefill.com",
    merchant: {
      name: "Bitrefill",
      category: "Crypto & DeFi",
      score: 76,
      grade: "B+",
      rank: 3,
      total_in_category: 151,
      resource_count: 12,
      chain: "base",
    },
    teaser: {
      has_tips: true,
      tip_count: 3,
      available_reports: ["origin", "competitive", "merchant"],
    },
    links: {
      full_report: "/api/report/origin",
      competitive: "/api/report/competitive",
      dashboard: "/dashboard/merchant/https%3A%2F%2Fbitrefill.com",
    },
  })
  .handler(async ({ query }) => {
    const data = await getMerchantByOrigin(query.origin);

    if (!data) {
      return {
        found: false,
        origin: query.origin,
        message:
          "This service is not yet indexed in the x402 ecosystem. It may take up to 24 hours after registration on Coinbase Bazaar to appear.",
        links: {
          register: "https://bazaar.coinbase.com",
          learn_more: "/about",
        },
      };
    }

    const { merchant, resources: merchantResources, category } = data;

    // Same conversion as the dashboard's toDisplayScore(), deliberately inlined:
    // importing @/dashboard/lib/formatters here would be the only API-layer
    // dependency on the dashboard layer. If a third consumer appears, promote
    // this to src/lib/ rather than crossing that boundary.
    const score = Math.round(Number(merchant.rankerScore ?? 0) * 100);

    const descriptionQuality = computeDescriptionQuality(merchantResources, category);
    const listingCompleteness = computeListingCompleteness(merchantResources);
    const tips = generateTips(data, descriptionQuality, listingCompleteness);

    const originHost = extractHost(query.origin);
    const firstName = resolveMerchantName(
      merchantResources.map((r) => r.serviceName),
      originHost,
    );

    const dashboardOrigin = merchantResources[0]?.resourceUrl ?? query.origin;

    return {
      found: true,
      origin: query.origin,
      merchant: {
        name: firstName,
        category: category?.name ?? null,
        score,
        grade: scoreToGrade(score),
        rank: merchant.rankPosition,
        total_in_category: category?.merchantCount ?? 0,
        resource_count: merchantResources.length,
        chain: merchant.chain,
      },
      teaser: {
        has_tips: tips.length > 0,
        tip_count: tips.length,
        available_reports: ["origin", "competitive", "merchant"],
      },
      links: {
        full_report: "/api/report/origin",
        competitive: "/api/report/competitive",
        dashboard: `/dashboard/merchant/${encodeURIComponent(dashboardOrigin)}`,
      },
    };
  });

export const GET = withRateLimit(handler, { limit: 20 });
