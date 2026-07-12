# decipher-ranker — x402 Service Local Run Manual

How to run, test, and interact with the decipher-ranker x402 API service on your local machine.

---

## Prerequisites

- **Node.js 18+** (recommended: 20 LTS)
- **PostgreSQL** — local instance or a hosted Neon database
- **Redis** (optional) — only needed for x402scan caching; can skip for basic local dev

---

## 1. Clone and Install

```bash
git clone https://github.com/zaryab2000/decipher-ranker.git
cd decipher-ranker
npm install
```

---

## 2. Environment Setup

Copy the example env file and fill in the required values:

```bash
cp .env.example .env.local
```

### Minimum required variables for local dev

```bash
# .env.local

# Your PostgreSQL connection string
# Option A: Local Postgres
POSTGRES_URL=postgresql://postgres:password@localhost:5432/decipher_ranker

# Option B: Neon free-tier (recommended — matches production)
# Sign up at https://neon.tech, create a project, copy the connection string
POSTGRES_URL=postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require

# KV (Redis) — needed for x402scan caching
# Option A: Skip it (x402scan calls will fail gracefully, Bazaar data still works)
KV_REST_API_URL=mock://test
KV_REST_API_TOKEN=mock-token

# Option B: Upstash free-tier (recommended)
# Sign up at https://upstash.com, create a Redis database, copy REST credentials
KV_REST_API_URL=https://xxx.upstash.io
KV_REST_API_TOKEN=AXxx...

# Cron secret (any random string — used to auth the cron endpoint)
CRON_SECRET=my-local-secret

# App URL
BASE_URL=http://localhost:3000
```

### Variables NOT needed for local dev (needed for deployment only)

These are for x402 payment integration — the routes work without them, they just won't have payment gates:

```
EVM_PAYEE_ADDRESS    — Your merchant wallet address
CDP_API_KEY_ID       — Coinbase Developer Platform key
CDP_API_KEY_SECRET   — CDP secret
MPP_SECRET_KEY       — MPP protocol secret
MPP_OPERATOR_KEY     — MPP operator private key
```

---

## 3. Database Setup

### Generate and apply the schema

```bash
# Generate migration files from the Drizzle schema
npm run db:generate

# Push schema directly to the database (fastest for local dev)
npm run db:push
```

### Verify with Drizzle Studio (optional)

```bash
npm run db:studio
```

Opens a browser UI at `https://local.drizzle.studio` where you can inspect tables and data.

---

## 4. Seed Data from Bazaar API

The database starts empty. To populate it with real x402 ecosystem data, trigger the cron refresh pipeline:

```bash
# Start the dev server first
npm run dev

# In another terminal, trigger the cron endpoint
curl -H "Authorization: Bearer my-local-secret" http://localhost:3000/api/cron/refresh-catalog
```

This runs the full pipeline:
1. Fetches all resources from Coinbase Bazaar API (free, ~24k resources, takes 2-3 minutes)
2. Upserts merchants, resources, and categories into Postgres
3. Assigns categories to merchants based on resource tags
4. Computes ranker scores for all merchants
5. Refreshes category cache aggregations
6. Writes daily trend snapshot

The response will look like:

```json
{
  "status": "ok",
  "resourcesFetched": 24559,
  "catalogResult": { "merchantsUpserted": 1200, "resourcesUpserted": 24559, "categoriesUpdated": 45 },
  "categorized": 950,
  "scored": 1200,
  "snapshots": 1200
}
```

---

## 5. Start the Dev Server

```bash
npm run dev
```

The server starts at `http://localhost:3000`.

---

## 6. API Endpoints — How to Call Them

### Free endpoints (no auth needed)

**GET /api/categories** — Browse all categories

```bash
curl http://localhost:3000/api/categories | jq
```

**GET /api/leaderboard** — Top merchants by score

```bash
# Default: top 50
curl http://localhost:3000/api/leaderboard | jq

# Filter by category
curl "http://localhost:3000/api/leaderboard?category=api" | jq

# Custom limit
curl "http://localhost:3000/api/leaderboard?limit=10" | jq
```

### Report endpoints

These are currently open (no payment gate). In production they will require SIWX/x402 auth.

**POST /api/report/origin** — Basic rank report (free in production, SIWX auth)

```bash
curl -X POST http://localhost:3000/api/report/origin \
  -H "Content-Type: application/json" \
  -d '{"origin": "https://mesh.heurist.xyz"}' | jq
```

Response includes: category, rank position, total competitors, price position, description quality score, listing completeness score, and 3 actionable tips.

**POST /api/report/competitive** — Competitive deep-dive ($0.03 in production)

```bash
curl -X POST http://localhost:3000/api/report/competitive \
  -H "Content-Type: application/json" \
  -d '{"origin": "https://mesh.heurist.xyz"}' | jq
```

Response includes: top 10 competitors, gap analysis (missing tags + keywords), pricing benchmark (your price vs category median/min/max), strategic recommendations.

**POST /api/report/merchant** — Merchant deep-dive ($0.03 in production)

```bash
curl -X POST http://localhost:3000/api/report/merchant \
  -H "Content-Type: application/json" \
  -d '{"address": "0xe9030014f5dae217d0a152f02a043567b16c1abf", "chain": "base"}' | jq
```

Response includes: volume stats (total tx, 30d tx, volume), buyer stats (unique buyers, concentration, diversity score), pricing, trend history, recommendations.

---

## 7. How the Scoring Algorithm Works

Each merchant gets a **decipher-ranker Score** from 0.0 to 1.0:

```
Score = 0.30 × volumeSignal
      + 0.25 × buyerDiversity
      + 0.15 × reliability
      + 0.15 × listingQuality
      + 0.15 × recency
```

| Signal | Weight | What it measures |
|--------|--------|-----------------|
| Volume | 30% | Log-normalized 30d tx count |
| Buyer Diversity | 25% | Log-normalized unique buyer count |
| Reliability | 15% | API success rate from Bazaar quality data |
| Listing Quality | 15% | Description length, tags, schema completeness |
| Recency | 15% | Days since last API call |

The score is fully transparent — every component is computed from public Bazaar API data.

---

## 8. Running Tests

```bash
# Run all 190 tests
npm test

# Watch mode (re-runs on file changes)
npm run test:watch

# Type-check
npm run typecheck
```

---

## 9. What's Not Wired Yet (x402 Payment Integration)

The route handlers work as plain HTTP endpoints. To make them real x402 services with payment gates, the following needs to happen:

1. **Create `src/lib/router.ts`** — initialize `@agentcash/router` with `createRouterFromEnv()`
2. **Create `src/lib/routes-barrel.ts`** — import all route files for side-effect registration
3. **Rewrite route files** to use `router.route().paid('0.03')` / `.siwx()` / `.unprotected()`
4. **Wire discovery endpoints** — replace `.gitkeep` files in `openapi.json/`, `.well-known/x402/`, `llms.txt/` with actual route handlers

This requires:
- Your **EVM wallet address** (receives payments)
- **CDP API credentials** from https://portal.cdp.coinbase.com
- **MPP_SECRET_KEY** (generated with `openssl rand -hex 32`)

Once those are provided, the integration can be built.

---

## 10. Project Structure (x402 Service Files)

```
src/lib/
  analytics/
    ranker.ts          ← Core scoring engine + report generators
    categorizer.ts     ← Tag-to-category assignment
    comparator.ts      ← Competitive gap analysis
  data-sources/
    bazaar.ts          ← Coinbase Bazaar API client (free)
    x402scan.ts        ← x402scan API client (paid, cached)
    catalog-sync.ts    ← Bazaar → Postgres sync pipeline
  services/
    rankService.ts     ← Leaderboard queries
    merchantService.ts ← Search + merchant profiles
    categoryService.ts ← Category queries + cache refresh
    statsService.ts    ← Ecosystem-level stats
    trendService.ts    ← Daily trend snapshots
  db/
    schema.ts          ← Drizzle schema (6 tables)
    index.ts           ← DB client
  cache.ts             ← Vercel KV (Redis) wrapper
  config.ts            ← REPORT_COST_USDC = "0.03"
  types.ts             ← Shared TypeScript types

src/app/api/
  categories/route.ts           ← GET  /api/categories
  leaderboard/route.ts          ← GET  /api/leaderboard
  cron/refresh-catalog/route.ts ← GET  /api/cron/refresh-catalog
  report/origin/route.ts        ← POST /api/report/origin
  report/competitive/route.ts   ← POST /api/report/competitive
  report/merchant/route.ts      ← POST /api/report/merchant
```

---

## Troubleshooting

**"Cannot connect to database"** — Check your `POSTGRES_URL` in `.env.local`. For local Postgres, make sure the service is running and the database exists (`createdb decipher_ranker`).

**Cron endpoint returns 401** — Make sure the `Authorization: Bearer <token>` header matches your `CRON_SECRET` env var exactly.

**Empty leaderboard/categories** — You need to seed data first (Step 4). The database starts empty.

**x402scan calls fail** — These require a funded AgentCash wallet and valid KV credentials. For local dev, the Bazaar data alone is sufficient for all analytics features.
