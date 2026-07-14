import { describe, it, expect, beforeAll, afterAll } from "vitest";

describe("routes-barrel", () => {
  const originalEnv: Record<string, string | undefined> = {};

  beforeAll(() => {
    originalEnv.BASE_URL = process.env.BASE_URL;
    originalEnv.EVM_PAYEE_ADDRESS = process.env.EVM_PAYEE_ADDRESS;
    originalEnv.CDP_API_KEY_ID = process.env.CDP_API_KEY_ID;
    originalEnv.CDP_API_KEY_SECRET = process.env.CDP_API_KEY_SECRET;
    originalEnv.POSTGRES_URL = process.env.POSTGRES_URL;
    originalEnv.KV_REST_API_URL = process.env.KV_REST_API_URL;
    originalEnv.KV_REST_API_TOKEN = process.env.KV_REST_API_TOKEN;

    process.env.BASE_URL = "http://localhost:3000";
    process.env.EVM_PAYEE_ADDRESS =
      "0x289AA17875D1Adbe3Dc66d7658218D14258D81f2";
    process.env.CDP_API_KEY_ID = "test-key-id";
    process.env.CDP_API_KEY_SECRET = "test-key-secret";
    process.env.KV_REST_API_URL = "https://test.upstash.io";
    process.env.KV_REST_API_TOKEN = "test-token";
    process.env.POSTGRES_URL =
      "postgresql://user:pass@ep-test.c-2.ap-southeast-1.aws.neon.tech/db";
  });

  afterAll(() => {
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  it("registers all 5 API routes after barrel import", async () => {
    const { router } = await import("@/lib/router");
    await import("@/lib/routes-barrel");

    const expectedRoutes = [
      "categories",
      "leaderboard",
      "report/origin",
      "report/competitive",
      "report/merchant",
    ];

    for (const route of expectedRoutes) {
      expect(router.registry.has(route)).toBe(true);
    }
    expect(router.registry.size).toBe(5);
  });

  it("registers categories as unprotected", async () => {
    const { router } = await import("@/lib/router");
    await import("@/lib/routes-barrel");

    const entry = router.registry.get("categories");
    expect(entry?.authMode).toBe("unprotected");
  });

  it("registers report/origin as SIWX", async () => {
    const { router } = await import("@/lib/router");
    await import("@/lib/routes-barrel");

    const entry = router.registry.get("report/origin");
    expect(entry?.authMode).toBe("siwx");
  });

  it("registers report/competitive and report/merchant as paid", async () => {
    const { router } = await import("@/lib/router");
    await import("@/lib/routes-barrel");

    const competitive = router.registry.get("report/competitive");
    expect(competitive?.authMode).toBe("paid");

    const merchant = router.registry.get("report/merchant");
    expect(merchant?.authMode).toBe("paid");
  });
});
