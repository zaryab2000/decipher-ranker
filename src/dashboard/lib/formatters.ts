import { GROWTH_FLAT_THRESHOLD, OTHER_SLUG, SCORE_COMPONENTS } from '@/dashboard/lib/constants';
import type { CategoryItem, ScoreBreakdown } from '@/dashboard/types';

export function formatNumber(value: number): string {
  if (value >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(1)}B`;
  }
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`;
  }
  return String(value);
}

export function formatPrice(value: number): string {
  return `$${value.toFixed(value < 0.01 ? 4 : 2)}`;
}

export function formatRelativeDate(date: string | Date): string {
  const now = Date.now();
  const then = typeof date === 'string' ? new Date(date).getTime() : date.getTime();
  const diffMs = now - then;
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 30) {
    return formatDate(date);
  }
  if (diffDays >= 1) {
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  }
  if (diffHours >= 1) {
    return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  }
  if (diffMinutes >= 1) {
    return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`;
  }
  return 'just now';
}

export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Converts a stored ranker score (0..1) to the display scale (0..100).
 *
 * `merchants.rankerScore`, `MerchantListItem.rankerScore`,
 * `MerchantProfile.rankerScore`, `CategoryItem.avgScore` and
 * `trends.rankerScore` are ALL stored 0..1. Anything shown to a user, passed to
 * scoreToGrade(), or used as a bar width must go through here — passing a raw
 * 0..1 value renders "0.64" instead of "64" and grades every merchant "F".
 */
export function toDisplayScore(raw: number | string | null | undefined): number {
  // `string` is accepted because Drizzle types decimal columns
  // (merchants.rankerScore, trends.rankerScore) as string.
  const n = Number(raw ?? 0);
  if (!Number.isFinite(n)) return 0;
  return Math.round(Math.max(0, Math.min(1, n)) * 100);
}

export interface WeightedComponent {
  key: string;
  label: string;
  /** Points earned, rounded to 1dp. */
  earned: number;
  /** Points available for this component (weight * 100). */
  available: number;
  /** 0..100, for bar width. */
  pctOfMax: number;
  /** True when `earned` rounds to zero — flag as the biggest lever. */
  isZero: boolean;
}

/**
 * Converts a 0..100-per-component breakdown into weighted points.
 *
 * A merchant does not care that volume scores 65/100; they care that volume is
 * worth 40 points and they hold 26 of them. Output is already ordered by
 * descending weight because SCORE_COMPONENTS is.
 *
 * `earned` values sum to toDisplayScore(merchant.rankerScore) — the 0..100
 * display score — NOT to the raw 0..1 column value.
 */
export function toWeightedComponents(breakdown: ScoreBreakdown): WeightedComponent[] {
  return SCORE_COMPONENTS.map((c) => {
    const raw = breakdown[c.key as keyof ScoreBreakdown] ?? 0;
    const available = c.weight * 100;
    const earned = (raw / 100) * available;
    return {
      key: c.key,
      label: c.label,
      earned: Math.round(earned * 10) / 10,
      available,
      pctOfMax: Math.max(0, Math.min(100, raw)),
      isZero: earned < 0.05,
    };
  });
}

/**
 * Whether a category name actually positions a merchant.
 *
 * "Other" is the catch-all the categorizer assigns when nothing matches, and it
 * currently holds 714 of 1,343 merchants — 53% of the catalog. Telling someone
 * they "rank #1 of 714 in Other" is the absence of positioning dressed as
 * positioning, so surfaces treat it the same as having no category: rank is
 * reported against the whole catalog instead.
 *
 * Remove this once the categorizer shrinks the bucket.
 */
export function isMeaningfulCategory(category: string | null | undefined): boolean {
  return Boolean(category) && category !== 'Other';
}

/**
 * The zero-scoring component worth the most points, or null if none is zero.
 *
 * Single source of truth for the phrase "biggest lever" / "your largest gap" —
 * the metric card and the component breakdown both read it, so they cannot make
 * competing claims about which gap matters most. Components are already ordered
 * by descending weight, so the first zero is the most valuable one.
 */
export function biggestLever(breakdown: ScoreBreakdown): WeightedComponent | null {
  return toWeightedComponents(breakdown).find((c) => c.isZero) ?? null;
}

export function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return `${str.slice(0, maxLength - 3)}...`;
}

export function displayName(merchant: {
  serviceName: string | null;
  origin: string;
}): string;
export function displayName(url: string): string;
export function displayName(merchantOrUrl: { serviceName: string | null; origin: string } | string): string {
  if (typeof merchantOrUrl === "string") {
    try {
      return new URL(merchantOrUrl).hostname;
    } catch {
      return merchantOrUrl;
    }
  }
  if (merchantOrUrl.serviceName) return merchantOrUrl.serviceName;
  try {
    return new URL(merchantOrUrl.origin).hostname;
  } catch {
    return merchantOrUrl.origin;
  }
}

export function formatAddress(address: string): string {
  if (address.length <= 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export interface CategorySplit {
  /** Sorted by merchantCount desc, `Other` removed. */
  classified: CategoryItem[];
  /** The `Other` row, or null when the catalog has none. */
  other: CategoryItem | null;
  /**
   * Across ALL categories, including `Other`. Used only by the unclassified
   * strip, whose "53% of the catalog" is a claim about the whole catalog.
   */
  totalMerchants: number;
  /**
   * Across classified categories only, excluding `Other`. The single
   * denominator for everything in the table: the header percentage AND every
   * Share cell. Sharing it is what makes the first three Share values sum to
   * the header figure with no conversion.
   */
  classifiedMerchants: number;
  /** Bar-scale denominator. Always >= 1 so bar widths can never be NaN. */
  maxClassifiedCount: number;
  /**
   * 0..100, share of CLASSIFIED merchants held by the three largest
   * classified categories.
   *
   * `Other` is excluded from both the numerator and the denominator. It was
   * previously in the numerator, which made the header claim "three categories
   * hold 88%" while the table beneath it numbered only classified rows — the
   * 88% silently counted a fourth bucket that D1 lifts out of the ranking. A
   * reader summing the first three Share cells got 37.8% and could not
   * reconcile it.
   */
  topThreeClassifiedShare: number;
}

/**
 * Splits the category list for the proportional-list layout.
 *
 * `Other` is lifted out of the ranking so it cannot dominate the bar scale: at
 * ~53% of the catalog it would push every real category under half the track
 * and turn the page into a chart about `Other`. It is rendered separately by
 * UnclassifiedStrip, never hidden.
 *
 * `classifiedMerchants` is the one denominator for everything in the table —
 * the header percentage and every Share cell — so the two cannot drift apart.
 * `totalMerchants` is returned for the unclassified strip alone, which speaks
 * about the whole catalog rather than the ranking.
 */
export function splitCategories(categories: CategoryItem[]): CategorySplit {
  const total = categories.reduce((sum, c) => sum + c.merchantCount, 0);

  // The secondary sort on name is REQUIRED, not cosmetic. The SQL orders only
  // by `merchant_count DESC` with no tiebreak, so Postgres may return
  // equal-count categories in a different order on any given run — live data
  // has three ties (15/15, 9/9, 6/6). Without this, rank numbers shuffle
  // between requests and the ISR cache bakes in whichever order it saw first.
  const bySize = [...categories].sort(
    (a, b) => b.merchantCount - a.merchantCount || a.name.localeCompare(b.name),
  );

  const other = categories.find((c) => c.slug === OTHER_SLUG) ?? null;
  const classified = bySize.filter((c) => c.slug !== OTHER_SLUG);

  // Numerator and denominator both come from `classified`, so the headline can
  // only ever describe rows the table renders. Taken from `bySize` (which
  // includes Other) these two would disagree with the visible ranking.
  const classifiedTotal = classified.reduce((sum, c) => sum + c.merchantCount, 0);
  const topThreeClassified = classified
    .slice(0, 3)
    .reduce((sum, c) => sum + c.merchantCount, 0);

  return {
    classified,
    other,
    totalMerchants: total,
    classifiedMerchants: classifiedTotal,
    maxClassifiedCount: Math.max(classified[0]?.merchantCount ?? 0, 1),
    topThreeClassifiedShare:
      classifiedTotal > 0 ? (topThreeClassified / classifiedTotal) * 100 : 0,
  };
}

/**
 * Widest snapshot window any category actually has, in days.
 *
 * The growth column is labelled with this rather than the 30 days requested
 * from getCategoryTrends(): `trends` only began accumulating on 2026-07-20, so
 * asking for 30 and printing "30d" would overstate the sample. Returns 0 when
 * nothing is known, which is the signal to omit the column entirely.
 */
export function growthWindowDays(categories: CategoryItem[]): number {
  let max = 0;
  for (const c of categories) {
    if (c.growth?.known && c.growth.daysCovered > max) max = c.growth.daysCovered;
  }
  return max;
}

/**
 * The category that grew fastest, for the header sentence — or null when there
 * is nothing honest to announce.
 *
 * `Other` is excluded: D1 lifts it out of the ranking everywhere else on this
 * page, and "Other grew fastest" is a statement about the categorizer failing
 * rather than about the ecosystem. A flat or shrinking leader is suppressed
 * too — a "fastest riser" that did not rise is not a fact worth printing.
 */
export function fastestRiser(categories: CategoryItem[]): CategoryItem | null {
  let best: CategoryItem | null = null;
  for (const c of categories) {
    if (c.slug === OTHER_SLUG) continue;
    if (!c.growth?.known || c.growth.growthPct < GROWTH_FLAT_THRESHOLD) continue;

    if (
      best === null ||
      c.growth.growthPct > best.growth!.growthPct ||
      // Ties break alphabetically, matching splitCategories.
      (c.growth.growthPct === best.growth!.growthPct &&
        c.name.localeCompare(best.name) < 0)
    ) {
      best = c;
    }
  }
  return best;
}
