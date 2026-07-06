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
  uniqueBuyers: number;
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
  topMerchant: { address: string; score: number } | null;
  growthIndicator: number;
}

export interface CategoryDetail extends CategoryItem {
  merchants: MerchantListItem[];
  totalVolume30d: number;
  scoreDistribution: { range: string; count: number }[];
}

export interface EcosystemStats {
  totalMerchants: number;
  totalCategories: number;
  totalTransactions: number;
  topCategory: string;
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
