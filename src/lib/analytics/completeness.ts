/**
 * Completeness grade + action coverage map for merchant reports.
 *
 * `completenessGrade` converts the 0-100 numeric `listingCompleteness`
 * score (from `computeListingCompleteness` in ranker.ts) into a letter
 * grade (A-F) for at-a-glance comprehension.
 *
 * `computeActionCoverage` produces a prioritized list of action items
 * the merchant should take to improve their rank, with each action
 * tagged as high/medium/low priority and an estimated score impact.
 * This is the merchant's "improvement roadmap."
 */

import type { MerchantData } from "@/lib/analytics/ranker";
import type { Resource } from "@/lib/types";
import { computeServiceNameQuality } from "@/lib/analytics/service-name-quality";
import { computeDescriptionQualityScore } from "@/lib/analytics/description-quality";
import { computeTagQualityScore } from "@/lib/analytics/tag-quality";

const GRADE_A = 85;
const GRADE_B = 70;
const GRADE_C = 55;
const GRADE_D = 40;

export function completenessGrade(score: number): "A" | "B" | "C" | "D" | "F" {
  if (score >= GRADE_A) return "A";
  if (score >= GRADE_B) return "B";
  if (score >= GRADE_C) return "C";
  if (score >= GRADE_D) return "D";
  return "F";
}

export type ActionPriority = "high" | "medium" | "low";

export interface ActionItem {
  action: string;
  priority: ActionPriority;
  component:
    | "volume"
    | "buyerDiversity"
    | "reliability"
    | "listingQuality"
    | "recency"
    | "discoveryLayers"
    | "none";
  issue: string;
  expectedImpact: string;
}

/** Count distinct chains a merchant accepts payments on. */
export function countMerchantChains(resources: Resource[]): number {
  const chains = new Set<string>();
  for (const r of resources) {
    if (r.chain) chains.add(r.chain);
  }
  return chains.size;
}

/**
 * Build a prioritized action coverage map for the merchant's report.
 * Each entry is one concrete action the merchant can take, with:
 *  - priority: high/medium/low (drives UI emphasis)
 *  - component: which ranker component it affects
 *  - issue: human-readable description of what's wrong
 *  - expectedImpact: rough estimate of score delta if fixed
 *
 * The function only surfaces actions the existing fields support, so it stays
 * forward-compatible as more signals ship.
 */
export function computeActionCoverage(data: MerchantData): ActionItem[] {
  const actions: ActionItem[] = [];
  const { merchant, resources: merchantResources, category } = data;

  // 1. Input schema — high priority if missing (structural signal)
  const missingInputSchema = merchantResources.some((r) => !r.hasInputSchema);
  if (missingInputSchema) {
    actions.push({
      action: "Publish input schemas for every endpoint",
      priority: "high",
      component: "listingQuality",
      issue: "Missing Bazaar input schema — agents cannot pre-validate request shape",
      expectedImpact: "+0.04 score (input schema: +1.0 / LISTING_QUALITY_MAX × weight 0.15)",
    });
  }

  // 2. Output example — high priority if missing
  const missingOutput = merchantResources.some((r) => !r.hasOutputExample);
  if (missingOutput) {
    actions.push({
      action: "Publish output examples for every endpoint",
      priority: "high",
      component: "listingQuality",
      issue: "Missing Bazaar output example — agents cannot pre-validate response shape",
      expectedImpact: "+0.04 score (output example: +1.0 / LISTING_QUALITY_MAX × weight 0.15)",
    });
  }

  // 3. Description quality (action 06/07) — check across ALL resources since the
  // ranker averages description quality over all of them.
  const anyHasDescription = merchantResources.some((r) => r.description);
  if (anyHasDescription) {
    const worstDesc = merchantResources
      .filter((r) => r.description)
      .map((r) => computeDescriptionQualityScore(r.description!, category))
      .sort((a, b) => a.score - b.score)[0];
    if (worstDesc && worstDesc.score < 0.5) {
      actions.push({
        action:
          worstDesc.buzzwords.length > 0
            ? `Remove marketing buzzwords (${worstDesc.buzzwords.slice(0, 3).join(", ")}) and rewrite with API-specific terms`
            : "Improve description quality — add category keywords and structural terms",
        priority: "high",
        component: "listingQuality",
        issue: worstDesc.verdict,
        expectedImpact: "+0.03 score (description: up to +0.8 raw × quality multiplier)",
      });
    }
    const missingDesc = merchantResources.filter((r) => !r.description);
    if (missingDesc.length > 0) {
      actions.push({
        action: `Add descriptions to ${missingDesc.length} endpoint${missingDesc.length > 1 ? "s" : ""} missing them (aim for 150+ characters with specific API terms)`,
        priority: "high",
        component: "listingQuality",
        issue: `${missingDesc.length} of ${merchantResources.length} resource(s) have no description — dragging down the average`,
        expectedImpact: "+0.03 score (description tier: 0 → +0.8 raw)",
      });
    }
  } else if (merchantResources.length > 0) {
    actions.push({
      action: "Add a description to every endpoint (aim for 150+ characters with specific API terms)",
      priority: "high",
      component: "listingQuality",
      issue: "No description on any resource — cross-encoders have no text to score",
      expectedImpact: "+0.03 score (description tier: 0 → +0.8 raw)",
    });
  }

  // 4. Service name quality — check across ALL resources
  const worstNameResource = merchantResources
    .map((r) => ({ r, q: computeServiceNameQuality(r.serviceName) }))
    .sort((a, b) => a.q - b.q)[0];
  if (worstNameResource && worstNameResource.q < 0.5) {
    actions.push({
      action: `Rename "${worstNameResource.r.serviceName ?? "(none)"}" to a more specific service name (e.g., "Weather Forecast API" not "API")`,
      priority: "medium",
      component: "listingQuality",
      issue: "Service name is generic or absent — no semantic signal for cross-encoders",
      expectedImpact: "+0.02 score (serviceName: +0.5 × quality multiplier)",
    });
  }

  // 5. Tag quality (action 11) — check across ALL resources
  const worstTagResource = merchantResources
    .map((r) => ({ r, q: computeTagQualityScore(r.tags ?? [], category) }))
    .sort((a, b) => a.q.score - b.q.score)[0];
  if (worstTagResource && (worstTagResource.q.count === 0 || worstTagResource.q.score < 0.4)) {
    const suggested = worstTagResource.q.suggestedTags.length > 0
      ? ` (try: ${worstTagResource.q.suggestedTags.join(", ")})`
      : "";
    actions.push({
      action: `Add 3-5 tags from your category's vocabulary${suggested}`,
      priority: "medium",
      component: "listingQuality",
      issue: worstTagResource.q.issues[0] ?? "Tags are missing or low-quality",
      expectedImpact: "+0.01 score (tags: +0.3 / LISTING_QUALITY_MAX × weight 0.15)",
    });
  }

  // 6. Icon presence
  const hasIcon = merchantResources.some((r) => r.iconUrl);
  if (!hasIcon) {
    actions.push({
      action: "Add an icon URL in your Bazaar metadata (iconUrl field)",
      priority: "low",
      component: "listingQuality",
      issue: "No icon — metadata completeness gap",
      expectedImpact: "+0.006 score (icon: +0.15 / LISTING_QUALITY_MAX × weight 0.15)",
    });
  }

  // 7. Volume (not directly fixable but surfaced)
  if ((merchant.txCount30d ?? 0) < 10) {
    actions.push({
      action: "Drive initial transaction volume — promote your service to potential buyers via direct API links, agent communities, x402scan registration",
      priority: "high",
      component: "volume",
      issue: `Only ${merchant.txCount30d ?? 0} 30-day transactions — volume is the dominant ranking signal (40% weight)`,
      expectedImpact: "Up to +0.2 score (volume signal: logNorm(10 → 50 → 200 calls) × weight 0.40)",
    });
  }

  // 8. Buyer diversity
  if ((merchant.buyers30d ?? 0) < 3) {
    actions.push({
      action: "Diversify your buyer base — target different agent wallet populations",
      priority: "medium",
      component: "buyerDiversity",
      issue: `Only ${merchant.buyers30d ?? 0} 30-day unique buyers — diversity is 25% of your score`,
      expectedImpact: "+0.1 score (buyerDiversity: logNorm(3 → 10) × weight 0.25)",
    });
  }

  // 9. Multi-chain coverage
  const chainCount = countMerchantChains(merchantResources);
  if (chainCount === 1) {
    actions.push({
      action: "Publish accepts entries on more chains — each chain is a distinct agent wallet population that can pay you without bridging",
      priority: "low",
      component: "none",
      issue: "Only one chain accepted — limits your buyer pool to agents with that chain's USDC",
      expectedImpact: "Indirect — grows buyer diversity and transaction volume over time",
    });
  }

  // 10. Multi-endpoint origin
  if (merchantResources.length >= 1 && merchantResources.length < 3) {
    actions.push({
      action: "Register more API endpoints — AgentCash's originUsage aggregates across endpoints and each is an independent retrieval surface",
      priority: "low",
      component: "none",
      issue: `Only ${merchantResources.length} endpoint(s) — low service coverage`,
      expectedImpact: "Indirect — grows originUsage and tag exposure across more retrieval surfaces",
    });
  }

  // 11. No endpoints at all — unreachable in practice but handle defensively
  if (merchantResources.length < 1) {
    actions.push({
      action: "Publish at least one API endpoint and register it with the Bazaar extension",
      priority: "high",
      component: "none",
      issue: "No indexed endpoints — invisible to all discovery systems",
      expectedImpact: "N/A — foundational",
    });
  }

  return actions;
}
