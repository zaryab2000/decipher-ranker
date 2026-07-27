/**
 * Weight rationale + tip-to-component validation for the ranker.
 *
 * The ranker's weight structure (volume 40%, buyerDiversity 25%,
 * reliability 5%, listingQuality 15%, recency 15%) is the transparent
 * scoring layer. This module surfaces the *human-readable reasons* for
 * each weight — explaining to merchants WHY volume dominates and WHAT
 * moves each component.
 */

// Type-only import (erased at runtime) so this module does not create a load-
// time cycle with ranker.ts. The literal `weight` values below MUST match
// RANKER_WEIGHTS — a test asserts they stay in sync.
import type { RANKER_WEIGHTS } from "@/lib/analytics/ranker";

export interface WeightRationaleEntry {
  weight: number;
  reason: string;
  whatMovesIt: string;
  merchantCanControl: boolean;
}

export type WeightRationale = Record<
  keyof typeof RANKER_WEIGHTS,
  WeightRationaleEntry
>;

export const WEIGHT_RATIONALE: WeightRationale = {
  volume: {
    weight: 0.4,
    reason:
      "30-day transaction count and USD volume through CDP Facilitator. Measures actual agent usage — every settled payment increases this signal, and the facilitator recomputes it every 6 hours.",
    whatMovesIt:
      "Each settled x402 payment on the CDP Facilitator increments l30DaysTotalCalls. USD volume = Σ(calls × price). Log-normalized so the 100th merchant and the 1st merchant are not 100x apart.",
    merchantCanControl: false,
  },
  buyerDiversity: {
    weight: 0.25,
    reason:
      "Unique buyer wallets in 30 days (l30DaysUniquePayers from Bazaar). Measures market reach — 10 distinct buyers beats 100 calls from one wallet. Log-normalized with cap 10,000.",
    whatMovesIt:
      "Each new distinct wallet that pays the merchant increments buyers30d. Wash-trading (one wallet paying many times) does not move this signal.",
    merchantCanControl: false,
  },
  reliability: {
    weight: 0.05,
    reason:
      "Service health — currently a PLACEHOLDER (returns 0.5 for every merchant). No external API exposes network-wide uptime today. The slot stays wired so a real reliability source (CDP curation probing or ERC-8004 reputation) can be a one-line weight change later.",
    whatMovesIt:
      "Nothing today — the value is constant 0.5 for every merchant. When a reliability source is wired in, this will contribute actual differentiation.",
    merchantCanControl: false,
  },
  listingQuality: {
    weight: 0.15,
    reason:
      "Metadata completeness and quality — input schemas, output examples, description quality (length + keyword density + structural specificity), service name specificity, tag relevance, icon presence. The only component a merchant can directly control on day 1.",
    whatMovesIt:
      "Publishing Bazaar extensions with input/output schemas, writing specific descriptions with API vocabulary, choosing precise tags from your category's vocabulary, setting a specific service name, adding an icon URL.",
    merchantCanControl: true,
  },
  recency: {
    weight: 0.15,
    reason:
      "How recently the service was called — decayed over 30 days. CDP Bazaar hard-excludes merchants with no activity in 30 days (the cold-start grace window exempts merchants with zero calls).",
    whatMovesIt:
      "Any settled payment moves lastCalledAt. Recency is the decay of days since last call: <1d=1.0, <7d=0.8, <30d=0.5, <90d=0.2. After 30 days of inactivity CDP removes the merchant from search entirely.",
    merchantCanControl: false,
  },
};

export interface TipComponentMapping {
  tip: string;
  component: keyof typeof RANKER_WEIGHTS | "indirect" | "diagnostic";
  direct: boolean;
  impactNote: string;
}

/** Map a tip message to the score component it (directly or indirectly) moves. */
export function classifyTip(tip: string): TipComponentMapping {
  const lower = tip.toLowerCase();

  // Direct mapping — tip moves a score component
  if (lower.includes("schema") || lower.includes("output example")) {
    return {
      tip,
      component: "listingQuality",
      direct: true,
      impactNote:
        "Direct: +1.0 each for input schema and output example in listing-quality raw score, weighted at 0.15. Normalized by LISTING_QUALITY_MAX.",
    };
  }
  if (lower.includes("description")) {
    return {
      tip,
      component: "listingQuality",
      direct: true,
      impactNote:
        "Direct: description contributes up to +0.8 to listing-quality raw score, gated by quality score (density + keywords + specificity).",
    };
  }
  if (lower.includes("tag")) {
    return {
      tip,
      component: "listingQuality",
      direct: true,
      impactNote:
        "Direct: tags contribute up to +0.3 to listing-quality raw score, gated by relevance and specificity.",
    };
  }
  if (lower.includes("service name")) {
    return {
      tip,
      component: "listingQuality",
      direct: true,
      impactNote:
        "Direct: service name contributes up to +0.5 to listing-quality raw score, gated by name specificity.",
    };
  }
  if (lower.includes("transaction volume") || lower.includes("increase")) {
    return {
      tip,
      component: "volume",
      direct: true,
      impactNote:
        "Direct (but not directly actionable): volume is 40% of score. Each settled payment increments l30DaysTotalCalls. The merchant cannot press a button to increase it — they must drive real agent usage.",
    };
  }
  if (lower.includes("buyer") || lower.includes("diversify")) {
    return {
      tip,
      component: "buyerDiversity",
      direct: true,
      impactNote:
        "Direct (but not directly actionable): buyer diversity is 25% of score. Each new distinct paying wallet increments buyers30d. 10 distinct buyers beats 100 calls from one wallet.",
    };
  }

  // Indirect mapping — tip affects something that affects a score component
  if (lower.includes("price") || lower.includes("pricing")) {
    return {
      tip,
      component: "indirect",
      direct: false,
      impactNote:
        "Indirect: price is not a score component. But a competitive price lowers agent adoption friction, which drives volume — the dominant ranking factor. Each settled payment at any price increments the same signal.",
    };
  }
  if (lower.includes("endpoint") || lower.includes("resource") || lower.includes("more endpoint") || lower.includes("more resource")) {
    return {
      tip,
      component: "indirect",
      direct: false,
      impactNote:
        "Indirect: registering more endpoints does not directly increase score. But each endpoint is an independent retrieval surface in x402scan, and AgentCash's originUsage aggregates across endpoints on the same origin.",
    };
  }
  if (lower.includes("rank") || lower.includes("position")) {
    return {
      tip,
      component: "diagnostic",
      direct: false,
      impactNote:
        "Diagnostic: rank is an output, not an input. To move rank, increase volume + buyer diversity (combined: ~90% of the rank gap per Pass 3 thesis math).",
    };
  }

  // Default: unclassified tip
  return {
    tip,
    component: "diagnostic",
    direct: false,
    impactNote: "Diagnostic — this tip does not map to a specific score component.",
  };
}

/** Build the weighted-average rationale list for the report payload. */
export function buildWeightRationale(): WeightRationale {
  return WEIGHT_RATIONALE;
}
