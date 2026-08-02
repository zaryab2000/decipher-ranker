import { describe, expect, it } from "vitest";

import { splitCategories } from "@/dashboard/lib/formatters";
import { OTHER_SLUG } from "@/dashboard/lib/constants";
import type { CategoryGrowth, CategoryItem } from "@/dashboard/types";

function cat(
  name: string,
  slug: string,
  merchantCount: number,
  avgScore: number | null = 0.4,
  growth: CategoryGrowth | null = null,
): CategoryItem {
  return {
    name,
    slug,
    merchantCount,
    medianPriceUsd: 0.01,
    avgScore,
    topMerchant: null,
    growth,
    growthIndicator: growth?.known ? growth.growthPct : 0,
  };
}

// Mirrors the live distribution from GET /api/categories on 2026-07-31.
// Deliberately NOT pre-sorted: the SQL returns Other last, and splitCategories
// must not depend on the incoming order.
const LIVE: CategoryItem[] = [
  cat("Crypto & DeFi", "crypto-defi", 340),
  cat("AI & Agents", "ai-agents", 131),
  cat("Data & Enrichment", "data-enrichment", 36),
  cat("Finance & Markets", "finance-markets", 33),
  cat("Payments & Commerce", "payments-commerce", 21),
  cat("Web & Search", "web-search", 15),
  cat("Real-World Data", "real-world-data", 15),
  cat("Fun & Games", "fun-games", 9),
  cat("Security & Compliance", "security-compliance", 9),
  cat("Media & Content", "media-content", 8),
  cat("News & Social", "news-social", 6),
  cat("Developer Tools", "developer-tools", 6),
  cat("Other", OTHER_SLUG, 714),
];

describe("splitCategories", () => {
  it("lifts Other out of the ranked list", () => {
    const { classified, other } = splitCategories(LIVE);

    expect(other?.slug).toBe(OTHER_SLUG);
    expect(classified).toHaveLength(12);
    expect(classified.some((c) => c.slug === OTHER_SLUG)).toBe(false);
  });

  it("counts Other in totalMerchants", () => {
    const { totalMerchants } = splitCategories(LIVE);
    expect(totalMerchants).toBe(1343);
  });

  it("scales bars against the largest CLASSIFIED category, not Other", () => {
    const { maxClassifiedCount } = splitCategories(LIVE);
    // 340 (Crypto & DeFi), never 714 (Other).
    expect(maxClassifiedCount).toBe(340);
  });

  it("sorts classified categories by merchant count descending", () => {
    const { classified } = splitCategories(LIVE);
    const counts = classified.map((c) => c.merchantCount);
    expect(counts).toEqual([...counts].sort((a, b) => b - a));
    expect(classified[0].name).toBe("Crypto & DeFi");
  });

  it("computes topThreeClassifiedShare EXCLUDING Other from both sides", () => {
    // Regression: this used to be (714 + 340 + 131) / 1343 = 88.2%, which put
    // Other in the numerator while the table beneath numbered only classified
    // rows. The headline claimed "three categories hold 88%" of a ranking
    // Other is not part of.
    const { topThreeClassifiedShare } = splitCategories(LIVE);
    // (340 + 131 + 36) / 629
    expect(topThreeClassifiedShare).toBeCloseTo(80.6, 1);
  });

  it("breaks count ties alphabetically and stays stable across shuffles", () => {
    const shuffled = [...LIVE].reverse();

    const a = splitCategories(LIVE).classified.map((c) => c.name);
    const b = splitCategories(shuffled).classified.map((c) => c.name);

    expect(a).toEqual(b);
    // 15/15 tie
    expect(a.indexOf("Real-World Data")).toBeLessThan(a.indexOf("Web & Search"));
    // 9/9 tie
    expect(a.indexOf("Fun & Games")).toBeLessThan(a.indexOf("Security & Compliance"));
    // 6/6 tie
    expect(a.indexOf("Developer Tools")).toBeLessThan(a.indexOf("News & Social"));
  });

  it("matches Other by slug, not by display name", () => {
    const renamed = LIVE.map((c) =>
      c.slug === OTHER_SLUG ? { ...c, name: "Uncategorized" } : c,
    );

    const { other, classified } = splitCategories(renamed);

    expect(other?.name).toBe("Uncategorized");
    expect(classified).toHaveLength(12);
  });

  it("returns other: null when no Other row exists", () => {
    const withoutOther = LIVE.filter((c) => c.slug !== OTHER_SLUG);
    const { other, classified, totalMerchants } = splitCategories(withoutOther);

    expect(other).toBeNull();
    expect(classified).toHaveLength(12);
    expect(totalMerchants).toBe(629);
  });

  it("never returns a zero denominator for an empty catalog", () => {
    const {
      classified,
      other,
      totalMerchants,
      classifiedMerchants,
      maxClassifiedCount,
      topThreeClassifiedShare,
    } = splitCategories([]);

    expect(classified).toEqual([]);
    expect(other).toBeNull();
    expect(totalMerchants).toBe(0);
    expect(classifiedMerchants).toBe(0);
    // Math.max(..., 1) — a 0 here would make every bar width NaN.
    expect(maxClassifiedCount).toBe(1);
    expect(topThreeClassifiedShare).toBe(0);
  });

  it("handles a catalog containing only Other", () => {
    // E2. Previously 100% — Other was the whole numerator AND denominator, so
    // the header announced total concentration in a category the table does
    // not list. With nothing classified there is no share to state.
    const { classified, other, classifiedMerchants, maxClassifiedCount, topThreeClassifiedShare } =
      splitCategories([cat("Other", OTHER_SLUG, 714)]);

    expect(classified).toEqual([]);
    expect(other?.merchantCount).toBe(714);
    expect(classifiedMerchants).toBe(0);
    expect(maxClassifiedCount).toBe(1);
    expect(topThreeClassifiedShare).toBe(0);
  });

  it("excludes Other from the header denominator", () => {
    const { totalMerchants, classifiedMerchants } = splitCategories(LIVE);

    // The two denominators differ on purpose: the header speaks about
    // classified merchants, the Share column about the whole catalog.
    expect(totalMerchants).toBe(1343);
    expect(classifiedMerchants).toBe(629);
    expect(totalMerchants - classifiedMerchants).toBe(714);
  });

  it("reconciles: classified + unclassified === total indexed", () => {
    const { totalMerchants, classifiedMerchants, other } = splitCategories(LIVE);
    expect(classifiedMerchants + (other?.merchantCount ?? 0)).toBe(totalMerchants);
  });

  it("header share equals the top-3 sum over the same denominator it reports", () => {
    // Guards the drift this fix was for: the percentage the header prints must
    // be reproducible from the rows the table renders, using the denominator
    // the sentence names — no hidden fourth bucket in the numerator.
    const { classified, classifiedMerchants, topThreeClassifiedShare } =
      splitCategories(LIVE);

    const topThree = classified
      .slice(0, 3)
      .reduce((sum, c) => sum + c.merchantCount, 0);

    expect(topThreeClassifiedShare).toBeCloseTo(
      (topThree / classifiedMerchants) * 100,
      10,
    );
  });

  it("first three Share values sum to the header percentage, no conversion", () => {
    // The Share column and the header divide by the SAME denominator, so a
    // reader adding the first three Share cells lands on the header figure
    // exactly. No rescaling step — if one is ever needed again, the two have
    // drifted apart and this fails.
    const { classified, classifiedMerchants, topThreeClassifiedShare } =
      splitCategories(LIVE);

    // Computed the way CategoryRow computes it.
    const shareOf = (c: CategoryItem) =>
      (c.merchantCount / classifiedMerchants) * 100;

    const sumOfFirstThree = classified.slice(0, 3).reduce((sum, c) => sum + shareOf(c), 0);

    expect(sumOfFirstThree).toBeCloseTo(topThreeClassifiedShare, 10);
  });
});
