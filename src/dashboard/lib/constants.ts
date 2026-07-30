// Mirrors RANKER_WEIGHTS in src/lib/analytics/ranker.ts exactly — these are the
// weights the product actually scores with. Ordered by descending weight so the
// biggest lever reads first; reliability is last because it is a constant
// placeholder (computeReliability always returns 0.5).
// A drift test in src/__tests__/dashboard/score-components.test.ts enforces both
// the values and the ordering.
export const SCORE_COMPONENTS = [
  { key: 'volumeSignal', label: 'Volume', weight: 0.40 },
  { key: 'buyerDiversity', label: 'Buyer diversity', weight: 0.25 },
  { key: 'listingQuality', label: 'Listing quality', weight: 0.15 },
  { key: 'recency', label: 'Recency', weight: 0.15 },
  { key: 'reliability', label: 'Reliability', weight: 0.05 },
] as const;

export const SCORE_COLORS = {
  high: { min: 70, tailwind: 'emerald-400', hex: '#34d399' },
  mid: { min: 40, tailwind: 'amber-400', hex: '#fbbf24' },
  low: { min: 0, tailwind: 'red-400', hex: '#f87171' },
} as const;

export const NAV_ITEMS = [
  { label: 'Home', href: '/dashboard', icon: 'Home' },
  { label: 'Leaderboard', href: '/dashboard/leaderboard', icon: 'Trophy' },
  { label: 'Categories', href: '/dashboard/categories', icon: 'Grid3x3' },
  { label: 'Search', href: '/dashboard/search', icon: 'Search' },
] as const;

export const CHAIN_LABELS: Record<string, string> = {
  base: 'Base',
  solana: 'Solana',
  tempo: 'Tempo',
};

export const DEFAULT_PAGE_SIZE = 50;

export const SORT_OPTIONS = [
  { value: 'rank', label: 'Rank' },
  { value: 'score', label: 'Score' },
  { value: 'txCount', label: 'Volume' },
  { value: 'price', label: 'Price' },
] as const;
