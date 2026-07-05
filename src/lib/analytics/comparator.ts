import type { MerchantData } from "./ranker";
import type { GapAnalysis } from "@/lib/types";

export function computeGapAnalysis(
  merchant: MerchantData,
  competitors: MerchantData[],
): GapAnalysis {
  const competitorTags = new Set<string>();
  for (const comp of competitors) {
    for (const r of comp.resources) {
      for (const tag of r.tags ?? []) {
        competitorTags.add(tag.toLowerCase());
      }
    }
  }

  const merchantTags = new Set<string>();
  for (const r of merchant.resources) {
    for (const tag of r.tags ?? []) {
      merchantTags.add(tag.toLowerCase());
    }
  }

  const missingTags = [...competitorTags].filter((t) => !merchantTags.has(t));

  const merchantKeywords = extractKeywords(merchant.resources);
  const compKeywords = new Set<string>();
  for (const comp of competitors) {
    for (const kw of extractKeywords(comp.resources)) {
      compKeywords.add(kw);
    }
  }
  const missingKeywords = [...compKeywords].filter(
    (k) => !merchantKeywords.has(k),
  );

  return {
    missingTags: missingTags.slice(0, 10),
    missingKeywords: missingKeywords.slice(0, 10),
    competitorCount: competitors.length,
  };
}

const STOP_WORDS = new Set([
  "the", "a", "an", "and", "or", "for", "with", "this", "that",
  "from", "into", "your", "their", "will", "can", "are", "was",
  "has", "have", "been", "being", "does", "did", "not", "but",
  "also", "more", "than", "very", "just", "about", "over",
]);

function extractKeywords(
  resources: MerchantData["resources"],
): Set<string> {
  const keywords = new Set<string>();
  for (const r of resources) {
    const desc = r.description ?? "";
    const words = desc
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .split(/\s+/)
      .filter((w) => w.length > 3 && !STOP_WORDS.has(w));
    for (const w of words) {
      keywords.add(w);
    }
  }
  return keywords;
}
