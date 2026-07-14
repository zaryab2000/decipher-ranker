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
