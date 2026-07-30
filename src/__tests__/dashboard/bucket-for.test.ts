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

  it("puts a raw 0..1 score in the bottom bucket — callers must pass 0..100", () => {
    // Guards the §9.3 warning: passing merchants.rankerScore straight through
    // pins the line to "0-10" for every merchant in the catalog.
    expect(bucketFor(0.64)).toBe("0-10");
    expect(bucketFor(64)).toBe("60-70");
  });

  it("bins an unrounded score the same way the histogram does", () => {
    // The YOU marker must land on a bar the merchant actually contributed to.
    // buildScoreDistribution floors the unrounded value, so rounding before
    // bucketing moves scores just under a boundary into the wrong bar.
    expect(bucketFor(39.98)).toBe("30-40");
    expect(bucketFor(Math.round(39.98))).toBe("40-50"); // the bug, for contrast
    expect(bucketFor(29.66)).toBe("20-30");
    expect(bucketFor(29.89)).toBe("20-30");
  });
});
