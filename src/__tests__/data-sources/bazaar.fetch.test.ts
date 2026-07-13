import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchAllBazaarResources } from "@/lib/data-sources/bazaar";
import { makeBazaarResource } from "../fixtures/factories";

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function mockFetchResponse(body: unknown, ok = true, status = 200) {
  return Promise.resolve({
    ok,
    status,
    statusText: ok ? "OK" : "Error",
    json: () => Promise.resolve(body),
  });
}

describe("fetchAllBazaarResources", () => {
  it("fetches a single page of results", async () => {
    const items = [makeBazaarResource()];
    (fetch as ReturnType<typeof vi.fn>).mockReturnValueOnce(
      mockFetchResponse({ items, pagination: { total: 1, offset: 0, limit: 100 } }),
    );

    const result = await fetchAllBazaarResources();
    expect(result).toHaveLength(1);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("fetches multiple pages", async () => {
    vi.useFakeTimers();
    const page1Items = Array.from({ length: 100 }, () => makeBazaarResource());
    const page2Items = [makeBazaarResource()];

    (fetch as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(
        mockFetchResponse({ items: page1Items, pagination: { total: 101, offset: 0, limit: 100 } }),
      )
      .mockReturnValueOnce(
        mockFetchResponse({ items: page2Items, pagination: { total: 101, offset: 100, limit: 100 } }),
      );

    const promise = fetchAllBazaarResources();
    await vi.advanceTimersByTimeAsync(5000);
    const result = await promise;
    expect(result).toHaveLength(101);
    expect(fetch).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it("throws on API error", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockReturnValueOnce(
      mockFetchResponse(null, false, 500),
    );

    await expect(fetchAllBazaarResources()).rejects.toThrow("Bazaar API error");
  });

  it("returns empty array when total is 0", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockReturnValueOnce(
      mockFetchResponse({ items: [], pagination: { total: 0, offset: 0, limit: 100 } }),
    );

    const result = await fetchAllBazaarResources();
    expect(result).toEqual([]);
  });

  it("constructs correct URL with offset", async () => {
    vi.useFakeTimers();
    const items = Array.from({ length: 100 }, () => makeBazaarResource());
    (fetch as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(
        mockFetchResponse({ items, pagination: { total: 150, offset: 0, limit: 100 } }),
      )
      .mockReturnValueOnce(
        mockFetchResponse({ items: [], pagination: { total: 150, offset: 100, limit: 100 } }),
      );

    const promise = fetchAllBazaarResources();
    await vi.advanceTimersByTimeAsync(5000);
    await promise;
    const secondCall = (fetch as ReturnType<typeof vi.fn>).mock.calls[1][0];
    expect(secondCall).toContain("offset=100");
    vi.useRealTimers();
  });
});
