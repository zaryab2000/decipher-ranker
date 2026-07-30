import { describe, it, expect } from "vitest";
import { SCORE_COMPONENTS } from "@/dashboard/lib/constants";
import { RANKER_WEIGHTS } from "@/lib/analytics/ranker";

/**
 * The dashboard displays the score formula to merchants. If SCORE_COMPONENTS
 * drifts from RANKER_WEIGHTS, the product shows a formula it does not use —
 * which is exactly what happened before this test existed (volume was displayed
 * as 0.30 against an actual 0.40, reliability as 0.15 against an actual 0.05).
 */
describe("SCORE_COMPONENTS", () => {
  // Maps the dashboard's display keys onto the ranker's weight keys.
  const KEY_TO_WEIGHT: Record<string, keyof typeof RANKER_WEIGHTS> = {
    volumeSignal: "volume",
    buyerDiversity: "buyerDiversity",
    listingQuality: "listingQuality",
    recency: "recency",
    reliability: "reliability",
  };

  it("weights sum to 1.0", () => {
    const total = SCORE_COMPONENTS.reduce((sum, c) => sum + c.weight, 0);
    expect(total).toBeCloseTo(1.0, 10);
  });

  it("every component matches the corresponding RANKER_WEIGHTS entry", () => {
    for (const component of SCORE_COMPONENTS) {
      const weightKey = KEY_TO_WEIGHT[component.key];
      expect(weightKey, `no RANKER_WEIGHTS mapping for "${component.key}"`).toBeDefined();
      expect(component.weight, `weight drift on "${component.key}"`).toBe(
        RANKER_WEIGHTS[weightKey!],
      );
    }
  });

  it("covers every RANKER_WEIGHTS key exactly once", () => {
    const displayed = SCORE_COMPONENTS.map((c) => KEY_TO_WEIGHT[c.key]).sort();
    const actual = Object.keys(RANKER_WEIGHTS).sort();
    expect(displayed).toEqual(actual);
  });

  it("is ordered by descending weight so the biggest lever reads first", () => {
    const weights = SCORE_COMPONENTS.map((c) => c.weight);
    const sorted = [...weights].sort((a, b) => b - a);
    expect(weights).toEqual(sorted);
  });
});
