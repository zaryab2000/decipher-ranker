/**
 * Service name quality assessment for the ranker's listing-quality component.
 * Replaces the binary "serviceName present → +0.5" with a quality-aware score
 * that penalizes generic names like "API" or "Service" and rewards specific
 * names like "Weather Forecast API" or "Shared Inference Output".
 *
 * The quality dimensions:
 * 1. Length — short names are usually generic ("API", "Test")
 * 2. Specificity — certain literal strings are always generic
 * 3. Capitalization — mixed-case names suggest a real product, not a placeholder
 */

const GENERIC_NAMES = new Set([
  "api", "service", "endpoint", "tool", "test", "default", "app",
  "data", "blog", "site", "server", "main", "index", "demo",
]);

export function computeServiceNameQuality(serviceName: string | null): number {
  if (!serviceName) return 0;
  const name = serviceName.trim();
  if (name.length === 0) return 0;

  const lower = name.toLowerCase();

  // Exact match against generic-name list — always low-score
  if (GENERIC_NAMES.has(lower)) return 0.1;

  // Too short to be meaningful
  if (name.length < 3) return 0.1;

  // Multi-word names with capitalization (e.g., "Weather Forecast API") are specific
  if (name.length >= 10 && /[A-Z]/.test(name) && /\s/.test(name)) {
    return 1.0;
  }

  // Hyphenated or multi-word names without capitalization (e.g., "basescout-feed")
  if (name.length >= 5 && (/[-_]/.test(name) || /\s/.test(name))) {
    return 0.8;
  }

  // Single-word names with capitalization (e.g., "StableEnrich") — decent
  if (name.length >= 5 && /[A-Z]/.test(name)) {
    return 0.7;
  }

  // Single lowercase word 5+ chars (e.g., "scoop", "feeler") — borderline
  if (name.length >= 5) {
    return 0.5;
  }

  // 3-4 char names — usually abbreviated, marginal
  return 0.3;
}
