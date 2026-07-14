import type { InferSelectModel } from "drizzle-orm";
import type {
  merchants,
  resources,
  categories,
  trends,
  reports,
  categoryCache,
} from "./db/schema";

export type Merchant = InferSelectModel<typeof merchants>;
export type Resource = InferSelectModel<typeof resources>;
export type Category = InferSelectModel<typeof categories>;
export type Trend = InferSelectModel<typeof trends>;
export type Report = InferSelectModel<typeof reports>;
export type CategoryCache = InferSelectModel<typeof categoryCache>;

export interface BazaarResource {
  resource: string;
  type: string;
  serviceName: string | null;
  description: string | null;
  tags: string[];
  quality: {
    l30DaysTotalCalls: number;
    l30DaysUniquePayers: number;
    lastCalledAt: string;
  } | null;
  accepts: Array<{
    amount: string;
    asset: string;
    network: string;
    payTo: string;
    scheme: string;
    extra?: {
      name?: string;
      version?: string;
      decimals?: number;
    };
  }>;
  extensions?: {
    bazaar?: {
      info?: {
        input?: { type: string; method: string };
        output?: { type: string; example?: unknown };
      };
    };
  };
}

export interface BazaarApiResponse {
  items: BazaarResource[];
  pagination: {
    total: number;
    offset: number;
    limit: number;
  };
}

export interface ScoreBreakdown {
  volumeSignal: number;
  buyerDiversity: number;
  reliability: number;
  listingQuality: number;
  recency: number;
}

export interface BasicReport {
  category: string | null;
  rankPosition: number | null;
  totalCompetitors: number;
  pricePosition: "below_median" | "median" | "above_median";
  descriptionQuality: number;
  listingCompleteness: number;
  tips: string[];
}

export interface CompetitorEntry {
  origin: string;
  rank: number | null;
  score: number;
  price: number | null;
  uniqueBuyers: number;
  toolCalls: number;
  descriptionLength: number;
}

export interface GapAnalysis {
  missingTags: string[];
  missingKeywords: string[];
  competitorCount: number;
}

export interface PricingBenchmark {
  yourPrice: number | null;
  medianPrice: number | null;
  minPrice: number | null;
  maxPrice: number | null;
  pricePercentile: number | null;
}

export interface TopMerchantEntry {
  address: string;
  rank: number;
  score: number;
  volume: number;
}
