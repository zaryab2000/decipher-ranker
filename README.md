# decipher-ranker

**The merchant intelligence platform for the x402 micropayment ecosystem.**

Rankings, competitive analysis, and actionable insights for every API provider in the x402 marketplace. Free basic reports. Paid deep dives ($0.03 USDC). All powered by a proprietary scoring formula that no merchant portal provides.

## The Problem

x402 merchants list their APIs on marketplaces like Coinbase Bazaar — but have zero visibility into their competitive position. No analytics. No benchmarks. No way to know if they're overpriced, underperforming, or invisible.

The marketplace provides raw call counts and nothing else.

## What decipher-ranker Provides

|                              | Coinbase Bazaar               | decipher-ranker                                                       |
| ---------------------------- | ----------------------------- | --------------------------------------------------------------------- |
| **Ranking**                  | Flat catalog with no ordering | Ranked leaderboard by decipher score                                  |
| **Categories**               | Raw tags, no structure        | Structured categories with merchant counts and median pricing         |
| **Competitive intelligence** | None                          | Top-10 competitors with gap analysis (missing tags, missing keywords) |
| **Pricing benchmarks**       | Raw atomic amounts            | Your price vs category median, minimum, maximum, percentile           |
| **Buyer insights**           | 30d unique payer count        | Buyer diversity score, concentration risk (HHI-derived)               |
| **Trend history**            | None                          | 30-day time-series of rank and score changes                          |
| **Recommendations**          | None                          | Algorithmic tips based on actual gaps vs competitors                  |

## Architecture

```
Coinbase Bazaar API                     decipher-ranker
+----------------------------+         +--------------------------------+
| Raw resource catalog       |         | 6-stage Data Pipeline          |
| - resource URL             | ------> |                                |
| - tags                     |         | 1. fetchAllBazaarResources     |
| - accept amounts (atomic)  |         | 2. upsertCatalog               |
| - l30d calls / payers      |         | 3. assignAllMerchantCategories |
+----------------------------+         | 4. scoreAllMerchants (RANKER)  |
                                       | 5. refreshCategoryCache        |
                                       | 6. writeDailySnapshot          |
                                       +--------------------------------+
                                                  |
                                                  v
                                       +--------------------------------+
                                       | Neon Postgres                  |
                                       | merchants, resources,          |
                                       | categories, trends, reports    |
                                       +--------------------------------+
                                          |                    |
                                          v                    v
                              +---------------+     +-----------------+
                              | Public API    |     | Dashboard       |
                              | (x402/SIWX)   |     | (direct DB)     |
                              +---------------+     +-----------------+
```

The **ranker score** formula that powers every ranking and report:

```
0.30·volume + 0.25·buyerDiversity + 0.15·reliability + 0.15·listingQuality + 0.15·recency
```

Each component maps to an action a merchant can take: drive more volume, diversify buyers, maintain uptime, write better descriptions, stay active. The dashboard makes every component visible and explainable.

## Quick Start

```bash
# Clone and install
git clone https://github.com/zaryab2000/decipher-ranker-dev.git
cd decipher-ranker-dev
npm install

# Configure environment
cp .env.example .env.local
# Fill in: POSTGRES_URL, KV_REST_API_URL, KV_REST_API_TOKEN,
#          CDP_API_KEY_ID, CDP_API_KEY_SECRET, EVM_PAYEE_ADDRESS,
#          BASE_URL, CRON_SECRET

# Seed the database from Coinbase Bazaar (~5 min)
npm run seed

# Start dev server
npm run dev
```

The dev server starts at `http://localhost:3000`. Free endpoints are available immediately:

```bash
curl http://localhost:3000/api/categories
curl "http://localhost:3000/api/leaderboard?limit=10"
```

## API Endpoints

| Endpoint                    | Method | Auth   | Cost  | Description                                                        |
| --------------------------- | ------ | ------ | ----- | ------------------------------------------------------------------ |
| `/api/categories`           | GET    | None   | Free  | All categories with merchant counts and top-3 merchants            |
| `/api/leaderboard`          | GET    | None   | Free  | Top N merchants ranked by decipher score                           |
| `/api/report/origin`        | POST   | SIWX   | Free  | Basic report: rank, price position, listing quality, tips          |
| `/api/report/competitive`   | POST   | x402   | $0.03 | Full competitive analysis with gap analysis and pricing benchmarks |
| `/api/report/merchant`      | POST   | x402   | $0.03 | Merchant deep-dive: volume, buyers, trends, concentration risk     |
| `/api/cron/refresh-catalog` | GET    | Bearer | —     | Trigger full pipeline refresh                                      |
| `/openapi.json`             | GET    | None   | —     | Auto-generated OpenAPI 3.1 spec                                    |
| `/.well-known/x402`         | GET    | None   | —     | x402 service descriptor                                            |
| `/llms.txt`                 | GET    | None   | —     | LLM-readable service summary                                       |

Full endpoint schemas and response shapes: [`docs/architecture/decipher-ranker-x402-service.md`](docs/architecture/decipher-ranker-x402-service.md)

## Build and Test

```bash
npm run dev          # Next.js dev server
npm run build        # Production build
npm run lint         # ESLint (next lint)
npm run typecheck    # tsc --noEmit
npm test             # vitest run (196 tests)
npm run test:watch   # vitest in watch mode
```

## Registry Listings

decipher-ranker is registered in both agent-payment ecosystems:

| Registry | Listing URL | Protocols |
|---|---|---|
| **x402scan** | https://www.x402scan.com/server/d683a3a0-e920-4ebb-9f5d-2f3e0fe25803 | x402 (USDC on Base) |
| **MPPscan** | https://www.mppscan.com/server/a7118bdd8bcabdab2587bdd7c01e58c8fe31ceb50932a7fc3db81cfcbf549bfa | MPP (USDC on Tempo) |

Install on any AgentCash-compatible client:

```bash
npx agentcash add https://decipherranker.com
```

## License

MIT
