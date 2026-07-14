import { describe, it, expect, beforeEach } from "vitest";
import {
  extractPayeeAddress,
  extractPriceUsd,
  extractChain,
  normalizeChain,
  hasInputSchema,
  hasOutputSchema,
  hasSchemaExample,
} from "@/lib/data-sources/bazaar";
import { makeBazaarResource, resetIdCounter } from "../fixtures/factories";

beforeEach(() => resetIdCounter());

describe("extractPayeeAddress", () => {
  it("lowercases the EVM payTo from the first accepts entry", () => {
    const r = makeBazaarResource({
      accepts: [{ amount: "1", asset: "USDC", network: "base", payTo: "0xABC", scheme: "exact" }],
    });
    expect(extractPayeeAddress(r)).toBe("0xabc");
  });

  it("preserves case for non-EVM (Solana) addresses", () => {
    const r = makeBazaarResource({
      accepts: [{ amount: "1", asset: "USDC", network: "solana", payTo: "So1AnaMixedCase", scheme: "exact" }],
    });
    expect(extractPayeeAddress(r)).toBe("So1AnaMixedCase");
  });

  it("returns null for empty accepts array", () => {
    const r = makeBazaarResource({ accepts: [] });
    expect(extractPayeeAddress(r)).toBeNull();
  });

  it("returns first payTo (lowercased) when multiple accepts", () => {
    const r = makeBazaarResource({
      accepts: [
        { amount: "1", asset: "USDC", network: "base", payTo: "0xFIRST", scheme: "exact" },
        { amount: "2", asset: "ETH", network: "ethereum", payTo: "0xSECOND", scheme: "exact" },
      ],
    });
    expect(extractPayeeAddress(r)).toBe("0xfirst");
  });
});

describe("extractPriceUsd", () => {
  it("decodes atomic USDC units (6 decimals) to USD", () => {
    // $0.05 USDC = 50000 atomic units
    const r = makeBazaarResource({
      accepts: [{ amount: "50000", asset: "USDC", network: "base", payTo: "0x1", scheme: "exact" }],
    });
    expect(extractPriceUsd(r)).toBe(0.05);
  });

  it("decodes a $1000 price expressed in base units", () => {
    const r = makeBazaarResource({
      accepts: [{ amount: "1000000000", asset: "USDC", network: "base", payTo: "0x1", scheme: "exact" }],
    });
    expect(extractPriceUsd(r)).toBe(1000);
  });

  it("honors an explicit decimals override in extra", () => {
    const r = makeBazaarResource({
      accepts: [{ amount: "1000000000000000000", asset: "0xabc", network: "base", payTo: "0x1", scheme: "exact", extra: { decimals: 18 } }],
    });
    expect(extractPriceUsd(r)).toBe(1);
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

  it("drops prices that decode above the reasonable USD ceiling", () => {
    // A non-USD/18-decimal token amount decoded as 6 decimals is absurd → null
    const r = makeBazaarResource({
      accepts: [{ amount: "1000000000000000000000", asset: "0xabc", network: "base", payTo: "0x1", scheme: "exact" }],
    });
    expect(extractPriceUsd(r)).toBeNull();
  });

  it("handles zero amount", () => {
    const r = makeBazaarResource({
      accepts: [{ amount: "0", asset: "USDC", network: "base", payTo: "0x1", scheme: "exact" }],
    });
    expect(extractPriceUsd(r)).toBe(0);
  });

  it("handles very small amounts (1 atomic unit)", () => {
    const r = makeBazaarResource({
      accepts: [{ amount: "1", asset: "USDC", network: "base", payTo: "0x1", scheme: "exact" }],
    });
    expect(extractPriceUsd(r)).toBe(0.000001);
  });
});

describe("normalizeChain", () => {
  it("maps CAIP-2 Base to 'base'", () => {
    expect(normalizeChain("eip155:8453")).toBe("base");
  });

  it("maps the shorthand 'base' to 'base'", () => {
    expect(normalizeChain("base")).toBe("base");
  });

  it("maps CAIP-2 Solana (any case) to 'solana'", () => {
    expect(normalizeChain("solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp")).toBe("solana");
  });

  it("maps CAIP-2 Polygon to 'polygon'", () => {
    expect(normalizeChain("eip155:137")).toBe("polygon");
  });

  it("returns null for testnets (base-sepolia, eip155:84532)", () => {
    expect(normalizeChain("base-sepolia")).toBeNull();
    expect(normalizeChain("eip155:84532")).toBeNull();
  });

  it("returns null for unsupported chains and empty input", () => {
    expect(normalizeChain("polkadot:2f0555cc")).toBeNull();
    expect(normalizeChain("ethereum")).toBeNull();
    expect(normalizeChain(null)).toBeNull();
    expect(normalizeChain(undefined)).toBeNull();
  });
});

describe("extractChain", () => {
  it("returns the canonical shorthand for a mainnet resource", () => {
    const r = makeBazaarResource({
      accepts: [{ amount: "1", asset: "USDC", network: "eip155:8453", payTo: "0x1", scheme: "exact" }],
    });
    expect(extractChain(r)).toBe("base");
  });

  it("returns null for a testnet resource (dropped from indexing)", () => {
    const r = makeBazaarResource({
      accepts: [{ amount: "1", asset: "USDC", network: "base-sepolia", payTo: "0x1", scheme: "exact" }],
    });
    expect(extractChain(r)).toBeNull();
  });

  it("returns null for empty accepts", () => {
    const r = makeBazaarResource({ accepts: [] });
    expect(extractChain(r)).toBeNull();
  });

  it("returns null when network is undefined", () => {
    const r = makeBazaarResource({
      accepts: [{ amount: "1", asset: "USDC", network: undefined as unknown as string, payTo: "0x1", scheme: "exact" }],
    });
    expect(extractChain(r)).toBeNull();
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
