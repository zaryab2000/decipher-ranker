import { describe, it, expect } from "vitest";
import { bucketFor } from "@/dashboard/components/categories/ScoreDistributionChart";

/**
 * bucketFor must emit the same "{low}-{high}" labels buildScoreDistribution
 * produces, or the YOU reference line lands on no bar at all.
 */
describe("bucketFor", () => {
  it("maps a score to its ten-point bucket", () => {
    expect(bucketFor(0)).toBe("0-10");
    expect(bucketFor(9)).toBe("0-10");
    expect(bucketFor(10)).toBe("10-20");
    expect(bucketFor(64)).toBe("60-70");
    expect(bucketFor(71)).toBe("70-80");
  });

  it("clamps 100 into the top bucket rather than emitting 100-110", () => {
    expect(bucketFor(100)).toBe("90-100");
    expect(bucketFor(99)).toBe("90-100");
  });

  it("puts a raw 0..1 score in the bottom bucket — callers must pass display scale", () => {
    // Guards the §9.3 warning: passing merchants.rankerScore straight through
    // pins the line to "0-10" for every merchant in the catalog.
    expect(bucketFor(0.64)).toBe("0-10");
    expect(bucketFor(64)).toBe("60-70");
  });
});
