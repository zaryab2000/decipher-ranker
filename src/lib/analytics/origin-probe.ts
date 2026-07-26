/**
 * Report-time discovery-layer membership probe. Checks whether a merchant's
 * resource URL is discoverable on CDP Bazaar (always true — we ingest from it),
 * x402scan (public website probe), and AgentCash (openapi.json probe).
 *
 * All probes are best-effort: a timeout or error returns { indexed: false }
 * with an explanatory note, never throwing. The report always succeeds.
 */

import type { DiscoveryLayerStatus } from "@/lib/types";
import { cached } from "@/lib/cache";

const PROBE_TIMEOUT_MS = 5000;
// Membership rarely changes hour-to-hour; caching keeps the report off the hot
// path of downloading x402scan's ~1.5MB page + hitting the merchant's server.
const PROBE_CACHE_TTL_SECONDS = 3600;

const CDP_BAZAAR_NOTE =
  "Indexed via CDP Facilitator settlement — all merchants in our catalog are on CDP Bazaar";

/**
 * KV-cached wrapper around {@link checkDiscoveryLayers}. Keyed by the merchant's
 * origin (so all of a merchant's resources share one entry) with a 1-hour TTL.
 * Fail-open: a KV miss/outage transparently runs the live probe (see `cached`).
 */
export async function checkDiscoveryLayersCached(
  primaryResourceUrl: string,
): Promise<DiscoveryLayerStatus> {
  let cacheKey: string;
  try {
    cacheKey = `discovery:${new URL(primaryResourceUrl).origin}`;
  } catch {
    // Unparseable URL — don't cache under a garbage key; probe directly.
    return checkDiscoveryLayers(primaryResourceUrl);
  }
  return cached(cacheKey, PROBE_CACHE_TTL_SECONDS, () =>
    checkDiscoveryLayers(primaryResourceUrl),
  );
}

export async function checkDiscoveryLayers(
  primaryResourceUrl: string,
): Promise<DiscoveryLayerStatus> {
  let origin: string;
  try {
    origin = new URL(primaryResourceUrl).origin;
  } catch {
    return {
      cdpBazaar: { indexed: true, note: CDP_BAZAAR_NOTE },
      x402scan: { indexed: false, note: "Invalid resource URL — cannot probe" },
      agentCash: { indexed: false, note: "Invalid resource URL — cannot probe" },
      layerAlignmentScore: 1,
    };
  }

  const [x402scan, agentCash] = await Promise.all([
    checkX402Scan(primaryResourceUrl),
    checkAgentCash(origin),
  ]);

  // CDP is always indexed (we ingest from it); add x402scan + agentCash.
  let score = 1;
  if (x402scan.indexed) score++;
  if (agentCash.indexed) score++;

  return {
    cdpBazaar: { indexed: true, note: CDP_BAZAAR_NOTE },
    x402scan,
    agentCash,
    layerAlignmentScore: score,
  };
}

async function checkX402Scan(
  resourceUrl: string,
): Promise<{ indexed: boolean; note: string }> {
  // Pattern E (verified 2026-07-26): x402scan's /resources page is server-
  // rendered HTML that lists merchant resource URLs, so we fetch it and search
  // for this merchant's hostname / URL in the markup.
  try {
    let hostname: string;
    try {
      hostname = new URL(resourceUrl).hostname;
    } catch {
      return { indexed: false, note: "Cannot parse resource URL" };
    }

    const res = await fetch(`https://www.x402scan.com/resources`, {
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
      headers: { accept: "text/html" },
    });
    if (!res.ok) {
      return {
        indexed: false,
        note: "x402scan page unreachable — verify your listing at x402scan.com/resources",
      };
    }
    const html = await res.text();
    const indexed = html.includes(hostname) || html.includes(resourceUrl);

    return {
      indexed,
      note: indexed
        ? "Found on x402scan"
        : "Not found on x402scan — register at x402scan.com/resources/register",
    };
  } catch {
    return {
      indexed: false,
      note: "x402scan probe failed — verify your listing at x402scan.com/resources",
    };
  }
}

async function checkAgentCash(
  origin: string,
): Promise<{ indexed: boolean; note: string }> {
  try {
    const res = await fetch(`${origin}/openapi.json`, {
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
      headers: { accept: "application/json" },
    });
    if (!res.ok) {
      return {
        indexed: false,
        note: "No /openapi.json found — AgentCash cannot index you. Publish an OpenAPI 3.1 document with x-payment-info annotations.",
      };
    }

    const doc = (await res.json()) as {
      paths?: Record<string, Record<string, { "x-payment-info"?: unknown }>>;
    };

    const hasPaymentInfo = Object.values(doc.paths ?? {}).some((pathObj) =>
      Object.values(pathObj ?? {}).some((op) => op?.["x-payment-info"] != null),
    );

    return {
      indexed: hasPaymentInfo,
      note: hasPaymentInfo
        ? "Valid /openapi.json with x-payment-info — AgentCash can index you"
        : "/openapi.json exists but no x-payment-info on any operation — AgentCash embedding pipeline will fail",
    };
  } catch {
    return {
      indexed: false,
      note: "No /openapi.json found — AgentCash cannot index you",
    };
  }
}
