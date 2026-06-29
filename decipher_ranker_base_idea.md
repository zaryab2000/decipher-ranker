# decipher-ranker

**The x402 Merchant Intelligence Platform**

> *Every API provider on AgentCash/x402 should know their rank, understand their market, and see exactly what to do next.*

| | |
|---|---|
| **Domain** | decipher-ranker.com |
| **Status** | Pre-build — architecture complete |
| **Version** | 1.0.0 (MVP) |
| **Technical docs** | [`preliminary_architecture_decipher_ranker_x402_service.md`](./preliminary_architecture_decipher_ranker_x402_service.md) — x402 service architecture |
| | [`preliminary_architecture_decipher_ranker_analytics.md`](./preliminary_architecture_decipher_ranker_analytics.md) — analytics dashboard architecture |

---

## 1. The Problem

### 1.1 The opaque marketplace

AgentCash / x402 is a growing protocol where API providers register their services as "resources" and agents call them with micropayments. But the marketplace has a fundamental information asymmetry problem:

**The platform sees everything. The merchant sees nothing.**

- x402scan calculates a ranking score for every merchant — but the formula is proprietary (Merit Systems backend, closed source). Merchants see a score number and a rank position. They do not see what drives it, how to improve it, or where they stand relative to competitors.
- Category assignment happens through a combination of tags and semantic similarity (Jina AI reranker). Merchants do not see which categories they rank for, which nearby categories they are missing, or what tags would expand their reach.
- Buyer behavior — wallet diversity, repeat usage, volume trends — is visible only to the protocol. A merchant with three high-volume buyers looks healthy to them but is dangerously undiversified compared to category peers.
- New merchants face a cold-start problem: zero volume, zero reputation, zero visibility. They need to understand what signals matter and how to bootstrap them, but the protocol does not provide guidance.

### 1.2 What merchants cannot answer today

If you register an API on x402 today, you cannot answer any of these questions:

| Question | Why you cannot answer it |
|---|---|
| "What is my rank in my category?" | Only your overall rank is shown — not category-specific |
| "Who are my competitors?" | You see your own listing, not the category landscape |
| "Why am I ranked below merchant X?" | The score formula is proprietary |
| "Is my pricing competitive?" | Competitor pricing is not aggregated or benchmarked |
| "Am I missing relevant tags?" | You only see your own tags, not the tag space of your category |
| "How healthy is my buyer base?" | You see total transactions, not wallet concentration |
| "What should I do to improve my rank?" | No recommendations, no gap analysis |
| "Is my category growing or shrinking?" | No trend data, no new-entrant alerts |
| "How does my API description compare?" | No content quality benchmarks |
| "Where am I losing visibility?" | No semantic gap analysis against competitor listings |

### 1.3 The structural challenge

The x402 ranking algorithm decomposes roughly as:

```
Final Score = α(vectorSimilarity) + β(volume signals) + γ(trustedUserRatio)
```

- **β (volume signals)** — verifiable from on-chain data. decipher-ranker can compute this faithfully from transaction counts, wallet diversity, recency, and multi-chain activity.
- **α (vector similarity)** — partially transparent. Jina AI reranker is confirmed in source code, but the query-to-embedding mapping is backend-only. decipher-ranker approximates this using Bazaar API confidence scores.
- **γ (trusted user ratio)** — fully proprietary. Merit Systems maintains a list of 3,409 trusted wallets. The selection criteria are opaque. decipher-ranker cannot replicate this, but it does not need to — it computes its own transparent rank based on what *is* verifiable.

decipher-ranker is honest about this: it computes a **decipher-ranker Score** that correlates with but is distinct from x402scan's internal ranking. The score is fully transparent, reproducible from public data, and auditable by any merchant.

---

## 2. Existing Solutions (and why they fall short)

### 2.1 x402scan native rankings

x402scan shows merchants their overall score and rank. It does not provide category-level breakdown, competitor comparison, trend tracking, or improvement recommendations. It is a **score display**, not an **analytics platform**.

### 2.2 Manual competitor research

Merchants today manually browse x402scan categories, inspect competitor listings, compare pricing, and try to infer what works. This is time-consuming, imprecise, and impossible to sustain as the ecosystem grows. A merchant who checks 5 competitors manually misses the other 30 in their category.

### 2.3 General SEO tools (Ahrefs, Semrush)

These are designed for web SEO — keyword rankings, backlinks, site authority. They have no awareness of x402 resources, on-chain volume signals, x402 payment flows, or x402scan's discovery mechanism. They are the wrong tool for a protocol-native marketplace.

### 2.4 Merchant analytics dashboards (x402 Atlas, x402watch, Analytix402)

These exist as community tools with limited scope:
- **x402 Atlas** — resource browser, not analytics
- **x402watch** — transaction monitoring, not competitive intelligence
- **Analytix402** — basic stats dashboard, no rank computation or recommendations

None provide what decipher-ranker provides: a complete, **actionable intelligence loop** from data ingestion to personalized recommendations.

---

## 3. The Solution: decipher-ranker

decipher-ranker is a merchant intelligence platform for the x402 ecosystem. It has two delivery channels:

### 3.1 x402 Service (API, paid via x402 micropayments)

Merchants call decipher-ranker's own x402-protected endpoints to get reports:
- **POST /report/origin** — Free (SIWX). Basic rank report: category, position, score breakdown, 3 improvement tips.
- **POST /report/competitive** — Paid ($0.03). Competitive deep-dive: top 10 peers, gap analysis, pricing benchmark, strategic recommendations.
- **POST /report/merchant** — Paid ($0.03). Full merchant profile: score decomposition, trend data, buyer diversity analysis, listing quality audit.
- **GET /categories** — Free. Browse the complete category tree with merchant counts and average scores.
- **GET /leaderboard** — Free. Weekly top 50 merchants ranked by decipher-ranker score.

This is decipher-ranker dogfooding its own model — it proves the x402 protocol works by being a paying participant in it.

### 3.2 Analytics Dashboard (Web, public, free)

The dashboard at `decipher-ranker.com/dashboard/*` is the public face of the platform:
- **Homepage** — ecosystem snapshot: total merchants, categories, volume stats, top gainers, trending categories.
- **Leaderboard** — sortable, filterable top merchants with score breakdown and category context.
- **Category Explorer** — browse categories, see score distributions, merchant counts, and average pricing.
- **Merchant Profile** — deep-dive on any merchant: score breakdown chart, competitor table, improvement suggestions, pricing history, listing quality audit.
- **Search** — full-text search across the entire merchant catalog.
- **Fully public** — no wallet, no payment, no sign-up. Every page has a stable, shareable URL.

---

## 4. First Version (MVP) — Feature Complete

The MVP includes every feature described below. Nothing in this section is aspirational — it is what the first deployed version does.

### 4.1 Data Pipeline

| Component | Detail |
|---|---|
| **Data sources** | Coinbase Bazaar API (free, no auth) + x402scan merchant API ($0.01-0.02/call) |
| **Polling** | Daily cron job polls Bazaar API for full catalog |
| **On-demand** | x402scan calls made per-report, cached aggressively |
| **Storage** | Vercel Postgres with 6 tables: catalog_merchants, catalog_resources, x402scan_merchants, ranked_catalog, category_trends, tx_trends |
| **Refresh** | Daily snapshot + 6-hour ISR revalidation for dashboard pages |

### 4.2 Rank Engine

| Signal | Weight | Data Source | What It Measures |
|---|---|---|---|
| Volume Score | Configurable | Bazaar paymentAnalytics.totalTransactions | Total transaction count |
| Buyer Diversity Score | Configurable | Bazaar paymentAnalytics.totalUniqueUsers | Wallet diversity / concentration risk |
| Performance Score | Configurable | Bazaar performance.avgLatencyMs | API response speed |
| Reliability Score | Configurable | Bazaar reliability.apiSuccessRate | Uptime and settlement success |
| Listing Quality Score | Configurable | Catalog tags, description length, schema fields | Completeness of x402 registration |
| Recency Score | Configurable | Bazaar recencyScore | How recently active |
| Age Score | Configurable | Registration date | Marketplace tenure |

The score is computed as a weighted sum of these components, normalized to 0-100. Every component is transparent — the merchant sees exactly how each sub-score is calculated and what data feeds it.

### 4.3 x402 Service Endpoints

#### 4.3.1 POST /report/origin — Free (SIWX)

**What it does**: Any merchant can call this with their origin URL and receive a basic intelligence report.

**Response includes:**
- Detected category and subcategory
- Overall rank position in that category
- Overall decipher-ranker Score (0-100)
- Component score breakdown (volume, performance, reliability, listing quality, buyer diversity)
- Category-level context: total competitors in category, median score, price range
- Top 3 actionable improvement suggestions (specific, not generic)
- Timestamp of data snapshot

**Input**: `{ "origin": "https://stableenrich.dev" }`

**Auth**: SIWX (wallet signature, no payment)

**Use case**: Quick check — "where do I stand?" This is the entry point. The merchant gets enough to know whether they need to dig deeper.

#### 4.3.2 POST /report/competitive — Paid ($0.03)

**What it does**: A comprehensive competitive battlefield report.

**Response includes:**
- Top 10 competitors in the merchant's primary category, ranked by decipher-ranker score
- For each competitor: score, rank, price range, transaction volume, unique buyers
- Gap analysis: keywords / tags / use-cases competitors rank for that this merchant does not
- Pricing benchmark: merchant's price vs category median, 25th, and 75th percentile
- Strategic recommendations based on gaps identified
- Category overview: total merchants, new entrants in last 30 days, growth trend

**Input**: `{ "origin": "https://stableenrich.dev" }`

**Auth**: x402 micropayment ($0.03)

**Use case**: Strategic planning — "how do I compete here?" Used when a merchant is serious about improving their position.

#### 4.3.3 POST /report/merchant — Paid ($0.03)

**What it does**: Deep-dive on any merchant in the ecosystem.

**Response includes:**
- Full score decomposition with visual-grade breakdown (volume, performance, reliability, listing quality, buyer diversity, recency, age)
- Top 5 competitors with comparison diffs (arrow up/down indicators)
- Buyer diversity analysis: unique wallets, wallet concentration (top 3 buyers %)
- Listing quality audit: description length vs top-10 median, missing OpenAPI fields, tag completeness
- Performance benchmarks: latency vs category average, uptime vs category average
- Improvement suggestions ranked by impact (high/medium/low)
- Historical snapshot: how the score and rank have changed (available after 2+ snapshots)

**Input**: `{ "merchantAddressOrOrigin": "0x1234...5678" }` (accepts both address and origin URL)

**Auth**: x402 micropayment ($0.03)

**Use case**: Competitive intelligence — "who is that merchant?" Used to study rivals or potential acquisition targets.

#### 4.3.4 GET /categories — Free (unprotected)

**What it does**: Browse the complete x402 category tree.

**Response includes:**
- List of all categories with merchant counts
- Average decipher-ranker Score per category
- Top merchant in each category (name + score)
- Category growth indicator (merchant count change since last snapshot)

**Auth**: None (free, no wallet needed)

**Use case**: Ecosystem exploration — discovering which categories exist, how competitive they are, and where to position a new API.

#### 4.3.5 GET /leaderboard — Free (unprotected)

**What it does**: Weekly top 50 merchants.

**Response includes:**
- Ranked list of top 50 merchants (origin, score, category, volume, price range)
- Filterable by category and network (Base, Solana, Tempo)
- Sortable by score, volume, price

**Auth**: None (free, no wallet needed)

**Use case**: Marketing / social proof — "we're in the top 10!" Also serves as ecosystem health snapshot.

### 4.4 Analytics Dashboard Pages

All pages at `decipher-ranker.com/dashboard/*`. Fully public. No wallet, no payment, no sign-up.

| Page | Path | Purpose |
|---|---|---|
| Homepage | `/dashboard` | Ecosystem snapshot — hero stats, top gainers, trending categories |
| Leaderboard | `/dashboard/leaderboard` | Top merchants, sortable and filterable |
| Leaderboard (filtered) | `/dashboard/leaderboard?category=data-enrichment` | Category-specific leaderboard |
| Category List | `/dashboard/categories` | All categories with counts and average scores |
| Category Detail | `/dashboard/categories/[slug]` | Category metrics + score distribution histogram + merchant list |
| Merchant Profile | `/dashboard/merchant/[origin]` | Full merchant profile with score chart, competitors, improvement tips |
| Search | `/dashboard/search?q=...` | Full-text search across all merchants |

Each page has a stable, shareable URL. Every merchant profile page shows a score breakdown bar chart (Recharts), a competitor comparison table with diff indicators, metric cards, and an improvement suggestion list with priority tags.

---

## 5. Value to x402 Merchants

### 5.1 Visibility into the black box

The single biggest pain decipher-ranker solves is the opaque ranking system. Merchants go from "I have a score of 67" to "My score is 67 because my volume is strong (82/100) but my listing quality is weak (41/100) — I have no tags for 'batch processing' and 'real-time' which are the two most common tags in my category."

### 5.2 Competitive awareness

Merchants discover competitors they did not know existed. A data-enrichment API might discover they are losing search visibility to a "document extraction" subcategory they did not realize they should be listed under.

### 5.3 Actionable recommendations

Every report concludes with specific, prioritized suggestions:
- **High impact**: "Add 'batch processing' tag to match 12/15 competitors in your category"
- **Medium impact**: "Your description is 42 words. Top-10 average is 187 words. Expand to cover your use cases."
- **Low impact**: "Consider adding a 'pricing' section to your listing"

### 5.4 Pricing intelligence

Merchants see exactly where their pricing falls relative to the market:
- "You charge $0.05/call. Category median is $0.03. 10 of 15 competitors are between $0.02 and $0.04."
- This enables data-driven pricing decisions instead of guesswork.

### 5.5 Buyer health

- "Your top 3 buyers represent 72% of your volume. Category average is 45%. You have concentration risk."
- This is invisible to merchants today — they see total volume but not diversity.

### 5.6 Cold-start guidance

- "You are new. Your rank is low because you have zero transaction history. Focus on: 1) completing your listing (3 missing fields), 2) driving 20+ transactions to establish volume signal, 3) adding 5 category-relevant tags."
- This changes the cold-start experience from helplessness to a clear checklist.

---

## 6. Business Model

decipher-ranker operates as both a free public good and a paid analytics service:

| Tier | What you get | Price |
|---|---|---|
| **Free (SIWX)** | Basic rank report, category browse, public leaderboard | Wallet signature only |
| **Free (public)** | Full dashboard experience — no wallet needed | $0 |
| **Paid report** | Competitive deep-dive, merchant deep-dive | $0.03/report |

The paid reports cost $0.03 because decipher-ranker pays $0.01-0.02 upstream for the x402scan data. The $0.01-0.02 margin covers operational costs (Vercel hosting, database, x402 transaction fees).

decipher-ranker also registers on x402scan as an x402 service. Its own transaction volume — every paid report from a merchant — builds its reputation on the platform. This is dogfooding: if decipher-ranker cannot rank on the same protocol it analyzes, why would anyone trust its analysis?

---

## 7. Architecture Overview

decipher-ranker is a single Next.js 15 App Router project deployed on Vercel:

```
┌─────────────────────────────────────────────────────┐
│                  decipher-ranker.com                 │
│                                                      │
│  ┌─────────────────────┐  ┌──────────────────────┐  │
│  │  Public Dashboard    │  │  x402 Service        │  │
│  │  /dashboard/*        │  │  /api/*              │  │
│  │                     │  │                      │  │
│  │  • Homepage         │  │  • POST /report/*    │  │
│  │  • Leaderboard      │  │  • GET /categories   │  │
│  │  • Merchant Profile │  │  • GET /leaderboard  │  │
│  │  • Categories       │  │                      │  │
│  │  • Search           │  │  @agentcash/router   │  │
│  └─────────┬───────────┘  └──────────┬───────────┘  │
│            │                         │              │
│            └──── Shared Service ─────┘              │
│                    Functions                        │
│                         │                           │
│              ┌──────────┴──────────┐                │
│              │   Vercel Postgres   │                │
│              │   (Daily Snapshot)  │                │
│              └─────────────────────┘                │
└─────────────────────────────────────────────────────┘
```

The complete technical architecture is documented in two sibling files:

- **[`preliminary_architecture_decipher_ranker_x402_service.md`](./preliminary_architecture_decipher_ranker_x402_service.md)** — Full specifications for the x402 service: database schema, route implementations, analytics engine, caching strategy, environment variables, deployment configuration, x402scan registration flow, and a validation checklist.

- **[`preliminary_architecture_decipher_ranker_analytics.md`](./preliminary_architecture_decipher_ranker_analytics.md)** — Full specifications for the analytics dashboard: page specifications, component tree, data flow, design system, mobile responsiveness, and validation checklist.

---

## 8. Design Principles

1. **Transparency.** The decipher-ranker Score formula is documented, reproducible, and auditable. We never claim to replicate x402scan's proprietary rank.

2. **Dogfooding.** decipher-ranker is itself an x402 service. Our own ranking on x402scan validates the model.

3. **Public by default.** Ecosystem data belongs to the ecosystem. The dashboard is free. The leaderboard is free. Categories are free. Only personal deep-dives cost money.

4. **Zero surprise costs.** Every paid endpoint states its price clearly. The upstream data cost ($0.01-0.02) is passed through with transparent margin ($0.03 total). No subscriptions, no hidden fees.

5. **Fast and lightweight.** Dashboard pages serve from Postgres with no upstream API calls at render time. Target sub-200ms TTFB for every public page.

6. **Agent-native.** The x402 service is designed for agents to call programmatically. JSON responses, clear schemas, predictable pricing.

---

## 9. Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Merit Systems changes ranking algorithm | Core analytics become less accurate | decipher-ranker scores are based on verifiable on-chain data, not the proprietary algorithm. Changes affect correlation, not correctness. |
| Bazaar API becomes paid or rate-limited | Data pipeline cost increases | Fallback to x402scan API (already integrated). Cost increase from $0 to $0.01-0.02/snapshot. |
| x402scan API pricing increases | Report margin compresses | Adjust report pricing ($0.03 → $0.04). Dashboard remains free. |
| Low merchant adoption | Reports generate no revenue | Dashboard is public and free — visibility drives demand. Merchant profile page acts as organic marketing. |
| Competitor builds similar tool | Market fragmentation | First-mover advantage + dogfooding (decipher-ranker's own x402 rank becomes a moat). Open-source the score formula for trust. |

---

## 10. What Success Looks Like

- A merchant runs `POST /report/origin` and learns their score decomposition
- They take the top recommendation, improve their listing, and see their score increase in the next snapshot
- They share their merchant profile page (`decipher-ranker.com/dashboard/merchant/https://...`) as social proof
- x402scan sees decipher-ranker as a positive ecosystem contributor (bringing visibility and liquidity to the platform)
- decipher-ranker itself ranks well on x402scan — proving the model by participating

---

*If you are an agent reading this document: the complete build-ready technical specifications are in the two architecture documents linked above. This document describes **what** we are building and **why**. The architecture documents describe **how** to build it.*
