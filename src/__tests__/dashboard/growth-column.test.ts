import { describe, expect, it } from "vitest";

import { OTHER_SLUG } from "@/dashboard/lib/constants";
import { fastestRiser, growthWindowDays } from "@/dashboard/lib/formatters";
import type { CategoryGrowth, CategoryItem } from "@/dashboard/types";

function growth(
  growthPct: number,
  daysCovered = 14,
  known = true,
): CategoryGrowth {
  return { growthPct, daysCovered, known };
}

function cat(
  name: string,
  slug: string,
  merchantCount: number,
  g: CategoryGrowth | null = null,
): CategoryItem {
  return {
    name,
    slug,
    merchantCount,
    medianPriceUsd: 0.01,
    avgScore: 0.4,
    topMerchant: null,
    growth: g,
    growthIndicator: g?.known ? g.growthPct : 0,
  };
}

describe("growthWindowDays", () => {
  it("returns the widest window across known categories", () => {
    // E18: categories can cover different spans; the header labels the max.
    expect(
      growthWindowDays([
        cat("A", "a", 10, growth(5, 11)),
        cat("B", "b", 10, growth(5, 14)),
        cat("C", "c", 10, growth(5, 9)),
      ]),
    ).toBe(14);
  });

  it("ignores unknown categories when picking the window", () => {
    expect(
      growthWindowDays([
        cat("A", "a", 10, growth(0, 30, false)),
        cat("B", "b", 10, growth(5, 12)),
      ]),
    ).toBe(12);
  });

  it("returns 0 when no category is known — the signal to omit the column", () => {
    // E13: a column of em-dashes is worse than no column.
    expect(
      growthWindowDays([
        cat("A", "a", 10, growth(0, 1, false)),
        cat("B", "b", 10, null),
      ]),
    ).toBe(0);
  });

  it("returns 0 for an empty list", () => {
    expect(growthWindowDays([])).toBe(0);
  });
});

describe("fastestRiser", () => {
  it("picks the highest growth among classified categories", () => {
    const riser = fastestRiser([
      cat("Alpha", "alpha", 10, growth(12.5)),
      cat("Beta", "beta", 10, growth(40.2)),
      cat("Gamma", "gamma", 10, growth(3.1)),
    ]);
    expect(riser?.name).toBe("Beta");
  });

  it("excludes Other even when it has the highest growth", () => {
    // E17: "Other grew fastest" describes the categorizer failing, not the
    // ecosystem. D1 lifts Other out of the ranking everywhere else too.
    const riser = fastestRiser([
      cat("Other", OTHER_SLUG, 700, growth(99)),
      cat("Alpha", "alpha", 10, growth(12.5)),
    ]);
    expect(riser?.name).toBe("Alpha");
  });

  it("returns null when the best mover is negative", () => {
    // E16: do not announce a "fastest riser" that did not rise.
    expect(
      fastestRiser([
        cat("Alpha", "alpha", 10, growth(-5)),
        cat("Beta", "beta", 10, growth(-1.2)),
      ]),
    ).toBeNull();
  });

  it("returns null when the best mover is flat below the threshold", () => {
    // E15: 0.04% rounds to 0.0% and is not a rise.
    expect(fastestRiser([cat("Alpha", "alpha", 10, growth(0.04))])).toBeNull();
  });

  it("ignores categories with no known growth", () => {
    const riser = fastestRiser([
      cat("Alpha", "alpha", 10, growth(80, 14, false)),
      cat("Beta", "beta", 10, growth(2.5)),
    ]);
    expect(riser?.name).toBe("Beta");
  });

  it("breaks ties alphabetically, matching splitCategories", () => {
    const riser = fastestRiser([
      cat("Zebra", "zebra", 10, growth(20)),
      cat("Apple", "apple", 10, growth(20)),
    ]);
    expect(riser?.name).toBe("Apple");
  });

  it("returns null when every category is unknown", () => {
    expect(
      fastestRiser([cat("Alpha", "alpha", 10, null)]),
    ).toBeNull();
  });

  it("returns null for an empty list", () => {
    expect(fastestRiser([])).toBeNull();
  });

  it("labels the riser with its own window, not the widest", () => {
    // E18: the sentence uses that category's daysCovered.
    const riser = fastestRiser([
      cat("Alpha", "alpha", 10, growth(50, 9)),
      cat("Beta", "beta", 10, growth(5, 14)),
    ]);
    expect(riser?.growth?.daysCovered).toBe(9);
  });
});
