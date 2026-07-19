import { createRouterFromEnv } from "@agentcash/router";

/**
 * Central @agentcash/router instance. Reads CDP keys, EVM payee, BASE_URL, and
 * KV credentials from the environment (validated up front; throws a single
 * RouterConfigError listing every problem if misconfigured).
 *
 * Every route module registers itself against this instance via a side-effect
 * import; see `@/lib/routes-barrel`, which the discovery endpoints import so the
 * full registry is visible to OpenAPI / .well-known / llms.txt.
 */
export const router = createRouterFromEnv({
  title: "decipher-ranker",
  description:
    "Merchant analytics and ranking for the x402 ecosystem. Get rank position, competitor benchmarks, pricing analysis, and improvement recommendations.",
  guidance: `decipher-ranker helps API providers understand their marketplace position.

FREE ENDPOINTS (no payment):
- GET /categories — Browse all API categories with counts
- GET /leaderboard — Top APIs by category
- POST /report/origin — Basic rank report for your origin (SIWX wallet identity required)

PAID ENDPOINTS ($0.03 each):
- POST /report/competitive — Deep competitive analysis with gap analysis
- POST /report/merchant — Deep-dive on any merchant by address

The free /report/origin endpoint requires wallet identity (SIWX) but no payment. Paid endpoints accept x402 (USDC on Base) or MPP (USDC on Tempo).`,
  strictRoutes: true,
  // Paid routes accept both rails: x402 (Base/USDC) and MPP (Tempo/USDC).
  // MPP config is read from env (MPP_SECRET_KEY + MPP_CURRENCY; recipient reuses
  // EVM_PAYEE_ADDRESS). Listed explicitly rather than relying on the
  // MPP_SECRET_KEY auto-enable, so the two rails are self-documented in code.
  protocols: ["x402", "mpp"],
  contact: {
    email: "zaryabafser2000@gmail.com",
  },
});
