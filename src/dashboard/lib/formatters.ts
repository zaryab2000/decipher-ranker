import { SCORE_COMPONENTS } from '@/dashboard/lib/constants';
import type { ScoreBreakdown } from '@/dashboard/types';

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
