# Graph Report - .  (2026-08-14)

## Corpus Check
- 197 files · ~84,952 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 887 nodes · 2035 edges · 53 communities (46 shown, 7 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 29 edges (avg confidence: 0.74)
- Token cost: 73,085 input · 0 output

## Community Hubs (Navigation)
- Listing Quality Analytics
- Leaderboard Page & Dashboard Data Layer
- Ingest Pipeline & Categorizer
- Categories Page Components
- Dev Tooling Dependencies
- Description & Tag Quality Scoring
- Marketing Landing Page
- Shared Table & Badge Components
- Runtime Dependencies
- TypeScript Compiler Config
- Drizzle Mock Chain Test Harness
- Dashboard Shell & Navigation
- Test Fixtures & Factories
- Merchant Profile Widgets
- Free Routes & Rate Limiting
- Paid Report Route Tests
- Cockpit Home & Claim Flow
- Paid Routes & Discovery Endpoints
- Dynamic Detail Pages
- Drizzle Schema & Leaderboard Route
- Merchant Service Tests
- Loading Skeletons
- Merchant Lookup & DB Client
- Router Auth & Fail-Open Layers
- Ranker Score Components
- Preview Endpoint
- Rank Service
- Error Boundaries
- Category Trends & Growth
- Categorizer Tests
- Ranker DB Tests
- Ingest Normalization Gotchas
- Leaderboard Route Tests
- Category Service Tests
- Rate Limit Tests
- AI Analyst & Competitive Report
- Pipeline Orchestration & Cron
- Batch Scoring & Rank Assignment
- x402scan Payment Client Tests
- Product Thesis & CI
- ESLint Config
- Competitor Gap Analysis
- Schema & Cache Snapshot Stages
- Score Distribution Chart
- Root Layout
- Next Config
- PostCSS Config
- Vercel Cron Config

## God Nodes (most connected - your core abstractions)
1. `getDb()` - 60 edges
2. `toDisplayScore()` - 29 edges
3. `displayName()` - 19 edges
4. `resetIdCounter()` - 18 edges
5. `computeBasicReport()` - 18 edges
6. `formatNumber()` - 16 edges
7. `TAXONOMY` - 16 edges
8. `cached()` - 16 edges
9. `compilerOptions` - 16 edges
10. `fetchMerchantByOrigin()` - 15 edges

## Surprising Connections (you probably didn't know these)
- `GitHub Actions cron fallback for pipeline` --semantically_similar_to--> `GET /api/cron/refresh-catalog endpoint`  [INFERRED] [semantically similar]
  .github/workflows/cron-refresh.yml → docs/architecture/decipher-ranker-x402-service.md
- `Daily Data Refresh job` --shares_data_with--> `Postgres schema (merchants, resources, categories, category_cache, trends, reports)`  [INFERRED]
  .github/workflows/cron-refresh.yml → docs/architecture/decipher-ranker-x402-service.md
- `Ranker score formula` --references--> `computeRankerScore`  [EXTRACTED]
  README.md → docs/architecture/decipher-ranker-x402-service.md
- `Registry listings (x402scan, MPPscan)` --conceptually_related_to--> `x402scan outbound payment client`  [INFERRED]
  README.md → docs/architecture/decipher-ranker-x402-service.md
- `truncateAll()` --calls--> `getDb()`  [EXTRACTED]
  scripts/run-pipeline.ts → src/lib/db/index.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Six-stage data pipeline in strict order** — docs_architecture_decipher_ranker_x402_service_fetchallbazaarresources, docs_architecture_decipher_ranker_x402_service_upsertcatalog, docs_architecture_decipher_ranker_x402_service_assignallmerchantcategories, docs_architecture_decipher_ranker_x402_service_scoreallmerchants, docs_architecture_decipher_ranker_x402_service_refreshcategorycache, docs_architecture_decipher_ranker_x402_service_writedailysnapshot [EXTRACTED 1.00]
- **Five weighted ranker score components summing to 1.0** — docs_architecture_decipher_ranker_x402_service_volume_signal, docs_architecture_decipher_ranker_x402_service_buyer_diversity, docs_architecture_decipher_ranker_x402_service_computereliability, docs_architecture_decipher_ranker_x402_service_computelistingqualityforresource, docs_architecture_decipher_ranker_x402_service_recency, docs_architecture_decipher_ranker_x402_service_computerankerscore [EXTRACTED 1.00]
- **Optional layers that degrade to null rather than blocking a report** — docs_architecture_decipher_ranker_x402_service_ai_analyst, docs_architecture_decipher_ranker_x402_service_x402scan_client, docs_architecture_decipher_ranker_x402_service_rate_limiting, claude_fail_open_optional_layers, docs_architecture_decipher_ranker_x402_service_kv_store [INFERRED 0.95]

## Communities (53 total, 7 thin omitted)

### Community 0 - "Listing Quality Analytics"
Cohesion: 0.06
Nodes (64): AIInsightsInput, buildPrompt(), callOpenCode(), computeAIInsights(), extractJson(), originHost(), parseInsights(), ActionItem (+56 more)

### Community 1 - "Leaderboard Page & Dashboard Data Layer"
Cohesion: 0.06
Nodes (59): LeaderboardPage(), metadata, Props, revalidate, SearchResultsWithData(), FilterBar(), buildHref(), Pagination() (+51 more)

### Community 2 - "Ingest Pipeline & Categorizer"
Cohesion: 0.09
Nodes (40): log(), main(), runPipeline(), startedAt, truncateAll(), dynamic, GET(), assignAllMerchantCategories() (+32 more)

### Community 3 - "Categories Page Components"
Cohesion: 0.08
Nodes (33): CategoriesPage(), COUNT_WORDS, metadata, revalidate, CategoriesEmptyState(), CategoryRow(), CategoryTable(), GrowthChip() (+25 more)

### Community 4 - "Dev Tooling Dependencies"
Cohesion: 0.04
Nodes (45): drizzle-kit, eslint, eslint-config-next, @eslint/eslintrc, description, devDependencies, drizzle-kit, eslint (+37 more)

### Community 5 - "Description & Tag Quality Scoring"
Cohesion: 0.11
Nodes (37): computeCategoryKeywordPresence(), computeDescriptionQualityScore(), computeFluffScore(), computeKeywordDensity(), computeStructuralSpecificity(), FIRST_PERSON_PRONOUNS, hasWordBoundaryMatch(), MARKETING_BUZZWORDS (+29 more)

### Community 6 - "Marketing Landing Page"
Cohesion: 0.08
Nodes (23): dynamic, Home(), metadata, AgentPrompt(), ApiReference(), ENDPOINTS, methodBadgeColor(), Faq() (+15 more)

### Community 7 - "Shared Table & Badge Components"
Cohesion: 0.19
Nodes (24): CompetitorTable(), RecentUpdates(), CATEGORY_COLORS, categoryColor(), TopGainersTable(), LeaderboardTable(), CompetitorList(), MerchantHeader() (+16 more)

### Community 8 - "Runtime Dependencies"
Cohesion: 0.06
Nodes (33): @agentcash/router, drizzle-orm, lucide-react, @neondatabase/serverless, next, dependencies, @agentcash/router, drizzle-orm (+25 more)

### Community 9 - "TypeScript Compiler Config"
Cohesion: 0.07
Nodes (26): dom, dom.iterable, esnext, next-env.d.ts, .next/types/**/*.ts, node_modules, **/*.ts, **/*.tsx (+18 more)

### Community 10 - "Drizzle Mock Chain Test Harness"
Cohesion: 0.10
Nodes (19): mockDelete, mockExecute, mockInsert, mockSelect, selectResults, makeDeleteChain(), makeInsertChain(), makeSelectChain() (+11 more)

### Community 11 - "Dashboard Shell & Navigation"
Cohesion: 0.12
Nodes (15): metadata, dynamic, metadata, DashboardShell(), breadcrumbLabels, buildBreadcrumbs(), Header(), labelForSegment() (+7 more)

### Community 12 - "Test Fixtures & Factories"
Cohesion: 0.15
Nodes (17): GET, MerchantData, Category, Merchant, Resource, Trend, mockComputeDescriptionQuality, mockComputeListingCompleteness (+9 more)

### Community 13 - "Merchant Profile Widgets"
Cohesion: 0.14
Nodes (12): FixList(), PRIORITY_ORDER, PRIORITY_STYLE, IdentityBand(), formatDay(), RankHistoryChart(), RankSparkline(), ImprovementSuggestion (+4 more)

### Community 14 - "Free Routes & Rate Limiting"
Cohesion: 0.13
Nodes (15): GET, handler, handler, OriginRequestSchema, OriginResponseSchema, POST, clientIp(), getLimiter() (+7 more)

### Community 15 - "Paid Report Route Tests"
Cohesion: 0.13
Nodes (15): POST, POST, mockComputeCompetitiveReport, mockGetMerchantByOrigin, mockInsert, mockComputeMerchantDeepDive, mockGetMerchantByAddress, mockInsert (+7 more)

### Community 16 - "Cockpit Home & Claim Flow"
Cohesion: 0.18
Nodes (14): buildRankSummary(), ClaimPanel(), Cockpit(), metadata, ClaimForm(), RememberedMerchant(), rememberOrigin(), TopByCategory() (+6 more)

### Community 17 - "Paid Routes & Discovery Endpoints"
Cohesion: 0.19
Nodes (10): CompetitiveRequestSchema, CompetitiveResponseSchema, MerchantRequestSchema, MerchantResponseSchema, GET, GET, GET, REPORT_COST_USDC (+2 more)

### Community 18 - "Dynamic Detail Pages"
Cohesion: 0.21
Nodes (13): CategoryDetailPage(), generateMetadata(), getCachedCategory, revalidate, generateMetadata(), getCachedMerchant, MerchantProfilePage(), revalidate (+5 more)

### Community 19 - "Drizzle Schema & Leaderboard Route"
Cohesion: 0.17
Nodes (13): handler, LeaderboardQuerySchema, categoriesRelations, categoryCache, merchants, merchantsRelations, NOTE: overallScore / volumeScore / recencyScore / performanceScore /, resources (+5 more)

### Community 20 - "Merchant Service Tests"
Cohesion: 0.14
Nodes (12): mockComputeBasicReport, mockGetMerchantByOrigin, mockSelect, mockSelectDistinctOn, selectResults, makeMerchant(), resetIdCounter(), mockComputeScoreBreakdown (+4 more)

### Community 22 - "Merchant Lookup & DB Client"
Cohesion: 0.27
Nodes (12): escapeRegex(), extractHost(), getMerchantByAddress(), getMerchantByOrigin(), getMerchantData(), registrableDomain(), createDb(), getDb() (+4 more)

### Community 23 - "Router Auth & Fail-Open Layers"
Cohesion: 0.27
Nodes (10): Fail-open optional feature layers, Router auth modes (siwx, paid, unprotected), routes-barrel side-effect import requirement, Reliability component / computeReliability (5% placeholder), Vercel KV / Upstash (SIWX nonces, x402 replay, cache), Per-IP fail-open rate limiting, RouterConfigError boot-time env validation, x402 payment flow (402 challenge, verify, settle) (+2 more)

### Community 24 - "Ranker Score Components"
Cohesion: 0.22
Nodes (10): Buyer Diversity component (25%), computeBuyerConcentration (HHI-derived), computePricePosition, computeRankerScore, logNorm log10 normalization helper, GET /preview endpoint, Recency component (15%), POST /report/merchant endpoint (x402 $0.03) (+2 more)

### Community 25 - "Preview Endpoint"
Cohesion: 0.24
Nodes (8): domainLabels(), handler, PreviewQuerySchema, PreviewResponseSchema, resolveMerchantName(), tokenize(), computeDescriptionQuality(), computeListingCompleteness()

### Community 26 - "Rank Service"
Cohesion: 0.24
Nodes (8): categories, getLeaderboard(), getMerchantRank(), LeaderboardParams, LeaderboardResult, mockFindMany, mockSelect, selectResults

### Community 28 - "Category Trends & Growth"
Cohesion: 0.39
Nodes (5): fetchAllCategories(), CategoryTrendPoint, computeCategoryGrowth(), daysBetween(), getCategoryTrends()

### Community 29 - "Categorizer Tests"
Cohesion: 0.25
Nodes (6): mockDelete, mockExecute, mockSelect, mockUpdate, selectResults, makeUpdateChain()

### Community 30 - "Ranker DB Tests"
Cohesion: 0.25
Nodes (6): mockExecute, mockFetchMerchantStats, mockInsert, mockSelect, mockUpdate, selectResults

### Community 31 - "Ingest Normalization Gotchas"
Cohesion: 0.33
Nodes (7): Address + chain normalization at ingest and lookup, Atomic price units gotcha, NUL byte sanitization for Postgres text columns, Listing Quality component (15%), Stage 1: fetchAllBazaarResources, Stage 2: upsertCatalog, Coinbase Bazaar marketplace catalog

### Community 32 - "Leaderboard Route Tests"
Cohesion: 0.33
Nodes (5): GET, get(), mockFindMany, mockSelect, selectResults

### Community 33 - "Category Service Tests"
Cohesion: 0.29
Nodes (6): getAllCategories(), mockExecute, mockFindMany, mockInsert, mockSelect, selectResults

### Community 34 - "Rate Limit Tests"
Cohesion: 0.33
Nodes (4): mockLimit, mockSlidingWindow, okHandler, slidingWindow()

### Community 35 - "AI Analyst & Competitive Report"
Cohesion: 0.40
Nodes (6): Claude Code mention-triggered job, Claude Code Review job, opencode slash-command job, AI Analyst LLM post-processor, computeGapAnalysis (comparator), POST /report/competitive endpoint (x402 $0.03)

### Community 36 - "Pipeline Orchestration & Cron"
Cohesion: 0.40
Nodes (6): GitHub Actions cron fallback for pipeline, Daily Data Refresh job, Six-stage data pipeline, scripts/run-pipeline.ts single pipeline definition, Decipher Ranker architecture document, GET /api/cron/refresh-catalog endpoint

### Community 37 - "Batch Scoring & Rank Assignment"
Cohesion: 0.33
Nodes (6): Set-based batch chunking (INSERT_CHUNK_SIZE 500), Stage 3: assignAllMerchantCategories, GET /categories endpoint, GET /leaderboard endpoint, Stage 4: scoreAllMerchants, Windowed ROW_NUMBER rank assignment

### Community 38 - "x402scan Payment Client Tests"
Cohesion: 0.33
Nodes (4): mockCreatePaymentPayload, mockEncodePaymentSignatureHeader, mockGetPaymentRequiredResponse, mockRegisterExactEvmScheme

### Community 39 - "Product Thesis & CI"
Cohesion: 0.40
Nodes (5): CI check job (lint, typecheck, test), decipher-ranker greenfield x402 service, installRouterMock testing convention, x402 merchant visibility problem, Ranker score formula

### Community 40 - "ESLint Config"
Cohesion: 0.40
Nodes (4): compat, __dirname, eslintConfig, __filename

### Community 41 - "Competitor Gap Analysis"
Cohesion: 0.60
Nodes (3): computeGapAnalysis(), extractKeywords(), STOP_WORDS

### Community 42 - "Schema & Cache Snapshot Stages"
Cohesion: 0.67
Nodes (4): Dashboard reads DB directly (two independent consumers), Postgres schema (merchants, resources, categories, category_cache, trends, reports), Stage 5: refreshCategoryCache, Stage 6: writeDailySnapshot

## Knowledge Gaps
- **249 isolated node(s):** `__filename`, `__dirname`, `compat`, `eslintConfig`, `nextConfig` (+244 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **7 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `getDb()` connect `Merchant Lookup & DB Client` to `Listing Quality Analytics`, `Leaderboard Page & Dashboard Data Layer`, `Ingest Pipeline & Categorizer`, `Category Service Tests`, `Description & Tag Quality Scoring`, `Marketing Landing Page`, `Free Routes & Rate Limiting`, `Paid Routes & Discovery Endpoints`, `Drizzle Schema & Leaderboard Route`, `Rank Service`, `Category Trends & Growth`?**
  _High betweenness centrality (0.076) - this node is a cross-community bridge._
- **Why does `merchants` connect `Drizzle Schema & Leaderboard Route` to `Listing Quality Analytics`, `Leaderboard Page & Dashboard Data Layer`, `Ingest Pipeline & Categorizer`, `Description & Tag Quality Scoring`, `Marketing Landing Page`, `Free Routes & Rate Limiting`, `Merchant Lookup & DB Client`, `Rank Service`, `Category Trends & Growth`?**
  _High betweenness centrality (0.021) - this node is a cross-community bridge._
- **Why does `toDisplayScore()` connect `Shared Table & Badge Components` to `Leaderboard Page & Dashboard Data Layer`, `Categories Page Components`, `Merchant Profile Widgets`, `Cockpit Home & Claim Flow`, `Dynamic Detail Pages`?**
  _High betweenness centrality (0.016) - this node is a cross-community bridge._
- **What connects `__filename`, `__dirname`, `compat` to the rest of the system?**
  _249 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Listing Quality Analytics` be split into smaller, more focused modules?**
  _Cohesion score 0.056910569105691054 - nodes in this community are weakly interconnected._
- **Should `Leaderboard Page & Dashboard Data Layer` be split into smaller, more focused modules?**
  _Cohesion score 0.05755693581780538 - nodes in this community are weakly interconnected._
- **Should `Ingest Pipeline & Categorizer` be split into smaller, more focused modules?**
  _Cohesion score 0.09019607843137255 - nodes in this community are weakly interconnected._