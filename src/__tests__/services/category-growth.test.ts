import { describe, it, expect } from "vitest";
import {
  computeCategoryGrowth,
  type CategoryTrendPoint,
} from "@/lib/services/trendService";

function point(
  date: string,
  categoryId: string,
  merchantCount: number,
): CategoryTrendPoint {
  return { date, categoryId, merchantCount, avgScore: 0.4, totalTx30d: 100 };
}

describe("computeCategoryGrowth", () => {
  it("computes percentage change between the first and last snapshot", () => {
    const g = computeCategoryGrowth([
      point("2026-07-20", "cat-a", 100),
      point("2026-07-30", "cat-a", 150),
    ]);
    expect(g.get("cat-a")?.growthPct).toBeCloseTo(50, 5);
    expect(g.get("cat-a")?.known).toBe(true);
  });

  it("reports a negative percentage when a category shrank", () => {
    const g = computeCategoryGrowth([
      point("2026-07-20", "cat-a", 200),
      point("2026-07-30", "cat-a", 150),
    ]);
    expect(g.get("cat-a")?.growthPct).toBeCloseTo(-25, 5);
  });

  it("reports known: false with a single snapshot rather than 0% growth", () => {
    // "No change" and "no data" are different facts and must not render alike.
    const g = computeCategoryGrowth([point("2026-07-30", "cat-a", 100)]);
    expect(g.get("cat-a")?.known).toBe(false);
    expect(g.get("cat-a")?.growthPct).toBe(0);
  });

  it("reports known: false when every snapshot shares one date", () => {
    const g = computeCategoryGrowth([
      point("2026-07-30", "cat-a", 100),
      point("2026-07-30", "cat-a", 100),
    ]);
    expect(g.get("cat-a")?.known).toBe(false);
  });

  it("counts the days actually covered, not the window requested", () => {
    // trends only began accumulating on 2026-07-20, so a 30-day request
    // returns a much shorter window. Callers must label what they got.
    const g = computeCategoryGrowth([
      point("2026-07-20", "cat-a", 10),
      point("2026-07-31", "cat-a", 20),
    ]);
    expect(g.get("cat-a")?.daysCovered).toBe(12);
  });

  it("keeps categories independent", () => {
    const g = computeCategoryGrowth([
      point("2026-07-20", "cat-a", 100),
      point("2026-07-30", "cat-a", 200),
      point("2026-07-20", "cat-b", 50),
      point("2026-07-30", "cat-b", 25),
    ]);
    expect(g.get("cat-a")?.growthPct).toBeCloseTo(100, 5);
    expect(g.get("cat-b")?.growthPct).toBeCloseTo(-50, 5);
  });

  it("reports known: false when a category started at zero", () => {
    // Percentage change from zero is undefined, not zero. A category that went
    // 0 -> 10 across the window must not render identically to one that
    // genuinely did not move.
    const g = computeCategoryGrowth([
      point("2026-07-20", "cat-a", 0),
      point("2026-07-30", "cat-a", 10),
    ]);
    expect(g.get("cat-a")?.known).toBe(false);
    expect(Number.isFinite(g.get("cat-a")!.growthPct)).toBe(true);
  });

  it("reports daysCovered as a day span on the unknown path, not a snapshot count", () => {
    // Regression: this used to return sorted.length, so a caller comparing
    // daysCovered across categories was mixing days with row counts.
    const g = computeCategoryGrowth([
      point("2026-07-30", "cat-a", 100),
      point("2026-07-30", "cat-a", 100),
      point("2026-07-30", "cat-a", 100),
    ]);
    expect(g.get("cat-a")?.known).toBe(false);
    expect(g.get("cat-a")?.daysCovered).toBe(1);
  });

  it("reports a one-day span for a single snapshot", () => {
    const g = computeCategoryGrowth([point("2026-07-30", "cat-a", 100)]);
    expect(g.get("cat-a")?.daysCovered).toBe(1);
  });

  it("keeps daysCovered a day span when a zero-start category is unknown", () => {
    const g = computeCategoryGrowth([
      point("2026-07-20", "cat-a", 0),
      point("2026-07-31", "cat-a", 10),
    ]);
    expect(g.get("cat-a")?.known).toBe(false);
    expect(g.get("cat-a")?.daysCovered).toBe(12);
  });

  it("sorts unordered input before comparing endpoints", () => {
    const g = computeCategoryGrowth([
      point("2026-07-30", "cat-a", 150),
      point("2026-07-20", "cat-a", 100),
    ]);
    expect(g.get("cat-a")?.growthPct).toBeCloseTo(50, 5);
  });

  it("returns an empty map for empty input", () => {
    expect(computeCategoryGrowth([]).size).toBe(0);
  });
});
