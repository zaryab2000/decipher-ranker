import { describe, it, expect, beforeEach } from "vitest";
import {
  completenessGrade,
  countMerchantChains,
  computeActionCoverage,
} from "@/lib/analytics/completeness";
import { makeMerchantData, resetIdCounter } from "../fixtures/factories";

beforeEach(() => resetIdCounter());

describe("completenessGrade", () => {
  it("returns A for 85+", () => {
    expect(completenessGrade(85)).toBe("A");
    expect(completenessGrade(100)).toBe("A");
  });

  it("returns B for 70-84", () => {
    expect(completenessGrade(70)).toBe("B");
    expect(completenessGrade(84)).toBe("B");
  });

  it("returns C for 55-69", () => {
    expect(completenessGrade(55)).toBe("C");
    expect(completenessGrade(69)).toBe("C");
  });

  it("returns D for 40-54", () => {
    expect(completenessGrade(40)).toBe("D");
    expect(completenessGrade(54)).toBe("D");
  });

  it("returns F for < 40", () => {
    expect(completenessGrade(0)).toBe("F");
    expect(completenessGrade(39)).toBe("F");
  });
});

describe("countMerchantChains", () => {
  it("counts distinct chains across resources", () => {
    const data = makeMerchantData({
      resources: [
        { chain: "base" },
        { chain: "base" },
        { chain: "solana" },
        { chain: "polygon" },
      ],
    });
    expect(countMerchantChains(data.resources)).toBe(3);
  });

  it("returns 0 for empty resources", () => {
    expect(countMerchantChains([])).toBe(0);
  });
});

describe("computeActionCoverage", () => {
  it("surfaces a high-priority missing-schema action", () => {
    const data = makeMerchantData({
      resources: [{ hasInputSchema: false, hasOutputExample: false, description: "" }],
    });
    const actions = computeActionCoverage(data);
    const schemaAction = actions.find((a) => a.action.includes("input schemas"));
    expect(schemaAction).toBeDefined();
    expect(schemaAction?.priority).toBe("high");
  });

  it("surfaces a low-priority icon action when everything else is complete", () => {
    const data = makeMerchantData({
      merchant: { txCount30d: 100, buyers30d: 50 },
      category: { slug: "web-search", name: "Web & Search" },
      resources: [
        {
          hasInputSchema: true,
          hasOutputExample: true,
          description:
            "Extract markdown text and metadata from research PDFs and web pages with structured JSON output for AI agents — accepts a URL, returns title, body, and links.",
          serviceName: "Web Content Scraper API",
          tags: ["web", "scraping", "search"],
          iconUrl: null,
          chain: "base",
        },
        { chain: "solana", iconUrl: null },
        { chain: "polygon", iconUrl: null },
      ],
    });
    const actions = computeActionCoverage(data);
    const iconAction = actions.find((a) => a.action.includes("icon"));
    expect(iconAction).toBeDefined();
    expect(iconAction?.priority).toBe("low");
  });

  it("surfaces a multi-chain tip when only one chain is accepted", () => {
    const data = makeMerchantData({
      resources: [{ chain: "base" }, { chain: "base" }],
    });
    const actions = computeActionCoverage(data);
    const chainAction = actions.find((a) => a.action.includes("more chains"));
    expect(chainAction).toBeDefined();
    expect(chainAction?.priority).toBe("low");
  });

  it("does not emit both the '<3 endpoints' and 'no endpoints' tips at once", () => {
    const data = makeMerchantData({ resources: [{ chain: "base" }] });
    const actions = computeActionCoverage(data);
    const moreEndpoints = actions.filter((a) => a.action.includes("more API endpoints"));
    const noEndpoints = actions.filter((a) => a.action.includes("at least one API endpoint"));
    expect(moreEndpoints).toHaveLength(1);
    expect(noEndpoints).toHaveLength(0);
  });
});
