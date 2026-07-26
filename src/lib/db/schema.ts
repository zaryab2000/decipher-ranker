import {
  pgTable,
  uuid,
  text,
  timestamp,
  bigint,
  decimal,
  integer,
  jsonb,
  date,
  boolean,
  index,
  unique,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const categories = pgTable("categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull().unique(),
  color: text("color"),
  description: text("description"),
  merchantCount: integer("merchant_count").default(0),
  medianPrice: decimal("median_price", { precision: 20, scale: 6 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const merchants = pgTable(
  "merchants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    payeeAddress: text("payee_address").notNull().unique(),
    facilitator: text("facilitator"),
    chain: text("chain").notNull().default("base"),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull().defaultNow(),
    lastUpdated: timestamp("last_updated", { withTimezone: true }).notNull().defaultNow(),

    txCount: bigint("tx_count", { mode: "number" }).default(0),
    totalAmountUsd: decimal("total_amount_usd", { precision: 20, scale: 6 }).default("0"),
    uniqueBuyers: integer("unique_buyers").default(0),
    uniqueSellers: integer("unique_sellers").default(0),
    volume30d: decimal("volume_30d", { precision: 20, scale: 6 }).default("0"),
    txCount30d: bigint("tx_count_30d", { mode: "number" }).default(0),
    buyers30d: integer("buyers_30d").default(0),

    rankerScore: decimal("ranker_score", { precision: 10, scale: 4 }).default("0"),
    rankPosition: integer("rank_position"),
    categoryId: uuid("category_id").references(() => categories.id),

    metadata: jsonb("metadata").default({}),
  },
  (table) => ({
    idxMerchantsCategory: index("idx_merchants_category").on(table.categoryId),
    idxMerchantsScore: index("idx_merchants_score").on(table.rankerScore),
  }),
);

export const resources = pgTable(
  "resources",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    resourceUrl: text("resource_url").notNull().unique(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id),
    originId: uuid("origin_id"),
    serviceName: text("service_name"),
    description: text("description"),
    tags: text("tags").array(),
    hasInputSchema: boolean("has_input_schema").default(false),
    hasOutputExample: boolean("has_output_example").default(false),
    toolCalls: integer("tool_calls").default(0),
    priceUsd: decimal("price_usd", { precision: 20, scale: 6 }),
    chain: text("chain"),

    l30dCalls: integer("l30d_calls"),
    l30dUniquePayers: integer("l30d_unique_payers"),
    lastCalledAt: timestamp("last_called_at", { withTimezone: true }),
    overallScore: decimal("overall_score", { precision: 5, scale: 4 }),
    volumeScore: decimal("volume_score", { precision: 5, scale: 4 }),
    recencyScore: decimal("recency_score", { precision: 5, scale: 4 }),
    performanceScore: decimal("performance_score", { precision: 5, scale: 4 }),
    reliabilityScore: decimal("reliability_score", { precision: 5, scale: 4 }),
    avgLatencyMs: integer("avg_latency_ms"),
    apiSuccessRate: decimal("api_success_rate", { precision: 5, scale: 4 }),

    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull().defaultNow(),
    lastUpdated: timestamp("last_updated", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    idxResourcesMerchant: index("idx_resources_merchant").on(table.merchantId),
    idxResourcesTags: index("idx_resources_tags").using("gin", table.tags),
  }),
);

export const trends = pgTable(
  "trends",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id),
    snapshotDate: date("snapshot_date").notNull(),
    rankPosition: integer("rank_position"),
    rankerScore: decimal("ranker_score", { precision: 10, scale: 4 }),
    txCount30d: bigint("tx_count_30d", { mode: "number" }),
    uniqueBuyers: integer("unique_buyers"),
    totalAmount: decimal("total_amount", { precision: 20, scale: 6 }),
  },
  (table) => ({
    trendsMerchantDate: unique("trends_merchant_date").on(table.merchantId, table.snapshotDate),
    idxTrendsMerchantDate: index("idx_trends_merchant_date").on(table.merchantId, table.snapshotDate),
  }),
);

export const reports = pgTable(
  "reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    requesterWallet: text("requester_wallet").notNull(),
    reportType: text("report_type").notNull(),
    inputParams: jsonb("input_params"),
    costUsdc: decimal("cost_usdc", { precision: 10, scale: 6 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    idxReportsWallet: index("idx_reports_wallet").on(table.requesterWallet),
  }),
);

export const categoryCache = pgTable("category_cache", {
  id: uuid("id").primaryKey().defaultRandom(),
  categoryName: text("category_name").notNull().unique(),
  merchantCount: integer("merchant_count"),
  totalVolume30d: decimal("total_volume_30d", { precision: 20, scale: 6 }),
  medianPrice: decimal("median_price", { precision: 20, scale: 6 }),
  avgBuyers: decimal("avg_buyers", { precision: 10, scale: 2 }),
  topMerchants: jsonb("top_merchants"),
  refreshedAt: timestamp("refreshed_at", { withTimezone: true }).notNull().defaultNow(),
});

export const supplyGapCache = pgTable("supply_gap_cache", {
  id: uuid("id").primaryKey().defaultRandom(),
  categoryName: text("category_name").notNull().unique(),
  perQuery: jsonb("per_query").notNull(),
  averageGapRatio: decimal("average_gap_ratio", { precision: 5, scale: 4 }),
  buriedMerchantCount: integer("buried_merchant_count").default(0),
  totalCategoryMerchants: integer("total_category_merchants").default(0),
  refreshedAt: timestamp("refreshed_at", { withTimezone: true }).notNull().defaultNow(),
});

// Relations

export const categoriesRelations = relations(categories, ({ many }) => ({
  merchants: many(merchants),
}));

export const merchantsRelations = relations(merchants, ({ one, many }) => ({
  category: one(categories, {
    fields: [merchants.categoryId],
    references: [categories.id],
  }),
  resources: many(resources),
  trends: many(trends),
}));

export const resourcesRelations = relations(resources, ({ one }) => ({
  merchant: one(merchants, {
    fields: [resources.merchantId],
    references: [merchants.id],
  }),
}));

export const trendsRelations = relations(trends, ({ one }) => ({
  merchant: one(merchants, {
    fields: [trends.merchantId],
    references: [merchants.id],
  }),
}));
