/**
 * Tag quality scoring for the ranker's listing-quality component.
 * Replaces the count-only tiers (3-5 → +0.3, 1+ → +0.1) with a composite
 * that evaluates taxonomy relevance, specificity, count, and spam detection.
 *
 * x402scan sorts by `toolCalls DESC, tags DESC` — tag count is a real
 * tiebreaker (v2-report §1.3). CDP Bazaar uses tags as a case-sensitive
 * filter key (v1-report §2.1). The Jina reranker sees tags as comma-joined
 * text in the document string (v1-report §2.3). Tags that match the
 * merchant's category vocabulary are the terms agents search for.
 */

import type { Category } from "@/lib/types";
import { TAXONOMY, normalizeTag } from "@/lib/analytics/taxonomy";

const SPAM_CATEGORY_THRESHOLD = 3;

export interface TagQualityScore {
  score: number;
  relevance: number;
  specificity: number;
  countScore: number;
  spam: boolean;
  count: number;
  issues: string[];
  suggestedTags: string[];
}

/** Does a normalized tag match a taxonomy pattern? Reuses categorizer logic. */
function tagMatchesPattern(
  normalizedTag: string,
  normalizedPattern: string,
): boolean {
  const patternTokens = new Set(normalizedPattern.split(" "));
  const tagTokens = new Set(normalizedTag.split(" "));
  return [...patternTokens].every((pt) => tagTokens.has(pt));
}

/** Does a normalized tag match ANY pattern in ANY taxonomy category? */
function tagMatchesAnyCategory(normalizedTag: string): string | null {
  for (const cat of TAXONOMY) {
    for (const pattern of cat.tagPatterns) {
      if (tagMatchesPattern(normalizedTag, normalizeTag(pattern))) {
        return cat.slug;
      }
    }
  }
  return null;
}

/** Fraction of tags that match the merchant's assigned category patterns. */
export function computeTagRelevance(
  tags: string[],
  category: Category | null,
): number {
  if (!category || tags.length === 0) return 0;
  const cat = TAXONOMY.find((c) => c.slug === category.slug);
  if (!cat) return 0;
  const normalizedTags = tags.map(normalizeTag);
  const normalizedPatterns = cat.tagPatterns.map(normalizeTag);
  const matches = normalizedTags.filter((t) =>
    normalizedPatterns.some((p) => tagMatchesPattern(t, p)),
  );
  return matches.length / Math.max(tags.length, 1);
}

/** Fraction of tags that are specific (match some taxonomy category) vs generic. */
export function computeTagSpecificity(tags: string[]): number {
  if (tags.length === 0) return 0;
  const normalized = tags.map(normalizeTag);
  const genericCount = normalized.filter(
    (t) => tagMatchesAnyCategory(t) === null,
  ).length;
  return 1 - genericCount / tags.length;
}

/** Detect if tags span too many different categories (spam signal). */
export function detectTagSpam(tags: string[]): boolean {
  const normalized = tags.map(normalizeTag);
  const matchedCategories = new Set<string>();
  for (const t of normalized) {
    const cat = tagMatchesAnyCategory(t);
    if (cat) matchedCategories.add(cat);
  }
  return matchedCategories.size > SPAM_CATEGORY_THRESHOLD;
}

/** Suggest category vocabulary tags the merchant isn't using. */
export function suggestTags(
  tags: string[],
  category: Category | null,
  maxSuggestions: number = 3,
): string[] {
  if (!category) return [];
  const cat = TAXONOMY.find((c) => c.slug === category.slug);
  if (!cat) return [];
  const existingNormalized = new Set(tags.map(normalizeTag));
  return cat.tagPatterns
    .filter((p) => !existingNormalized.has(normalizeTag(p)))
    .slice(0, maxSuggestions);
}

export function computeTagQualityScore(
  tags: string[],
  category: Category | null,
): TagQualityScore {
  const count = tags.length;
  const relevance = computeTagRelevance(tags, category);
  const specificity = computeTagSpecificity(tags);
  const spam = detectTagSpam(tags);
  const issues: string[] = [];

  if (count === 0) {
    issues.push(
      "No tags — x402scan's tag-count tiebreaker gives you no advantage when volume is equal to competitors",
    );
  }
  if (count > 5) {
    issues.push(
      `${count} tags — CDP Bazaar limits tags to 5; extras are dropped at validation`,
    );
  }
  if (relevance < 0.4 && count > 0) {
    issues.push(
      "Most tags don't match your category's search vocabulary — agents won't find you via tag filters",
    );
  }
  if (specificity < 0.5 && count > 0) {
    issues.push(
      "Some tags are generic ('api', 'data') — agents won't filter for these",
    );
  }
  if (spam) {
    issues.push(
      "Tags span multiple unrelated categories — possible tag spam that dilutes your category signal",
    );
  }

  const countScore =
    count >= 3 && count <= 5 ? 1 : count >= 1 ? 0.5 : 0;
  const spamScore = spam ? 0 : 1;
  const score =
    0.4 * relevance +
    0.35 * specificity +
    0.15 * countScore +
    0.1 * spamScore;

  return {
    score: Math.round(score * 100) / 100,
    relevance: Math.round(relevance * 100) / 100,
    specificity: Math.round(specificity * 100) / 100,
    countScore: Math.round(countScore * 100) / 100,
    spam,
    count,
    issues,
    suggestedTags: suggestTags(tags, category),
  };
}
