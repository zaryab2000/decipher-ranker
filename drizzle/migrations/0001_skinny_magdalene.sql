ALTER TABLE "categories" ALTER COLUMN "median_price" SET DATA TYPE numeric(20, 6);--> statement-breakpoint
ALTER TABLE "category_cache" ALTER COLUMN "median_price" SET DATA TYPE numeric(20, 6);--> statement-breakpoint
ALTER TABLE "resources" ALTER COLUMN "price_usd" SET DATA TYPE numeric(20, 6);