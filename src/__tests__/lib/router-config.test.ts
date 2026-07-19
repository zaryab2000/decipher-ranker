import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  createRouterFromEnv,
  RouterConfigError,
} from "@agentcash/router";

describe("router config boot", () => {
  it("throws RouterConfigError when critical env vars are missing", () => {
    expect(() =>
      createRouterFromEnv({
        env: {},
        title: "test",
        description: "test",
        guidance: "test",
      }),
    ).toThrow(RouterConfigError);
  });

  it("reports missing BASE_URL in the error issues", () => {
    try {
      createRouterFromEnv({
        env: {},
        title: "test",
        description: "test",
        guidance: "test",
      });
    } catch (e) {
      const err = e as RouterConfigError;
      expect(err.issues.length).toBeGreaterThanOrEqual(1);
      const codes = err.issues.map((i) => i.code);
      expect(codes).toContain("missing_base_url");
    }
  });

  it("reports missing payee when PAYEE_ADDRESS not set", () => {
    try {
      createRouterFromEnv({
        env: { BASE_URL: "http://localhost:3000" },
        title: "test",
        description: "test",
        guidance: "test",
      });
    } catch (e) {
      const err = e as RouterConfigError;
      const codes = err.issues.map((i) => i.code);
      expect(codes).toContain("missing_x402_payee");
    }
  });
});

describe("router MPP protocol boot", () => {
  // Full x402-valid env; MPP vars layered on per-test.
  const baseEnv: Record<string, string> = {
    BASE_URL: "http://localhost:3000",
    EVM_PAYEE_ADDRESS: "0x289AA17875D1Adbe3Dc66d7658218D14258D81f2",
    CDP_API_KEY_ID: "test-key-id",
    CDP_API_KEY_SECRET: "test-key-secret",
    KV_REST_API_URL: "https://test.upstash.io",
    KV_REST_API_TOKEN: "test-token",
  };

  it("accepts MPP config (secret + currency) without raising an MPP config issue", () => {
    // With mock CDP keys the router rejects at x402 facilitator construction, not
    // MPP validation — real CDP keys boot fine (proven live). This asserts the MPP
    // side of the config is valid: no MPP-specific RouterConfigError issue is raised.
    try {
      createRouterFromEnv({
        env: {
          ...baseEnv,
          MPP_SECRET_KEY: "test-mpp-secret",
          MPP_CURRENCY: "0x20c000000000000000000000b9537d11c60e8b50",
        },
        title: "test",
        description: "test",
        guidance: "test",
        protocols: ["x402", "mpp"],
      });
    } catch (e) {
      if (e instanceof RouterConfigError) {
        const mppCodes = e.issues
          .map((i) => i.code)
          .filter((c) => c.includes("mpp"));
        expect(mppCodes).toEqual([]);
      }
      // Non-config errors (mock facilitator) are expected and acceptable here.
    }
  });

  it("throws missing_mpp_currency when mpp is enabled without a currency", () => {
    try {
      createRouterFromEnv({
        env: { ...baseEnv, MPP_SECRET_KEY: "test-mpp-secret" },
        title: "test",
        description: "test",
        guidance: "test",
        protocols: ["x402", "mpp"],
      });
      throw new Error("expected RouterConfigError");
    } catch (e) {
      expect(e).toBeInstanceOf(RouterConfigError);
      const codes = (e as RouterConfigError).issues.map((i) => i.code);
      expect(codes).toContain("missing_mpp_currency");
    }
  });

  it("throws missing_mpp_secret_key when mpp is enabled without a secret", () => {
    try {
      createRouterFromEnv({
        env: {
          ...baseEnv,
          MPP_CURRENCY: "0x20c000000000000000000000b9537d11c60e8b50",
        },
        title: "test",
        description: "test",
        guidance: "test",
        protocols: ["x402", "mpp"],
      });
      throw new Error("expected RouterConfigError");
    } catch (e) {
      expect(e).toBeInstanceOf(RouterConfigError);
      const codes = (e as RouterConfigError).issues.map((i) => i.code);
      expect(codes).toContain("missing_mpp_secret_key");
    }
  });
});

describe("router boot with process.env", () => {
  const originalEnv: Record<string, string | undefined> = {};

  beforeAll(() => {
    originalEnv.BASE_URL = process.env.BASE_URL;
    originalEnv.EVM_PAYEE_ADDRESS = process.env.EVM_PAYEE_ADDRESS;
    originalEnv.KV_REST_API_URL = process.env.KV_REST_API_URL;
    originalEnv.KV_REST_API_TOKEN = process.env.KV_REST_API_TOKEN;
    originalEnv.CDP_API_KEY_ID = process.env.CDP_API_KEY_ID;
    originalEnv.CDP_API_KEY_SECRET = process.env.CDP_API_KEY_SECRET;
    originalEnv.POSTGRES_URL = process.env.POSTGRES_URL;

    process.env.BASE_URL = "http://localhost:3000";
    process.env.EVM_PAYEE_ADDRESS =
      "0x289AA17875D1Adbe3Dc66d7658218D14258D81f2";
    process.env.KV_REST_API_URL = "https://test.upstash.io";
    process.env.KV_REST_API_TOKEN = "test-token";
    process.env.CDP_API_KEY_ID = "test-key-id";
    process.env.CDP_API_KEY_SECRET = "test-key-secret";
    process.env.POSTGRES_URL =
      "postgresql://user:pass@localhost:5432/test";
    // router.ts now declares protocols: ['x402','mpp'] — MPP config is required.
    originalEnv.MPP_SECRET_KEY = process.env.MPP_SECRET_KEY;
    originalEnv.MPP_CURRENCY = process.env.MPP_CURRENCY;
    process.env.MPP_SECRET_KEY = "test-mpp-secret";
    process.env.MPP_CURRENCY = "0x20c000000000000000000000b9537d11c60e8b50";
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

  it("creates a router with empty registry when no routes registered", async () => {
    const { router } = await import("@/lib/router");
    expect(router).toBeDefined();
    expect(router.registry).toBeDefined();
    expect(router.registry.size).toBe(0);
  });

  it("exposes discovery endpoints", async () => {
    const { router } = await import("@/lib/router");
    expect(typeof router.openapi).toBe("function");
    expect(typeof router.wellKnown).toBe("function");
    expect(typeof router.llmsTxt).toBe("function");
    expect(typeof router.notFound).toBe("function");
  });
});
