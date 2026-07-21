-- Add categories.slug. Done in three steps so the migration is safe against an
-- already-populated table (the pre-taxonomy `categories` holds one row per tag):
-- 1) add nullable, 2) backfill a slug from name (dedup collisions with the id
-- suffix so the UNIQUE constraint holds), 3) enforce NOT NULL + UNIQUE.
-- The taxonomy seed (upsertTaxonomyCategories) later reconciles the table to the
-- 13 curated rows regardless of what these legacy slugs were.
ALTER TABLE "categories" ADD COLUMN "slug" text;--> statement-breakpoint
UPDATE "categories" c
SET "slug" = regexp_replace(lower(c."name"), '[^a-z0-9]+', '-', 'g')
WHERE "slug" IS NULL;--> statement-breakpoint
-- Disambiguate any slug collisions among legacy rows before adding UNIQUE.
UPDATE "categories" c
SET "slug" = c."slug" || '-' || substr(c."id"::text, 1, 8)
WHERE EXISTS (
  SELECT 1 FROM "categories" d
  WHERE d."slug" = c."slug" AND d."id" <> c."id"
);--> statement-breakpoint
ALTER TABLE "categories" ALTER COLUMN "slug" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_slug_unique" UNIQUE("slug");
