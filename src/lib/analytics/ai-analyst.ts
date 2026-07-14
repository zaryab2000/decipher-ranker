import type { AIInsights, CompetitorEntry, GapAnalysis, PricingBenchmark } from "@/lib/types";

/**
 * LLM post-processor for the competitive report. Turns the static gap/pricing
 * analysis into semantic, positioned insights via OpenCode Zen's
 * OpenAI-compatible chat API (plain fetch — no SDK dependency).
 *
 * Every failure mode (no key, timeout, HTTP error, malformed body) resolves to
 * `null` so the caller falls back to the static-only report. It never throws.
 */

const OPENCODE_BASE_URL = "https://opencode.ai/zen/v1";
const MODEL_ID = "mimo-v2.5-free";
const TIMEOUT_MS = 10_000;
const MAX_COMPETITORS_IN_PROMPT = 5;
const MAX_DESC_CHARS = 300;

export interface AIInsightsInput {
  /** The merchant's own origin URL, exactly as they submitted it. The identity anchor. */
  origin: string;
  /**
   * Distinct service names across the merchant's resources. Empty for unnamed
   * merchants; multiple entries indicate a multi-service provider / aggregator
   * (e.g. a mesh hosting several agents) — the model must not pick one as "the"
   * service.
   */
  serviceNames: string[];
  category: string | null;
  descriptions: string[];
  tags: string[];
  price: number | null;
  rank: number | null;
  totalCompetitors: number;
  competitors: CompetitorEntry[];
  gapAnalysis: GapAnalysis;
  pricing: PricingBenchmark;
}

/**
 * Generate AI insights for a competitive report, or null if the LLM is
 * unavailable/misconfigured. Safe to call unconditionally — the static report
 * is returned regardless of the outcome here.
 */
export async function computeAIInsights(
  input: AIInsightsInput,
): Promise<AIInsights | null> {
  const apiKey = process.env.OPENCODE_API_KEY;
  if (!apiKey) return null;

  const prompt = buildPrompt(input);

  let raw: string;
  try {
    raw = await callOpenCode(apiKey, prompt);
  } catch (error) {
    // Timeout, network, or HTTP error — degrade to static-only.
    console.error("AI analyst call failed:", error);
    return null;
  }

  return parseInsights(raw);
}

/** Build the analyst prompt from the structured static-analysis data. */
export function buildPrompt(input: AIInsightsInput): string {
  const desc = input.descriptions
    .join(" ")
    .slice(0, MAX_DESC_CHARS)
    .trim() || "(none)";

  const competitorLines = input.competitors
    .slice(0, MAX_COMPETITORS_IN_PROMPT)
    .map((c, i) => {
      const price = c.price != null ? `$${c.price}` : "n/a";
      return `${i + 1}. ${c.origin}: rank=${c.rank ?? "n/a"}, descLen=${c.descriptionLength}, buyers30d=${c.uniqueBuyers}, calls30d=${c.toolCalls}, price=${price}`;
    })
    .join("\n") || "(none)";

  const price = input.price != null ? `$${input.price}` : "n/a";
  const median = input.pricing.medianPrice != null ? `$${input.pricing.medianPrice}` : "n/a";
  const percentile = input.pricing.pricePercentile != null ? `${input.pricing.pricePercentile}` : "n/a";

  const host = originHost(input.origin);
  // A merchant may expose many resources under different names (an aggregator /
  // mesh). Never assert a single sub-resource name as "the" service — that is
  // how a hosted "Firecrawl" agent got reported as the merchant's identity.
  const serviceLine =
    input.serviceNames.length === 0
      ? `The provider at ${host} (no service name published)`
      : input.serviceNames.length === 1
        ? `${input.serviceNames[0]} (${host})`
        : `${host} — a multi-service provider hosting: ${input.serviceNames.slice(0, 8).join(", ")}`;

  return `You are an API marketplace analyst. Analyze this merchant's competitive position and generate actionable insights.

IDENTITY (authoritative — use exactly this):
- The merchant is the provider at the origin: ${input.origin}
- Provider: ${serviceLine}

RULES:
- Refer to the merchant by its origin/host (${host}) or its published service name(s) above. Do NOT substitute the name of any well-known company, and do NOT infer the identity from the category label.
- If multiple service names are listed, treat the merchant as one provider offering several services — do not describe it as any single one of them.
- Use only the data below. Do not invent competitors, metrics, or facts.

MERCHANT DATA:
- Category: ${input.category ?? "(uncategorized)"}
- Description(s): ${desc}
- Tags: ${input.tags.length > 0 ? input.tags.join(", ") : "(none)"}
- Price: ${price}
- Rank: ${input.rank ?? "n/a"} of ${input.totalCompetitors}

TOP ${MAX_COMPETITORS_IN_PROMPT} COMPETITORS:
${competitorLines}

GAP ANALYSIS:
- Missing tags: ${input.gapAnalysis.missingTags.join(", ") || "(none)"}
- Missing keywords: ${input.gapAnalysis.missingKeywords.join(", ") || "(none)"}

PRICING:
- Merchant price: ${price}, Category median: ${median}, Percentile: ${percentile}

Respond with ONLY a JSON object (no markdown, no prose) of this exact shape:
{
  "summary": "<2 sentences: what the provider at ${host} does and what differentiates them>",
  "top_action": "<1 sentence: the single highest-impact change they should make>",
  "insights": ["<insight 1>", "<insight 2>", "<insight 3>"]
}
Each insight must be specific and positioned against the competitors above — not generic advice.`;
}

/** Host portion of an origin URL for use as a stable identity label. */
function originHost(origin: string): string {
  try {
    return new URL(origin).host || origin;
  } catch {
    return origin;
  }
}

/** POST the prompt to OpenCode Zen with a hard timeout; return the message text. */
async function callOpenCode(apiKey: string, prompt: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(`${OPENCODE_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL_ID,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.4,
        response_format: { type: "json_object" },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`OpenCode HTTP ${response.status}`);
    }

    const body = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = body.choices?.[0]?.message?.content;
    if (!content) throw new Error("OpenCode returned no message content");
    return content;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Parse the model's JSON reply into AIInsights. Tolerates markdown code fences
 * and missing fields (filled with null / empty). Returns null only when nothing
 * usable can be extracted.
 */
export function parseInsights(raw: string): AIInsights | null {
  const json = extractJson(raw);
  if (!json) return null;

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }

  const summary = typeof parsed.summary === "string" ? parsed.summary.trim() : null;
  const topAction = typeof parsed.top_action === "string" ? parsed.top_action.trim() : null;
  const insights = Array.isArray(parsed.insights)
    ? parsed.insights.filter((i): i is string => typeof i === "string" && i.trim().length > 0)
    : [];

  // Nothing usable at all — treat as failure so the caller returns null.
  if (summary === null && topAction === null && insights.length === 0) {
    return null;
  }

  return { summary, topAction, insights, model: MODEL_ID };
}

/** Extract a JSON object from a raw model reply, stripping ```json fences. */
function extractJson(raw: string): string | null {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = (fenced ? fenced[1] : raw).trim();
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return null;
  return candidate.slice(start, end + 1);
}
