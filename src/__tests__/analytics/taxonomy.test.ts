import { describe, it, expect } from "vitest";
import { TAXONOMY, OTHER, normalizeTag } from "@/lib/analytics/taxonomy";

describe("taxonomy integrity", () => {
  const all = [...TAXONOMY, OTHER];

  it("has 12 curated categories plus other", () => {
    expect(TAXONOMY).toHaveLength(12);
    expect(OTHER.slug).toBe("other");
  });

  it("has unique slugs", () => {
    const slugs = all.map((c) => c.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("has unique names", () => {
    const names = all.map((c) => c.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("has non-empty name, description, and color for every category", () => {
    for (const c of all) {
      expect(c.name.length).toBeGreaterThan(0);
      expect(c.description.length).toBeGreaterThan(0);
      expect(c.color).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it("has non-empty tagPatterns for every curated category (other is empty)", () => {
    for (const c of TAXONOMY) {
      expect(c.tagPatterns.length).toBeGreaterThan(0);
    }
    expect(OTHER.tagPatterns).toHaveLength(0);
  });

  it("stores every tagPattern already normalized", () => {
    for (const c of TAXONOMY) {
      for (const p of c.tagPatterns) {
        expect(normalizeTag(p)).toBe(p);
      }
    }
  });

  it("has no tagPattern shared across categories (would be dead code)", () => {
    // A pattern listed in two categories can only ever fire for the earlier one
    // (TAXONOMY order wins), so the later copy is unreachable. Keep patterns
    // unique across the whole taxonomy so edits are never silently no-ops.
    const owner = new Map<string, string>();
    const dupes: string[] = [];
    for (const c of TAXONOMY) {
      for (const p of c.tagPatterns) {
        const prev = owner.get(p);
        if (prev) dupes.push(`"${p}" in both ${prev} and ${c.slug}`);
        else owner.set(p, c.slug);
      }
    }
    expect(dupes).toEqual([]);
  });
});

describe("normalizeTag", () => {
  it("lowercases and collapses non-alphanumerics to single spaces", () => {
    expect(normalizeTag("Web-Content")).toBe("web content");
    expect(normalizeTag("real_estate")).toBe("real estate");
    expect(normalizeTag("  AI   Agent  ")).toBe("ai agent");
    expect(normalizeTag("10-Q")).toBe("10 q");
  });
});
