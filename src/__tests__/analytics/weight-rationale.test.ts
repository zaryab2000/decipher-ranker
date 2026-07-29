import { describe, it, expect } from "vitest";
import {
  WEIGHT_RATIONALE,
  classifyTip,
  buildWeightRationale,
} from "@/lib/analytics/weight-rationale";
import { RANKER_WEIGHTS } from "@/lib/analytics/ranker";

describe("WEIGHT_RATIONALE", () => {
  it("has an entry for each component", () => {
    expect(WEIGHT_RATIONALE.volume).toBeDefined();
    expect(WEIGHT_RATIONALE.buyerDiversity).toBeDefined();
    expect(WEIGHT_RATIONALE.reliability).toBeDefined();
    expect(WEIGHT_RATIONALE.listingQuality).toBeDefined();
    expect(WEIGHT_RATIONALE.recency).toBeDefined();
  });

  it("weights sum to 1.0", () => {
    const sum = Object.values(WEIGHT_RATIONALE).reduce((s, e) => s + e.weight, 0);
    expect(Math.abs(sum - 1.0)).toBeLessThan(0.0001);
  });

  it("keeps its literal weights in sync with RANKER_WEIGHTS", () => {
    // The literals are hardcoded to avoid a load-time import cycle; this guards
    // against drift from the source of truth.
    for (const key of Object.keys(RANKER_WEIGHTS) as Array<keyof typeof RANKER_WEIGHTS>) {
      expect(WEIGHT_RATIONALE[key].weight).toBe(RANKER_WEIGHTS[key]);
    }
  });

  it("marks only listingQuality as merchant-controllable", () => {
    expect(WEIGHT_RATIONALE.listingQuality.merchantCanControl).toBe(true);
    expect(WEIGHT_RATIONALE.volume.merchantCanControl).toBe(false);
    expect(WEIGHT_RATIONALE.buyerDiversity.merchantCanControl).toBe(false);
    expect(WEIGHT_RATIONALE.reliability.merchantCanControl).toBe(false);
    expect(WEIGHT_RATIONALE.recency.merchantCanControl).toBe(false);
  });
});

describe("classifyTip", () => {
  it("maps schema tips to listingQuality (direct)", () => {
    const result = classifyTip("Publish input schemas and output examples");
    expect(result.component).toBe("listingQuality");
    expect(result.direct).toBe(true);
  });

  it("maps description tips to listingQuality (direct)", () => {
    const result = classifyTip("Improve your service descriptions");
    expect(result.component).toBe("listingQuality");
    expect(result.direct).toBe(true);
  });

  it("maps tag tips to listingQuality (direct)", () => {
    const result = classifyTip("Add relevant tags to your resources");
    expect(result.component).toBe("listingQuality");
    expect(result.direct).toBe(true);
  });

  it("maps volume tips to volume (direct, but not actionable)", () => {
    const result = classifyTip("Increase transaction volume by promoting your service");
    expect(result.component).toBe("volume");
    expect(result.direct).toBe(true);
  });

  it("maps price tips to indirect", () => {
    const result = classifyTip("Consider competitive pricing");
    expect(result.component).toBe("indirect");
    expect(result.direct).toBe(false);
  });

  it("maps endpoint tips to indirect", () => {
    const result = classifyTip("Register more API endpoints");
    expect(result.component).toBe("indirect");
    expect(result.direct).toBe(false);
  });

  it("maps rank tips to diagnostic", () => {
    const result = classifyTip("You rank outside the category top 10");
    expect(result.component).toBe("diagnostic");
    expect(result.direct).toBe(false);
  });
});

describe("buildWeightRationale", () => {
  it("returns the same WEIGHT_RATIONALE object", () => {
    expect(buildWeightRationale()).toEqual(WEIGHT_RATIONALE);
  });
});
