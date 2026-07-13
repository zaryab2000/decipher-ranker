export const SCORE_COMPONENTS = [
  { key: 'volumeSignal', label: 'Volume', weight: 0.30 },
  { key: 'buyerDiversity', label: 'Buyer Diversity', weight: 0.25 },
  { key: 'reliability', label: 'Reliability', weight: 0.15 },
  { key: 'listingQuality', label: 'Listing Quality', weight: 0.15 },
  { key: 'recency', label: 'Recency', weight: 0.15 },
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
