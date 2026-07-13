import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFetchAllBazaarResources = vi.fn();
const mockUpsertCatalog = vi.fn();
const mockAssignAllMerchantCategories = vi.fn();
const mockScoreAllMerchants = vi.fn();
const mockRefreshCategoryCache = vi.fn();
const mockWriteDailySnapshot = vi.fn();

vi.mock("@/lib/data-sources/bazaar", () => ({
  fetchAllBazaarResources: () => mockFetchAllBazaarResources(),
}));

vi.mock("@/lib/data-sources/catalog-sync", () => ({
  upsertCatalog: (...args: unknown[]) => mockUpsertCatalog(...args),
}));

vi.mock("@/lib/analytics/categorizer", () => ({
  assignAllMerchantCategories: () => mockAssignAllMerchantCategories(),
}));

vi.mock("@/lib/analytics/ranker", () => ({
  scoreAllMerchants: () => mockScoreAllMerchants(),
}));

vi.mock("@/lib/services/categoryService", () => ({
  refreshCategoryCache: () => mockRefreshCategoryCache(),
}));

vi.mock("@/lib/services/trendService", () => ({
  writeDailySnapshot: () => mockWriteDailySnapshot(),
}));

vi.mock("@/lib/db", () => ({ db: {} }));

import { GET } from "@/app/api/cron/refresh-catalog/route";

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = "test-secret";
});

function makeRequest(auth?: string): Request {
  const headers: Record<string, string> = {};
  if (auth) headers["authorization"] = auth;
  return new Request("http://localhost/api/cron/refresh-catalog", { headers });
}

describe("GET /api/cron/refresh-catalog", () => {
  it("returns 401 when auth is missing", async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it("returns 401 when auth is wrong", async () => {
    const res = await GET(makeRequest("Bearer wrong-secret"));
    expect(res.status).toBe(401);
  });

  it("returns 200 with pipeline stats on valid auth", async () => {
    mockFetchAllBazaarResources.mockResolvedValueOnce([{}, {}]);
    mockUpsertCatalog.mockResolvedValueOnce({
      merchantsUpserted: 5,
      resourcesUpserted: 10,
      categoriesUpdated: 3,
    });
    mockAssignAllMerchantCategories.mockResolvedValueOnce(4);
    mockScoreAllMerchants.mockResolvedValueOnce(5);
    mockRefreshCategoryCache.mockResolvedValueOnce(3);
    mockWriteDailySnapshot.mockResolvedValueOnce(5);

    const res = await GET(makeRequest("Bearer test-secret"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ok");
    expect(body.resources_fetched).toBe(2);
    expect(body.merchants_upserted).toBe(5);
    expect(body.merchants_scored).toBe(5);
    expect(body.snapshots_written).toBe(5);
  });

  it("calls pipeline functions in correct order", async () => {
    const callOrder: string[] = [];
    mockFetchAllBazaarResources.mockImplementation(async () => {
      callOrder.push("fetch");
      return [];
    });
    mockUpsertCatalog.mockImplementation(async () => {
      callOrder.push("upsert");
      return { merchantsUpserted: 0, resourcesUpserted: 0, categoriesUpdated: 0 };
    });
    mockAssignAllMerchantCategories.mockImplementation(async () => {
      callOrder.push("categorize");
      return 0;
    });
    mockScoreAllMerchants.mockImplementation(async () => {
      callOrder.push("score");
      return 0;
    });
    mockRefreshCategoryCache.mockImplementation(async () => {
      callOrder.push("cache");
      return 0;
    });
    mockWriteDailySnapshot.mockImplementation(async () => {
      callOrder.push("snapshot");
      return 0;
    });

    await GET(makeRequest("Bearer test-secret"));
    expect(callOrder).toEqual(["fetch", "upsert", "categorize", "score", "cache", "snapshot"]);
  });

  it("returns 500 on pipeline error", async () => {
    mockFetchAllBazaarResources.mockRejectedValueOnce(new Error("API down"));
    const res = await GET(makeRequest("Bearer test-secret"));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.status).toBe("error");
  });
});
