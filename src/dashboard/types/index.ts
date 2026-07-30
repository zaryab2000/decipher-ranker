export interface MerchantListItem {
  payeeAddress: string;
  origin: string;
  serviceName: string | null;
  category: string | null;
  chain: string;
  rankerScore: number;
  rankPosition: number | null;
  priceUsd: number | null;
  txCount30d: number;
  uniqueBuyers: number | null;
  lastUpdated: string;
}

export interface MerchantProfile extends MerchantListItem {
  description: string | null;
  tags: string[];
  facilitator: string | null;
  firstSeenAt: string;
  totalAmountUsd: number;
  volume30d: number;
  buyers30d: number;
  scoreBreakdown: ScoreBreakdown;
  competitors: MerchantListItem[];
  improvements: ImprovementSuggestion[];
  /** Needed to query `trends`, which keys on the merchant UUID, not payeeAddress. */
  merchantId: string;
  /** Letter grade from scoreToGrade(toDisplayScore(rankerScore)). */
  grade: string;
  rankHistory: RankHistoryPoint[];
  rankDelta: RankDelta;
  rankGap: RankGap;
}

export interface RankHistoryPoint {
  /** ISO date, e.g. "2026-07-30". */
  date: string;
  rankPosition: number | null;
  /** Display scale (0..100), already converted from the stored 0..1. */
  rankerScore: number;
}

export interface RankDelta {
  /** 'up' means the rank improved — i.e. rankPosition got numerically smaller. */
  direction: 'up' | 'down' | 'flat';
  /** Absolute number of places moved; 0 when flat or unknown. */
  places: number;
  /** False when there is no prior snapshot to compare against. */
  known: boolean;
}

export interface RankGap {
  /** Points needed to pass the merchant one place above. */
  toNextRank: number | null;
  /** Points needed to match #1 in the category. */
  toFirst: number | null;
  nextRankName: string | null;
}

export interface ScoreBreakdown {
  volumeSignal: number;
  buyerDiversity: number;
  reliability: number;
  listingQuality: number;
  recency: number;
}

export interface ImprovementSuggestion {
  priority: 'high' | 'medium' | 'low';
  message: string;
}

export interface CategoryItem {
  name: string;
  slug: string;
  merchantCount: number;
  medianPriceUsd: number | null;
  avgScore: number | null;
  topMerchant: { address: string; score: number; serviceName?: string | null; resourceUrl?: string | null } | null;
  growthIndicator: number;
}

export interface CategoryDetail extends CategoryItem {
  merchants: MerchantListItem[];
  totalVolume30d: number | null;
  scoreDistribution: { range: string; count: number }[];
}

export interface EcosystemStats {
  totalMerchants: number;
  totalCategories: number;
  totalTransactions: number;
  topCategory: string;
  totalResources: number;
}

export interface SearchResult {
  merchants: MerchantListItem[];
  total: number;
  query: string;
}

export interface LeaderboardData {
  merchants: MerchantListItem[];
  total: number;
  page: number;
  perPage: number;
  category: string | null;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

export interface PaginationMeta {
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
}
