import { describe, it, expect, beforeEach } from "vitest";
import {
  extractPayeeAddress,
  extractPriceUsd,
  extractChain,
  hasInputSchema,
  hasOutputSchema,
  hasSchemaExample,
} from "@/lib/data-sources/bazaar";
import { makeBazaarResource, resetIdCounter } from "../fixtures/factories";

beforeEach(() => resetIdCounter());

describe("extractPayeeAddress", () => {
  it("returns payTo from first accepts entry", () => {
    const r = makeBazaarResource({
      accepts: [{ amount: "1", asset: "USDC", network: "base", payTo: "0xABC", scheme: "exact" }],
    });
    expect(extractPayeeAddress(r)).toBe("0xABC");
  });

  it("returns null for empty accepts array", () => {
    const r = makeBazaarResource({ accepts: [] });
    expect(extractPayeeAddress(r)).toBeNull();
  });

  it("returns first payTo when multiple accepts", () => {
    const r = makeBazaarResource({
      accepts: [
        { amount: "1", asset: "USDC", network: "base", payTo: "0xFIRST", scheme: "exact" },
        { amount: "2", asset: "ETH", network: "ethereum", payTo: "0xSECOND", scheme: "exact" },
      ],
    });
    expect(extractPayeeAddress(r)).toBe("0xFIRST");
  });
});

describe("extractPriceUsd", () => {
  it("returns parsed amount", () => {
    const r = makeBazaarResource({
      accepts: [{ amount: "0.05", asset: "USDC", network: "base", payTo: "0x1", scheme: "exact" }],
    });
    expect(extractPriceUsd(r)).toBe(0.05);
  });

  it("returns null for empty accepts", () => {
    const r = makeBazaarResource({ accepts: [] });
    expect(extractPriceUsd(r)).toBeNull();
  });

  it("returns null for NaN amount", () => {
    const r = makeBazaarResource({
      accepts: [{ amount: "not-a-number", asset: "USDC", network: "base", payTo: "0x1", scheme: "exact" }],
    });
    expect(extractPriceUsd(r)).toBeNull();
  });

  it("handles zero amount", () => {
    const r = makeBazaarResource({
      accepts: [{ amount: "0", asset: "USDC", network: "base", payTo: "0x1", scheme: "exact" }],
    });
    expect(extractPriceUsd(r)).toBe(0);
  });

  it("handles very small amounts", () => {
    const r = makeBazaarResource({
      accepts: [{ amount: "0.000001", asset: "USDC", network: "base", payTo: "0x1", scheme: "exact" }],
    });
    expect(extractPriceUsd(r)).toBe(0.000001);
  });
});

describe("extractChain", () => {
  it("returns network from first accepts entry", () => {
    const r = makeBazaarResource({
      accepts: [{ amount: "1", asset: "USDC", network: "ethereum", payTo: "0x1", scheme: "exact" }],
    });
    expect(extractChain(r)).toBe("ethereum");
  });

  it("returns 'base' for empty accepts", () => {
    const r = makeBazaarResource({ accepts: [] });
    expect(extractChain(r)).toBe("base");
  });

  it("returns 'base' when network is undefined", () => {
    const r = makeBazaarResource({
      accepts: [{ amount: "1", asset: "USDC", network: undefined as unknown as string, payTo: "0x1", scheme: "exact" }],
    });
    expect(extractChain(r)).toBe("base");
  });
});

describe("hasInputSchema", () => {
  it("returns true when input schema exists", () => {
    const r = makeBazaarResource({
      extensions: { bazaar: { info: { input: { type: "object", method: "GET" } } } },
    });
    expect(hasInputSchema(r)).toBe(true);
  });

  it("returns false when no extensions", () => {
    const r = makeBazaarResource({ extensions: undefined });
    expect(hasInputSchema(r)).toBe(false);
  });

  it("returns false when no input field", () => {
    const r = makeBazaarResource({
      extensions: { bazaar: { info: { output: { type: "object" } } } },
    });
    expect(hasInputSchema(r)).toBe(false);
  });
});

describe("hasOutputSchema", () => {
  it("returns true when output schema exists", () => {
    const r = makeBazaarResource({
      extensions: { bazaar: { info: { output: { type: "object" } } } },
    });
    expect(hasOutputSchema(r)).toBe(true);
  });

  it("returns false when no extensions", () => {
    const r = makeBazaarResource({ extensions: undefined });
    expect(hasOutputSchema(r)).toBe(false);
  });

  it("returns false when no output field", () => {
    const r = makeBazaarResource({
      extensions: { bazaar: { info: { input: { type: "object", method: "GET" } } } },
    });
    expect(hasOutputSchema(r)).toBe(false);
  });
});

describe("hasSchemaExample", () => {
  it("returns true when output has example", () => {
    const r = makeBazaarResource({
      extensions: { bazaar: { info: { output: { type: "object", example: { key: "value" } } } } },
    });
    expect(hasSchemaExample(r)).toBe(true);
  });

  it("returns false when output has no example", () => {
    const r = makeBazaarResource({
      extensions: { bazaar: { info: { output: { type: "object" } } } },
    });
    expect(hasSchemaExample(r)).toBe(false);
  });

  it("returns false when no extensions", () => {
    const r = makeBazaarResource({ extensions: undefined });
    expect(hasSchemaExample(r)).toBe(false);
  });
});
