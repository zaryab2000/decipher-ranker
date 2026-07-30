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

// Score bars use ONE colour. Magnitude is encoded by bar LENGTH, not by hue.
// The previous three-tier system painted a healthy ecosystem as failure: with a
// median score near 34, every category average landed in the red or amber band.
// Hue is now reserved for direction of change (see TREND_COLORS).
export const SCORE_FILL = 'bg-emerald-500'; // #10b981
export const SCORE_TRACK = 'bg-gray-100'; // #f3f4f6

// Hue means one thing only: which way a number moved.
export const TREND_COLORS = {
  up: { text: 'text-emerald-600', hex: '#059669' }, // rank improved
  down: { text: 'text-red-600', hex: '#dc2626' }, // rank regressed
  flat: { text: 'text-gray-400', hex: '#9ca3af' },
} as const;

export const NAV_ITEMS = [
  { label: 'My merchant', href: '/dashboard', icon: 'Gauge' },
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
