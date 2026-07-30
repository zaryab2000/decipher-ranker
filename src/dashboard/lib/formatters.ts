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
export function toDisplayScore(raw: number | null | undefined): number {
  return Math.round(Math.max(0, Math.min(1, Number(raw ?? 0))) * 100);
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
