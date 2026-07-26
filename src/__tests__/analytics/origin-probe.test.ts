import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Capture how the cached wrapper calls the KV read-through helper. Default:
// pass through to the fetcher (fail-open behavior of the real `cached`).
const mockCached = vi.fn(
  async (_key: string, _ttl: number, fetcher: () => Promise<unknown>) =>
    fetcher(),
);
vi.mock("@/lib/cache", () => ({
  cached: (...args: Parameters<typeof mockCached>) => mockCached(...args),
}));

import {
  checkDiscoveryLayers,
  checkDiscoveryLayersCached,
} from "@/lib/analytics/origin-probe";

const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch);
  mockFetch.mockReset();
  mockCached.mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function url(input: string | URL | Request): string {
  return typeof input === "string" ? input : input.toString();
}

describe("checkDiscoveryLayers", () => {
  it("returns CDP always indexed and probes x402scan + AgentCash in parallel", async () => {
    mockFetch.mockImplementation(async (input: string | URL | Request) => {
      const u = url(input);
      if (u.includes("x402scan.com/resources")) {
        return new Response(
          '<html><a href="/resources/stableenrich.dev">stableenrich.dev</a></html>',
          { status: 200 },
        );
      }
      if (u.includes("/openapi.json")) {
        return new Response("Not Found", { status: 404 });
      }
      throw new Error(`Unexpected URL: ${u}`);
    });

    const result = await checkDiscoveryLayers(
      "https://stableenrich.dev/api/google-maps/place-details/full",
    );

    expect(result.cdpBazaar.indexed).toBe(true);
    expect(result.x402scan.indexed).toBe(true);
    expect(result.agentCash.indexed).toBe(false);
    expect(result.layerAlignmentScore).toBe(2);
  });

  it("handles a probe throwing (timeout) gracefully — CDP still indexed", async () => {
    mockFetch.mockImplementation(async () => {
      throw new Error("timeout");
    });

    const result = await checkDiscoveryLayers("https://example.com/api/test");

    expect(result.cdpBazaar.indexed).toBe(true);
    expect(result.x402scan.indexed).toBe(false);
    expect(result.agentCash.indexed).toBe(false);
    expect(result.layerAlignmentScore).toBe(1);
  });

  it("handles an invalid resourceUrl — returns partial with CDP true", async () => {
    const result = await checkDiscoveryLayers("not-a-url");
    expect(result.cdpBazaar.indexed).toBe(true);
    expect(result.x402scan.indexed).toBe(false);
    expect(result.agentCash.indexed).toBe(false);
    expect(result.layerAlignmentScore).toBe(1);
    // No probe should have been attempted for an unparseable URL.
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("detects openapi.json with x-payment-info — agentCash indexed", async () => {
    mockFetch.mockImplementation(async (input: string | URL | Request) => {
      const u = url(input);
      if (u.includes("x402scan.com")) {
        return new Response("<html>not-found</html>", { status: 200 });
      }
      if (u.includes("/openapi.json")) {
        return new Response(
          JSON.stringify({
            paths: {
              "/api/test": {
                post: { "x-payment-info": { price: { amount: "0.01" } } },
              },
            },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      throw new Error(`Unexpected URL: ${u}`);
    });

    const result = await checkDiscoveryLayers("https://example.com/api/test");
    expect(result.agentCash.indexed).toBe(true);
    expect(result.layerAlignmentScore).toBe(2);
  });

  it("detects openapi.json WITHOUT x-payment-info — agentCash not indexed", async () => {
    mockFetch.mockImplementation(async (input: string | URL | Request) => {
      const u = url(input);
      if (u.includes("x402scan.com")) {
        return new Response("<html></html>", { status: 200 });
      }
      if (u.includes("/openapi.json")) {
        return new Response(JSON.stringify({ paths: { "/api/test": { post: {} } } }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      throw new Error(`Unexpected URL: ${u}`);
    });

    const result = await checkDiscoveryLayers("https://example.com/api/test");
    expect(result.agentCash.indexed).toBe(false);
    expect(result.agentCash.note).toContain("x-payment-info");
  });
});

describe("checkDiscoveryLayersCached", () => {
  it("caches per origin with a 1-hour TTL", async () => {
    mockFetch.mockImplementation(async (input: string | URL | Request) => {
      const u = url(input);
      if (u.includes("x402scan.com")) return new Response("<html></html>", { status: 200 });
      return new Response("Not Found", { status: 404 });
    });

    await checkDiscoveryLayersCached(
      "https://example.com/api/some/deep/path",
    );

    expect(mockCached).toHaveBeenCalledOnce();
    const [key, ttl] = mockCached.mock.calls[0];
    // Keyed by origin (not the full resource URL) so a merchant's resources
    // share one entry, with a 3600s TTL.
    expect(key).toBe("discovery:https://example.com");
    expect(ttl).toBe(3600);
  });

  it("bypasses the cache for an unparseable URL", async () => {
    mockFetch.mockImplementation(async () => new Response("x", { status: 404 }));

    const result = await checkDiscoveryLayersCached("not-a-url");

    // Falls through to a direct probe — cache is never consulted.
    expect(mockCached).not.toHaveBeenCalled();
    expect(result.cdpBazaar.indexed).toBe(true);
    expect(result.layerAlignmentScore).toBe(1);
  });
});
