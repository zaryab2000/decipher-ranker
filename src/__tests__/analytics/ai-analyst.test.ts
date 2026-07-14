import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  buildPrompt,
  parseInsights,
  computeAIInsights,
  type AIInsightsInput,
} from "@/lib/analytics/ai-analyst";

function makeInput(overrides: Partial<AIInsightsInput> = {}): AIInsightsInput {
  return {
    origin: "https://mercury.example.com",
    serviceNames: ["Mercury Price Feed"],
    category: "defi",
    descriptions: ["Real-time blockchain price feeds with sub-second latency."],
    tags: ["prices", "oracle"],
    price: 0.005,
    rank: 3,
    totalCompetitors: 42,
    competitors: [
      {
        origin: "https://comp-a.xyz/api",
        rank: 1,
        score: 0.9,
        price: 0.002,
        uniqueBuyers: 120,
        toolCalls: 5000,
        descriptionLength: 240,
      },
    ],
    gapAnalysis: { missingTags: ["analytics"], missingKeywords: ["portfolio"], competitorCount: 1 },
    pricing: { yourPrice: 0.005, medianPrice: 0.002, minPrice: 0.001, maxPrice: 0.05, pricePercentile: 80 },
    ...overrides,
  };
}

describe("buildPrompt", () => {
  it("anchors identity on the merchant's origin and host", () => {
    const prompt = buildPrompt(makeInput());
    expect(prompt).toContain("https://mercury.example.com");
    expect(prompt).toContain("mercury.example.com");
    expect(prompt).toContain("Mercury Price Feed");
    expect(prompt).toContain("Category: defi");
    expect(prompt).toContain("https://comp-a.xyz/api");
    expect(prompt).toContain("Missing tags: analytics");
    expect(prompt).toContain("Category median: $0.002");
    expect(prompt).toContain("Percentile: 80");
  });

  it("includes the anti-substitution guardrail", () => {
    const prompt = buildPrompt(makeInput());
    expect(prompt).toContain("Do NOT substitute the name of any well-known company");
    expect(prompt).toContain("do NOT infer the identity from the category label");
  });

  it("treats multiple service names as a multi-service provider (not one of them)", () => {
    const prompt = buildPrompt(
      makeInput({
        origin: "https://mesh.heurist.xyz",
        serviceNames: ["Firecrawl", "Heurist Mesh", "AIXBT"],
      }),
    );
    expect(prompt).toContain("multi-service provider");
    expect(prompt).toContain("mesh.heurist.xyz");
    expect(prompt).toContain("Firecrawl");
    expect(prompt).toContain("Heurist Mesh");
    // Must not present any single hosted agent as "the" service identity.
    expect(prompt).not.toMatch(/Provider: Firecrawl \(/);
  });

  it("handles an unnamed merchant by identifying it by host", () => {
    const prompt = buildPrompt(
      makeInput({ origin: "https://anon.example.io", serviceNames: [] }),
    );
    expect(prompt).toContain("provider at anon.example.io");
    expect(prompt).toContain("no service name published");
  });

  it("caps competitors at 5 in the prompt", () => {
    const competitors = Array.from({ length: 9 }, (_, i) => ({
      origin: `https://c${i}.xyz`,
      rank: i + 1,
      score: 0.5,
      price: 0.01,
      uniqueBuyers: 1,
      toolCalls: 1,
      descriptionLength: 10,
    }));
    const prompt = buildPrompt(makeInput({ competitors }));
    expect(prompt).toContain("https://c4.xyz");
    expect(prompt).not.toContain("https://c5.xyz");
  });

  it("renders placeholders for missing/empty data fields", () => {
    const prompt = buildPrompt(
      makeInput({
        serviceNames: [],
        category: null,
        descriptions: [],
        tags: [],
        price: null,
        competitors: [],
        gapAnalysis: { missingTags: [], missingKeywords: [], competitorCount: 0 },
      }),
    );
    expect(prompt).toContain("Category: (uncategorized)");
    expect(prompt).toContain("Description(s): (none)");
    expect(prompt).toContain("Tags: (none)");
    expect(prompt).toContain("Missing tags: (none)");
  });
});

describe("parseInsights", () => {
  it("parses a clean JSON object", () => {
    const raw = JSON.stringify({
      summary: "Does X. Differentiates via Y.",
      top_action: "Do Z.",
      insights: ["a", "b", "c"],
    });
    const result = parseInsights(raw);
    expect(result).toEqual({
      summary: "Does X. Differentiates via Y.",
      topAction: "Do Z.",
      insights: ["a", "b", "c"],
      model: "mimo-v2.5-free",
    });
  });

  it("strips markdown code fences", () => {
    const raw = '```json\n{"summary":"s","top_action":"t","insights":["i"]}\n```';
    const result = parseInsights(raw);
    expect(result?.summary).toBe("s");
    expect(result?.insights).toEqual(["i"]);
  });

  it("fills missing fields with null / empty and drops non-string insights", () => {
    const raw = JSON.stringify({ summary: "only summary", insights: ["ok", 42, ""] });
    const result = parseInsights(raw);
    expect(result?.summary).toBe("only summary");
    expect(result?.topAction).toBeNull();
    expect(result?.insights).toEqual(["ok"]);
  });

  it("returns null for non-JSON", () => {
    expect(parseInsights("the model refused to answer")).toBeNull();
  });

  it("returns null when nothing usable is present", () => {
    expect(parseInsights(JSON.stringify({ summary: 5, insights: [] }))).toBeNull();
  });
});

describe("computeAIInsights", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.OPENCODE_API_KEY;
  });

  it("returns null (fallback) when no API key is set", async () => {
    delete process.env.OPENCODE_API_KEY;
    const result = await computeAIInsights(makeInput());
    expect(result).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("returns parsed insights on a successful call", async () => {
    process.env.OPENCODE_API_KEY = "key";
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  summary: "s",
                  top_action: "t",
                  insights: ["i1", "i2", "i3"],
                }),
              },
            },
          ],
        }),
    });

    const result = await computeAIInsights(makeInput());
    expect(result?.summary).toBe("s");
    expect(result?.topAction).toBe("t");
    expect(result?.insights).toHaveLength(3);
    expect(result?.model).toBe("mimo-v2.5-free");
    // Sends bearer auth to the OpenCode endpoint.
    const [url, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toContain("opencode.ai/zen/v1/chat/completions");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer key");
  });

  it("returns null (fallback) on an HTTP error", async () => {
    process.env.OPENCODE_API_KEY = "key";
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ok: false, status: 500 });
    const result = await computeAIInsights(makeInput());
    expect(result).toBeNull();
  });

  it("returns null (fallback) when fetch rejects (e.g. timeout/abort)", async () => {
    process.env.OPENCODE_API_KEY = "key";
    (fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      Object.assign(new Error("aborted"), { name: "AbortError" }),
    );
    const result = await computeAIInsights(makeInput());
    expect(result).toBeNull();
  });

  it("returns null (fallback) when the model returns malformed content", async () => {
    process.env.OPENCODE_API_KEY = "key";
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({ choices: [{ message: { content: "not json at all" } }] }),
    });
    const result = await computeAIInsights(makeInput());
    expect(result).toBeNull();
  });
});
