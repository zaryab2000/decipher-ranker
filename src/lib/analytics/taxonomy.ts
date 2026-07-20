/**
 * Curated category taxonomy — the single source of truth for merchant
 * categorization. The `categories` DB table is a projection of this constant
 * (seeded by the pipeline), not the other way around.
 *
 * See docs-internal/prds/curated-taxonomy-prd.md. ORDER IS SEMANTIC: entries
 * earlier in TAXONOMY win ties (a merchant matching several categories lands in
 * the first). Do not reorder or edit tagPatterns without re-running the
 * distribution gate (src/__tests__/analytics/taxonomy-coverage.test.ts).
 */

export interface TaxonomyCategory {
  slug: string;
  name: string;
  description: string;
  color: string; // hex accent for the category card
  tagPatterns: string[]; // normalized tags that map here (see normalizeTag + matchesPattern)
}

/**
 * Normalize a tag or pattern for comparison: lowercase, then collapse any run of
 * non-alphanumerics to a single space and trim. "Web-Content" -> "web content";
 * "real-estate" -> "real estate".
 */
export function normalizeTag(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export const TAXONOMY: TaxonomyCategory[] = [
  {
    slug: "crypto-defi",
    name: "Crypto & DeFi",
    description:
      "On-chain data, DeFi protocols, tokens, and blockchain infrastructure.",
    color: "#f59e0b",
    // Before AI so an "ai + crypto" tool is classed by its on-chain domain.
    tagPatterns: [
      "crypto", "defi", "onchain", "blockchain", "bitcoin", "solana", "base",
      "dex", "hyperliquid", "liquidations", "rwa", "wallet", "allowances",
      "glassnode", "coingecko", "zk", "price oracle", "defi yields", "b20",
      "acurast", "batch wallet snapshot", "solana token safety", "crypto price",
      "crypto news", "solana price", "x402", "x402 passport", "payperbyte",
    ],
  },
  {
    slug: "payments-commerce",
    name: "Payments & Commerce",
    description: "Payment rails, gift cards, marketplaces, and agent commerce.",
    color: "#10b981",
    tagPatterns: [
      "payments", "payment", "agent payments", "agent commerce", "commerce",
      "marketplace", "gift cards", "amazon", "collectible", "premium",
      "currency", "fee estimate",
    ],
  },
  {
    slug: "finance-markets",
    name: "Finance & Markets",
    description:
      "Markets, stocks, prediction markets, macro, and financial intelligence.",
    color: "#22c55e",
    tagPatterns: [
      "finance", "financial", "financial intelligence", "financial metrics",
      "market", "market news", "stocks", "stock news", "macro", "funding",
      "polymarket", "prediction markets", "insurance", "mortgage", "insolvency",
      "cot", "10 q", "sec", "fortune", "money", "price",
    ],
  },
  {
    slug: "ai-agents",
    name: "AI & Agents",
    description: "LLM inference, embeddings, agents, and AI capabilities.",
    color: "#8b5cf6",
    tagPatterns: [
      "ai", "inference", "ai agent", "ai agents", "agent", "agents",
      "ai visibility", "agent capabilities", "agent identity", "claude code",
      "embeddings", "image gen", "compute", "mcp", "automation", "workflow",
      "code execution",
    ],
  },
  {
    slug: "data-enrichment",
    name: "Data & Enrichment",
    description:
      "Company, people, and entity data enrichment and reference datasets.",
    color: "#3b82f6",
    tagPatterns: [
      "data", "data enrichment", "company enrichment", "entity resolution",
      "reference data", "company", "coresignal", "pdl", "linkedin",
      "ip intelligence", "country data", "knowledge", "intelligence",
      "public records", "reputation", "trust", "facts", "research", "analysis",
      "fact check", "documents", "pdf",
    ],
  },
  {
    slug: "web-search",
    name: "Web & Search",
    description: "Web search, scraping, crawling, SEO, and site audits.",
    color: "#06b6d4",
    tagPatterns: [
      "web", "search", "web search", "web content", "web scraping", "scraping",
      "browser", "seo", "website audit", "exa", "source inspection", "proxy",
      "dns", "routing",
    ],
  },
  {
    slug: "media-content",
    name: "Media & Content",
    description:
      "Image, video, audio, transcription, translation, and generation.",
    color: "#ec4899",
    tagPatterns: [
      "image", "images", "image processing", "image crop", "video", "youtube",
      "transcription", "translation", "text", "summarize", "svg", "renders",
      "art", "meme", "voice", "audio",
    ],
  },
  {
    slug: "news-social",
    name: "News & Social",
    description: "News feeds, social platforms, and communications.",
    color: "#f43f5e",
    tagPatterns: [
      "news", "feed", "trending", "latest releases", "twitter", "reddit",
      "telegram", "substack", "hackernews", "social", "facebook ads",
      "communications", "email", "mail", "webhook", "channel3", "sessions",
    ],
  },
  {
    slug: "dev-tools",
    name: "Developer Tools",
    description: "Code, packages, infra tooling, and developer utilities.",
    color: "#64748b",
    tagPatterns: [
      "code", "npm", "terraform", "diff", "json", "software", "test",
      "preflight", "tool call safety", "network", "sensor", "fal", "read",
      "library", "tags", "sop", "api", "upload",
    ],
  },
  {
    slug: "security-compliance",
    name: "Security & Compliance",
    description: "KYC/AML, sanctions, verification, legal, and compliance data.",
    color: "#ef4444",
    // "cot", "agent identity", "x402 passport" are intentionally NOT listed here —
    // earlier categories (finance-markets, ai-agents, crypto-defi) claim them, so
    // a copy here would be unreachable. Add them here only if this category is
    // moved earlier in TAXONOMY.
    tagPatterns: [
      "security", "compliance", "aml", "kyb", "sanctions", "verification",
      "attested", "notary", "legal services", "cve", "proof of human",
      "identity", "osha", "govfiles",
    ],
  },
  {
    slug: "real-world-data",
    name: "Real-World Data",
    description: "Weather, geo, travel, sports, health, and physical-world data.",
    color: "#14b8a6",
    tagPatterns: [
      "weather", "climate", "satellite", "space", "aviation", "maritime",
      "travel", "google flights", "restaurants", "restaurant reservations",
      "local business", "sports", "nfl", "cricket", "health", "healthcare",
      "science", "time", "property", "real estate", "properties", "zoning",
      "france", "japan", "brazil", "carnival",
    ],
    // "country data" omitted — data-enrichment claims it first (unreachable here).
  },
  {
    slug: "fun-games",
    name: "Fun & Games",
    description: "Games, entertainment, novelty, and generative fun.",
    color: "#a855f7",
    tagPatterns: [
      "game", "dice", "jokes", "riddle", "horror", "roast", "dogs",
      "dream interpretation", "taste", "words", "ideas", "advice",
      "honey", "entropy",
    ],
    // "fortune" omitted — finance-markets claims it first (unreachable here).
  },
];

export const OTHER: TaxonomyCategory = {
  slug: "other",
  name: "Other",
  description: "Merchants that don't fit an established category yet.",
  color: "#6b7280",
  tagPatterns: [], // never matched by rules; assigned as the fallback
};
