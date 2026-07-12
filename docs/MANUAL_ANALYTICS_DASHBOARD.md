# decipher-ranker — Analytics Dashboard Local Run Manual

How to run, browse, and develop the public analytics dashboard locally.

---

## Prerequisites

- **Node.js 18+** (recommended: 20 LTS)
- **PostgreSQL** — local instance or hosted Neon database
- **Seeded database** — the dashboard reads from Postgres; an empty database shows empty pages

> The dashboard shares the same Next.js app as the x402 service. If you've already followed `MANUAL_x402_SERVICE.md` steps 1-4, skip to **Step 3** below.

---

## 1. Install and Configure

```bash
git clone https://github.com/zaryab2000/decipher-ranker.git
cd decipher-ranker
npm install
```

Copy the example env file:

```bash
cp .env.example .env.local
```

Minimum `.env.local` for the dashboard:

```bash
# PostgreSQL connection string (required)
POSTGRES_URL=postgresql://postgres:password@localhost:5432/decipher_ranker

# KV — not needed for dashboard pages (only used by x402scan API calls)
KV_REST_API_URL=mock://test
KV_REST_API_TOKEN=mock-token

# Cron secret — needed to seed data (Step 2)
CRON_SECRET=my-local-secret

# App URL
BASE_URL=http://localhost:3000
```

---

## 2. Set Up the Database and Seed Data

```bash
# Push schema to Postgres
npm run db:push

# Start the dev server
npm run dev

# In another terminal, trigger the seed pipeline
curl -H "Authorization: Bearer my-local-secret" http://localhost:3000/api/cron/refresh-catalog
```

The seed pipeline takes 2-3 minutes. It fetches ~24k resources from the Coinbase Bazaar API (free, no auth), upserts merchants and categories, computes ranker scores, and writes trend snapshots.

Once seeded, all dashboard pages will populate with real data.

---

## 3. Start the Dev Server

```bash
npm run dev
```

Open your browser to `http://localhost:3000/dashboard`.

---

## 4. Dashboard Pages

### Homepage — `/dashboard`

The ecosystem overview. Shows:
- **Hero stat cards**: total merchants, total categories, total transactions, top category
- **Top 10 merchants** by ranker score (mini leaderboard table)
- **Recently updated** merchants (last 5 with new data)

### Leaderboard — `/dashboard/leaderboard`

Full ranked table of all merchants. Supports:
- **Category filter**: `?category=api` — filter by category name
- **Sort**: `?sortBy=score` (default), `txCount`, `price`, `rank`
- **Sort order**: `?sortOrder=desc` (default) or `asc`
- **Pagination**: `?page=2&perPage=50`

Example URL with filters:
```
http://localhost:3000/dashboard/leaderboard?category=data-enrichment&sortBy=txCount&sortOrder=desc&page=1
```

### Category Explorer — `/dashboard/categories`

Grid of category cards showing:
- Category name and merchant count
- Average ranker score
- Top merchant in the category
- Median price

### Category Detail — `/dashboard/categories/[slug]`

Click any category card to see its detail page:
- Category-level metrics (merchant count, avg score, median price, total 30d volume)
- **Score distribution chart** — histogram of ranker scores within the category
- Full merchant table filtered to that category

Example: `http://localhost:3000/dashboard/categories/api`

### Merchant Profile — `/dashboard/merchant/[origin]`

Deep-dive on a single merchant. The `[origin]` parameter is the URL-encoded resource URL.

Shows:
- Merchant header: origin URL, category badge, rank badge, chain
- **Score breakdown chart** — horizontal bars for volume, buyer diversity, reliability, listing quality, recency
- Metric cards: rank position, price, tx volume, unique buyers
- **Top 5 competitors** in the same category with comparison data
- **Improvement suggestions** with priority tags (high/medium/low)

Example: `http://localhost:3000/dashboard/merchant/https%3A%2F%2Fmesh.heurist.xyz`

### Search — `/dashboard/search?q=...`

Full-text search across merchant addresses, resource URLs, service names, and descriptions.

Example: `http://localhost:3000/dashboard/search?q=heurist`

---

## 5. Architecture — How the Dashboard Works

### Data flow

```
Daily cron (refresh-catalog)
  → Fetches from Coinbase Bazaar API
  → Upserts merchants, resources, categories into Postgres
  → Computes ranker scores
  → Writes daily trend snapshots

Dashboard pages (Server Components)
  → Call internal service functions (src/dashboard/lib/api.ts)
  → Query Postgres directly via Drizzle ORM
  → Render HTML server-side
```

The dashboard **never** makes upstream API calls at render time. All data comes from the daily Postgres snapshot populated by the cron pipeline.

### Key principle: zero cost per pageview

Dashboard pages import service functions directly — they don't call the x402 API over HTTP. This means dashboard traffic doesn't consume x402scan credits or trigger rate limits.

### Component structure

```
src/dashboard/
  components/
    layout/
      DashboardShell.tsx    ← Main layout wrapper (sidebar + header + content area)
      Sidebar.tsx           ← Navigation sidebar (Home, Leaderboard, Categories, Search)
      Header.tsx            ← Top bar with breadcrumb and search
    homepage/
      HeroStats.tsx         ← 4 stat cards (merchants, categories, txns, top category)
      TopGainersTable.tsx   ← Top 10 merchants table
      RecentUpdates.tsx     ← Recently updated merchants list
    leaderboard/
      LeaderboardTable.tsx  ← Full ranked table with sortable columns
      FilterBar.tsx         ← Category dropdown + sort controls
    categories/
      CategoryCard.tsx      ← Single category card
      CategoryList.tsx      ← Grid of category cards
      ScoreDistributionChart.tsx ← Recharts histogram for category detail
    merchant/
      MerchantHeader.tsx    ← Origin URL, badges, chain info
      ScoreBreakdownChart.tsx ← Recharts horizontal bar chart
      CompetitorList.tsx    ← Top 5 competitors comparison table
      MetricCard.tsx        ← Single metric display (rank, price, volume, etc.)
    search/
      SearchBar.tsx         ← Search input component
      SearchResults.tsx     ← Search results list
    shared/
      Badge.tsx             ← Category/chain/priority badges
      Card.tsx              ← Reusable card wrapper
      RankBadge.tsx         ← Rank position display
      ScoreBar.tsx          ← Horizontal score bar (0-1 scale)
      Pagination.tsx        ← Page navigation
      Table.tsx             ← Reusable table component
      Skeleton.tsx          ← Loading skeleton placeholders
  lib/
    api.ts                  ← All data-fetching functions (imports Drizzle directly)
  types/
    index.ts                ← Dashboard-specific TypeScript types
```

### Page routes

```
src/app/dashboard/
  layout.tsx                ← Wraps all pages in DashboardShell
  page.tsx                  ← Homepage
  leaderboard/page.tsx      ← Leaderboard
  categories/page.tsx       ← Category list
  categories/[slug]/page.tsx ← Category detail
  merchant/[origin]/page.tsx ← Merchant profile
  search/page.tsx           ← Search results
```

---

## 6. Design System

- **Theme**: Dark background (`gray-900`/`gray-950`) with light text
- **Score colors**: Emerald for high scores, amber for medium, red for low
- **Charts**: Recharts library (bar charts, area charts)
- **Styling**: Tailwind CSS 4 utility classes
- **Layout**: Sidebar navigation + header + main content area
- **Responsive**: Grid layouts collapse on mobile

---

## 7. Refreshing Data

The dashboard shows whatever is in Postgres. To get fresh data:

```bash
# Re-run the full pipeline
curl -H "Authorization: Bearer my-local-secret" http://localhost:3000/api/cron/refresh-catalog
```

In production, this runs as a Vercel cron job (daily). Locally, trigger it manually whenever you want updated data.

---

## 8. Running Tests

```bash
# All tests (includes both x402 service and dashboard tests)
npm test

# Watch mode
npm run test:watch

# Type-check
npm run typecheck
```

---

## Troubleshooting

**Dashboard pages show empty/no data** — You need to seed the database first (Step 2). The dashboard reads from Postgres, which starts empty.

**"Cannot connect to database" on page load** — Check `POSTGRES_URL` in `.env.local`. Dashboard pages query Postgres on every render.

**Category detail page returns 404** — The `[slug]` is generated from the category name (lowercase, spaces replaced with hyphens). Check `/dashboard/categories` first to see available slugs.

**Merchant profile page shows "not found"** — The `[origin]` parameter must be URL-encoded. Use the search page to find merchants, then click through to their profile.

**Charts not rendering** — Recharts is installed as a dependency. If you see errors, run `npm install` again to ensure all dependencies are present.
