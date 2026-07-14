import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGet = vi.fn();
const mockSet = vi.fn();

vi.mock("@vercel/kv", () => ({
  kv: {
    get: (...args: unknown[]) => mockGet(...args),
    set: (...args: unknown[]) => mockSet(...args),
  },
}));

import { checkCache, setCache } from "@/lib/cache";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("checkCache", () => {
  it("returns cached value on hit", async () => {
    mockGet.mockResolvedValueOnce({ data: "cached" });
    const result = await checkCache<{ data: string }>("my-key");
    expect(result).toEqual({ data: "cached" });
    expect(mockGet).toHaveBeenCalledWith("my-key");
  });

  it("returns null on cache miss", async () => {
    mockGet.mockResolvedValueOnce(null);
    const result = await checkCache("unknown-key");
    expect(result).toBeNull();
  });

  it("returns null and swallows KV errors", async () => {
    mockGet.mockRejectedValueOnce(new Error("KV connection refused"));
    const result = await checkCache("any-key");
    expect(result).toBeNull();
  });
});

describe("setCache", () => {
  it("writes value with TTL", async () => {
    mockSet.mockResolvedValueOnce("OK");
    await setCache("key", { value: 42 }, 3600);
    expect(mockSet).toHaveBeenCalledWith("key", { value: 42 }, { ex: 3600 });
  });

  it("swallows KV errors without throwing", async () => {
    mockSet.mockRejectedValueOnce(new Error("KV write failed"));
    await expect(setCache("key", "value", 60)).resolves.toBeUndefined();
  });
});
