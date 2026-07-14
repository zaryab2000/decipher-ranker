import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// SDK doubles. registerExactEvmScheme captures the policies so we can exercise
// the spend cap; the x402HTTPClient double drives the 402 -> pay -> retry loop.
const mockRegisterExactEvmScheme = vi.fn();
const mockGetPaymentRequiredResponse = vi.fn();
const mockCreatePaymentPayload = vi.fn();
const mockEncodePaymentSignatureHeader = vi.fn();

vi.mock("viem/accounts", () => ({
  privateKeyToAccount: (pk: string) => ({ address: "0xPayer", pk }),
}));

vi.mock("@x402/core/client", () => ({
  x402Client: class {},
  x402HTTPClient: class {
    getPaymentRequiredResponse = mockGetPaymentRequiredResponse;
    createPaymentPayload = mockCreatePaymentPayload;
    encodePaymentSignatureHeader = mockEncodePaymentSignatureHeader;
  },
}));

vi.mock("@x402/evm/exact/client", () => ({
  registerExactEvmScheme: (...args: unknown[]) => mockRegisterExactEvmScheme(...args),
}));

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => null },
    json: () => Promise.resolve(body),
    clone() {
      return this;
    },
  } as unknown as Response;
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.stubGlobal("fetch", vi.fn());
  process.env.X402SCAN_PAYER_PRIVATE_KEY = "0xabc";
  mockGetPaymentRequiredResponse.mockReturnValue({
    x402Version: 2,
    resource: {},
    accepts: [{ amount: "10000" }],
  });
  mockCreatePaymentPayload.mockResolvedValue({ x402Version: 2 });
  mockEncodePaymentSignatureHeader.mockReturnValue({ "X-PAYMENT": "signed" });
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.X402SCAN_PAYER_PRIVATE_KEY;
});

describe("payAndFetch", () => {
  it("returns null when no payer key is configured", async () => {
    delete process.env.X402SCAN_PAYER_PRIVATE_KEY;
    const { payAndFetch } = await import("@/lib/data-sources/x402scan-client");
    const result = await payAndFetch("https://x402scan.test/stats");
    expect(result).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("returns the body directly when the endpoint answers 200 (no payment)", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      jsonResponse({ totalTransactions: 42 }),
    );
    const { payAndFetch } = await import("@/lib/data-sources/x402scan-client");
    const result = await payAndFetch<{ totalTransactions: number }>(
      "https://x402scan.test/stats",
    );
    expect(result).toEqual({ totalTransactions: 42 });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(mockCreatePaymentPayload).not.toHaveBeenCalled();
  });

  it("pays on 402 and retries with the payment header", async () => {
    (fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(jsonResponse({ error: "payment required" }, 402))
      .mockResolvedValueOnce(jsonResponse({ totalTransactions: 99 }));

    const { payAndFetch } = await import("@/lib/data-sources/x402scan-client");
    const result = await payAndFetch<{ totalTransactions: number }>(
      "https://x402scan.test/stats",
    );

    expect(result).toEqual({ totalTransactions: 99 });
    expect(fetch).toHaveBeenCalledTimes(2);
    // The retry carries the signed payment header.
    const retryInit = (fetch as ReturnType<typeof vi.fn>).mock.calls[1][1] as RequestInit;
    expect((retryInit.headers as Record<string, string>)["X-PAYMENT"]).toBe("signed");
  });

  it("returns null when the paid retry is not ok", async () => {
    (fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(jsonResponse({}, 402))
      .mockResolvedValueOnce(jsonResponse({ error: "still nope" }, 402));

    const { payAndFetch } = await import("@/lib/data-sources/x402scan-client");
    const result = await payAndFetch("https://x402scan.test/stats");
    expect(result).toBeNull();
  });

  it("returns null on a non-402 error status without attempting payment", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(jsonResponse({}, 500));
    const { payAndFetch } = await import("@/lib/data-sources/x402scan-client");
    const result = await payAndFetch("https://x402scan.test/stats");
    expect(result).toBeNull();
    expect(mockCreatePaymentPayload).not.toHaveBeenCalled();
  });

  it("returns null (never throws) when fetch rejects", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("network"));
    const { payAndFetch } = await import("@/lib/data-sources/x402scan-client");
    const result = await payAndFetch("https://x402scan.test/stats");
    expect(result).toBeNull();
  });

  it("registers a spend-cap policy that rejects over-cap requirements", async () => {
    // Trigger client construction.
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(jsonResponse({}, 200));
    const { payAndFetch } = await import("@/lib/data-sources/x402scan-client");
    await payAndFetch("https://x402scan.test/stats");

    const config = mockRegisterExactEvmScheme.mock.calls[0][1] as {
      policies: Array<(v: number, reqs: unknown[]) => unknown[]>;
    };
    const policy = config.policies[0];
    // $0.05 cap = 50000 atomic USDC. 10000 passes, 60000 is filtered out.
    const filtered = policy(2, [{ amount: "10000" }, { amount: "60000" }]) as Array<{ amount: string }>;
    expect(filtered).toEqual([{ amount: "10000" }]);
  });
});
