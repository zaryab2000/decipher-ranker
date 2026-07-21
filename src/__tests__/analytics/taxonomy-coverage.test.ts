import { describe, it, expect } from "vitest";
import usedTags from "../fixtures/used-category-tags.json";
import { assignCategory } from "@/lib/analytics/categorizer";

interface UsedTag {
  name: string;
  merchantCount: number;
}

/**
 * Distribution gate (taxonomy PRD §9.4).
 *
 * Scope: this measures classification quality over merchants that HAVE tags.
 * In the live catalog ~58% of merchants carry no tags at all and are therefore
 * unclassifiable by any tag-based taxonomy — they legitimately land in `other`.
 * That is a source-data reality, not a taxonomy defect, so the gate deliberately
 * excludes tagless merchants and asserts that the *tagged* population is well
 * covered. It guards against taxonomy rot: if a future edit to tagPatterns leaves
 * swaths of tagged merchants unclassified, this fails and prints the offenders.
 */
describe("taxonomy coverage gate (tagged merchants only)", () => {
  const tags = usedTags as UsedTag[];

  it("classifies <30% of tagged merchants into the other bucket", () => {
    let total = 0;
    let other = 0;
    const unmatched: string[] = [];

    for (const t of tags) {
      const slug = assignCategory([t.name]);
      total += t.merchantCount;
      if (slug === "other") {
        other += t.merchantCount;
        unmatched.push(`${t.name}(${t.merchantCount})`);
      }
    }

    const otherPct = (100 * other) / total;
    if (otherPct >= 30) {
      // Surface the offenders so the tagPatterns can be extended.
      console.error(`other = ${otherPct.toFixed(1)}% — unmatched tags:\n${unmatched.join(", ")}`);
    }
    expect(otherPct).toBeLessThan(30);
  });

  it("populates every curated category from the real tag data", () => {
    const hit = new Set<string>();
    for (const t of tags) hit.add(assignCategory([t.name]));
    const curated = [
      "crypto-defi", "payments-commerce", "finance-markets", "ai-agents",
      "data-enrichment", "web-search", "media-content", "news-social",
      "dev-tools", "security-compliance", "real-world-data", "fun-games",
    ];
    for (const slug of curated) {
      expect(hit.has(slug), `no real tag maps to "${slug}"`).toBe(true);
    }
  });
});
