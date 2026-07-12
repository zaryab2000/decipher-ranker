CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"color" text,
	"description" text,
	"merchant_count" integer DEFAULT 0,
	"median_price" numeric(10, 6),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "categories_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "category_cache" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category_name" text NOT NULL,
	"merchant_count" integer,
	"total_volume_30d" numeric(20, 6),
	"median_price" numeric(10, 6),
	"avg_buyers" numeric(10, 2),
	"top_merchants" jsonb,
	"refreshed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "category_cache_category_name_unique" UNIQUE("category_name")
);
--> statement-breakpoint
CREATE TABLE "merchants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payee_address" text NOT NULL,
	"facilitator" text,
	"chain" text DEFAULT 'base' NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_updated" timestamp with time zone DEFAULT now() NOT NULL,
	"tx_count" bigint DEFAULT 0,
	"total_amount_usd" numeric(20, 6) DEFAULT '0',
	"unique_buyers" integer DEFAULT 0,
	"unique_sellers" integer DEFAULT 0,
	"volume_30d" numeric(20, 6) DEFAULT '0',
	"tx_count_30d" bigint DEFAULT 0,
	"buyers_30d" integer DEFAULT 0,
	"ranker_score" numeric(10, 4) DEFAULT '0',
	"rank_position" integer,
	"category_id" uuid,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	CONSTRAINT "merchants_payee_address_unique" UNIQUE("payee_address")
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"requester_wallet" text NOT NULL,
	"report_type" text NOT NULL,
	"input_params" jsonb,
	"cost_usdc" numeric(10, 6),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"resource_url" text NOT NULL,
	"merchant_id" uuid NOT NULL,
	"origin_id" uuid,
	"service_name" text,
	"description" text,
	"tags" text[],
	"tool_calls" integer DEFAULT 0,
	"price_usd" numeric(10, 6),
	"chain" text,
	"l30d_calls" integer,
	"l30d_unique_payers" integer,
	"last_called_at" timestamp with time zone,
	"overall_score" numeric(5, 4),
	"volume_score" numeric(5, 4),
	"recency_score" numeric(5, 4),
	"performance_score" numeric(5, 4),
	"reliability_score" numeric(5, 4),
	"avg_latency_ms" integer,
	"api_success_rate" numeric(5, 4),
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_updated" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "resources_resource_url_unique" UNIQUE("resource_url")
);
--> statement-breakpoint
CREATE TABLE "trends" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"snapshot_date" date NOT NULL,
	"rank_position" integer,
	"ranker_score" numeric(10, 4),
	"tx_count_30d" bigint,
	"unique_buyers" integer,
	"total_amount" numeric(20, 6),
	CONSTRAINT "trends_merchant_date" UNIQUE("merchant_id","snapshot_date")
);
--> statement-breakpoint
ALTER TABLE "merchants" ADD CONSTRAINT "merchants_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resources" ADD CONSTRAINT "resources_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trends" ADD CONSTRAINT "trends_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_merchants_category" ON "merchants" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "idx_merchants_score" ON "merchants" USING btree ("ranker_score");--> statement-breakpoint
CREATE INDEX "idx_reports_wallet" ON "reports" USING btree ("requester_wallet");--> statement-breakpoint
CREATE INDEX "idx_resources_merchant" ON "resources" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "idx_resources_tags" ON "resources" USING gin ("tags");--> statement-breakpoint
CREATE INDEX "idx_trends_merchant_date" ON "trends" USING btree ("merchant_id","snapshot_date");