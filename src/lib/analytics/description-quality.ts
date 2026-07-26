/**
 * Description quality scoring for the ranker's listing-quality component.
 * Replaces the length-only tiers (>150 → 0.8, >50 → 0.4) with a composite
 * that evaluates keyword density, category keyword presence, and structural
 * specificity — the same signals the Jina cross-encoder fires on.
 *
 * Also exports `computeFluffScore` (action 07) which adds buzzword detection
 * and first-person pronoun detection on top of the density score.
 */

import type { Category } from "@/lib/types";
import { TAXONOMY, normalizeTag } from "@/lib/analytics/taxonomy";

export const STOP_WORDS = new Set([
  "the", "a", "an", "and", "or", "for", "with", "this", "that",
  "from", "into", "your", "their", "will", "can", "are", "was",
  "has", "have", "been", "being", "does", "did", "not", "but",
  "also", "more", "than", "very", "just", "about", "over",
]);

export const STRUCTURAL_TERMS = [
  "/api/", "/v1/", "/v2/", "GET", "POST", "PUT", "PATCH", "DELETE",
  "JSON", "markdown", "CSV", "response", "request", "parameter",
  "endpoint", "returns", "accepts", "query", "body",
];

const QUALITY_NORMALIZATION = 1.35;

export interface DescriptionQualityScore {
  score: number;
  lengthScore: number;
  keywordDensity: number;
  categoryKeywordPresence: number;
  structuralSpecificity: number;
  length: number;
  fluffScore: number;
  buzzwords: string[];
  verdict: string;
}

function tokenize(description: string): string[] {
  return description
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter(Boolean);
}

export function computeKeywordDensity(description: string): number {
  const words = tokenize(description);
  if (words.length === 0) return 0;
  // Length >= 3 keeps content-rich domain abbreviations (api, eth, nft, sol,
  // dex, dai); the STOP_WORDS filter still drops 3-char function words
  // (the, and, for, are, ...). Sub-3-char noise (a, of, in, is) is excluded.
  const contentWords = words.filter(
    (w) => w.length >= 3 && !STOP_WORDS.has(w),
  );
  return contentWords.length / words.length;
}

export function computeCategoryKeywordPresence(
  description: string,
  category: Category | null,
): number {
  if (!category) return 0;
  const descLower = description.toLowerCase();
  const patterns =
    TAXONOMY.find((c) => c.slug === category.slug)?.tagPatterns ?? [];
  if (patterns.length === 0) return 0;
  const normalizedPatterns = patterns.map(normalizeTag);
  const matches = normalizedPatterns.filter((p) =>
    p.split(" ").every((token) => descLower.includes(token)),
  );
  return matches.length / patterns.length;
}

export function computeStructuralSpecificity(description: string): number {
  const descLower = description.toLowerCase();
  const hits = STRUCTURAL_TERMS.filter((t) =>
    descLower.includes(t.toLowerCase()),
  );
  return Math.min(hits.length / 5, 1);
}

const MARKETING_BUZZWORDS = new Set([
  "revolutionary", "cutting-edge", "seamless", "seamlessly", "innovative",
  "world-class", "next-generation", "game-changing", "leverage", "leveraging",
  "synergy", "synergies", "robust", "scalable", "enterprise-grade",
  "best-in-class", "state-of-the-art", "comprehensive", "empower", "empowering",
  "transform", "transformative", "unlock", "unlocking", "harness", "harnessing",
  "streamline", "streamlining", "optimize", "optimizing", "maximize",
  "reimagine", "reimagining", "elevate", "elevating", "supercharge",
  "powerful", "ultimate", "premier", "leading", "pioneer", "pioneering",
]);

const FIRST_PERSON_PRONOUNS = new Set([
  "our", "we", "your", "you", "us", "my",
]);

export function computeFluffScore(description: string): {
  fluffScore: number;
  buzzwordHits: string[];
  pronounRatio: number;
  stopWordRatio: number;
} {
  const words = tokenize(description);
  if (words.length === 0) {
    return {
      fluffScore: 0,
      buzzwordHits: [],
      pronounRatio: 0,
      stopWordRatio: 1,
    };
  }

  const buzzwordHits = words.filter((w) =>
    MARKETING_BUZZWORDS.has(w),
  );
  const pronounCount = words.filter((w) =>
    FIRST_PERSON_PRONOUNS.has(w),
  ).length;
  const pronounRatio = pronounCount / words.length;
  const stopCount = words.filter((w) => STOP_WORDS.has(w)).length;
  const stopWordRatio = stopCount / words.length;

  const buzzwordPenalty = Math.min(buzzwordHits.length * 0.1, 0.3);
  const pronounPenalty = pronounRatio > 0.05 ? 0.2 : 0;
  // A high stop-word ratio is only a fluff signal when paired with marketing
  // language. Correct API docs are full grammar ("Returns the price of a token
  // for the given address") and routinely exceed 40% stop words — penalizing
  // them purely for grammar would cap every clean description below 1.0.
  const hasOtherFluff = buzzwordHits.length > 0 || pronounRatio > 0.05;
  const stopPenalty = hasOtherFluff
    ? stopWordRatio > 0.5
      ? 0.2
      : stopWordRatio > 0.4
        ? 0.1
        : 0
    : 0;

  const fluffScore = Math.max(
    0,
    1 - buzzwordPenalty - pronounPenalty - stopPenalty,
  );

  return {
    fluffScore,
    buzzwordHits: [...new Set(buzzwordHits)],
    pronounRatio,
    stopWordRatio,
  };
}

export function computeDescriptionQualityScore(
  description: string,
  category: Category | null,
): DescriptionQualityScore {
  const length = description.length;
  const lengthScore =
    length > 150 ? 1 : length > 50 ? 0.6 : length > 0 ? 0.3 : 0;
  const keywordDensity = computeKeywordDensity(description);
  const categoryKeywordPresence = computeCategoryKeywordPresence(
    description,
    category,
  );
  const structuralSpecificity = computeStructuralSpecificity(description);

  const fluff = computeFluffScore(description);

  const rawScore =
    0.1 * lengthScore +
    0.4 * keywordDensity +
    0.3 * categoryKeywordPresence +
    0.2 * structuralSpecificity;

  const normalized = Math.min(rawScore * QUALITY_NORMALIZATION, 1.0);

  const score = Math.max(0, normalized * fluff.fluffScore);

  let verdict: string;
  if (length === 0) {
    verdict = "Missing — no description or empty";
  } else if (score >= 0.7) {
    verdict =
      "Good — description has strong keyword grounding and structural specificity";
  } else if (score >= 0.4) {
    verdict =
      "Fair — description has some useful terms but could use more API-specific vocabulary";
  } else {
    verdict =
      "Poor — description lacks keyword grounding or contains marketing fluff";
  }

  return {
    score: Math.round(score * 100) / 100,
    lengthScore: Math.round(lengthScore * 100) / 100,
    keywordDensity: Math.round(keywordDensity * 100) / 100,
    categoryKeywordPresence:
      Math.round(categoryKeywordPresence * 100) / 100,
    structuralSpecificity:
      Math.round(structuralSpecificity * 100) / 100,
    length,
    fluffScore: Math.round(fluff.fluffScore * 100) / 100,
    buzzwords: fluff.buzzwordHits,
    verdict,
  };
}
