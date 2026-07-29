CREATE TABLE "supply_gap_cache" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category_name" text NOT NULL,
	"per_query" jsonb NOT NULL,
	"average_gap_ratio" numeric(5, 4),
	"buried_merchant_count" integer DEFAULT 0,
	"total_category_merchants" integer DEFAULT 0,
	"refreshed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "supply_gap_cache_category_name_unique" UNIQUE("category_name")
);
