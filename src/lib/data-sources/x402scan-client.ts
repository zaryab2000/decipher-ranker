import { x402Client, x402HTTPClient } from "@x402/core/client";
import type { PaymentRequirements } from "@x402/core/types";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { privateKeyToAccount } from "viem/accounts";

/**
 * Outbound x402 payment client for x402scan.
 *
 * x402scan's stats API is itself x402-paid: an unauthenticated fetch returns
 * 402. This module builds an {@link x402HTTPClient} from a funded Base wallet and
 * exposes {@link payAndFetch}, which performs the 402 → sign → retry loop the
 * core SDK does not do automatically.
 *
 * When `X402SCAN_PAYER_PRIVATE_KEY` is absent the client is null and
 * `payAndFetch` returns null, so callers degrade gracefully to "stats
 * unavailable" rather than erroring.
 */

/** USDC on Base has 6 decimals. */
const USDC_DECIMALS = 6;
/**
 * Hard ceiling on a single x402scan payment. A malformed or hostile 402 cannot
 * authorize more than this; requirements above it are filtered out, which makes
 * payment creation fail closed (no payload, no charge).
 */
const MAX_PAYMENT_USDC = 0.05;

let cachedClient: x402HTTPClient | null | undefined;

/** Lazily build (once) the x402 HTTP client, or null when no payer key is set. */
function getClient(): x402HTTPClient | null {
  if (cachedClient !== undefined) return cachedClient;

  const privateKey = process.env.X402SCAN_PAYER_PRIVATE_KEY;
  if (!privateKey) {
    cachedClient = null;
    return null;
  }

  const account = privateKeyToAccount(privateKey as `0x${string}`);
  const core = new x402Client();
  registerExactEvmScheme(core, {
    signer: account,
    policies: [maxPricePolicy],
  });

  cachedClient = new x402HTTPClient(core);
  return cachedClient;
}

/** Drop any payment requirement priced above the ceiling (fail closed). */
function maxPricePolicy(
  _version: number,
  requirements: PaymentRequirements[],
): PaymentRequirements[] {
  const maxAtomic = BigInt(Math.round(MAX_PAYMENT_USDC * 10 ** USDC_DECIMALS));
  return requirements.filter((r) => {
    try {
      return BigInt(r.amount) <= maxAtomic;
    } catch {
      return false;
    }
  });
}

/**
 * Fetch a URL, paying the x402 charge if the server answers 402.
 *
 * Returns the parsed JSON body on success, or null when: no payer wallet is
 * configured, the 402 exceeds the price cap, payment fails, or the response is
 * not 200. Never throws — the merchant report treats null as "stats unavailable".
 */
export async function payAndFetch<T>(url: string): Promise<T | null> {
  const client = getClient();
  if (!client) return null;

  try {
    const initial = await fetch(url, {
      headers: { "Content-Type": "application/json" },
    });

    if (initial.ok) {
      return (await initial.json()) as T;
    }
    if (initial.status !== 402) return null;

    // Decode the 402, create + sign a payment, retry with the payment header.
    const paymentRequired = client.getPaymentRequiredResponse(
      (name) => initial.headers.get(name),
      await safeJson(initial),
    );
    const payload = await client.createPaymentPayload(paymentRequired);
    const paymentHeaders = client.encodePaymentSignatureHeader(payload);

    const paid = await fetch(url, {
      headers: { "Content-Type": "application/json", ...paymentHeaders },
    });
    if (!paid.ok) return null;

    return (await paid.json()) as T;
  } catch {
    return null;
  }
}

/** Read a response body as JSON without throwing (v1 402s carry data in the body). */
async function safeJson(response: Response): Promise<unknown> {
  try {
    return await response.clone().json();
  } catch {
    return undefined;
  }
}
