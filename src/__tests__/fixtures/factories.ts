import type { Merchant, Resource, Category, Trend, BazaarResource } from "@/lib/types";
import type { MerchantData } from "@/lib/analytics/ranker";

let idCounter = 0;

function nextId(): string {
  idCounter++;
  const hex = idCounter.toString(16).padStart(12, "0");
  return `00000000-0000-0000-0000-${hex}`;
}

export function resetIdCounter(): void {
  idCounter = 0;
}

export function makeMerchant(overrides: Partial<Merchant> = {}): Merchant {
  const id = overrides.id ?? nextId();
  return {
    id,
    payeeAddress: `0x${id.replace(/-/g, "").slice(0, 40)}`,
    facilitator: null,
    chain: "base",
    firstSeenAt: new Date("2024-01-01"),
    lastUpdated: new Date("2024-06-01"),
    txCount: 0,
    totalAmountUsd: "0",
    uniqueBuyers: 0,
    uniqueSellers: 0,
    volume30d: "0",
    txCount30d: 0,
    buyers30d: 0,
    rankerScore: "0",
    rankPosition: null,
    categoryId: null,
    metadata: {},
    ...overrides,
  };
}

export function makeResource(
  merchantId: string,
  overrides: Partial<Resource> = {},
): Resource {
  const id = overrides.id ?? nextId();
  return {
    id,
    resourceUrl: `https://api.example.com/resource/${id}`,
    merchantId,
    originId: null,
    serviceName: "Test Service",
    description: "A".repeat(200),
    tags: ["api", "test"],
    hasInputSchema: false,
    hasOutputExample: false,
    toolCalls: 0,
    priceUsd: "0.01",
    chain: "base",
    l30dCalls: 0,
    l30dUniquePayers: 0,
    lastCalledAt: null,
    overallScore: null,
    volumeScore: null,
    recencyScore: null,
    performanceScore: null,
    reliabilityScore: null,
    avgLatencyMs: null,
    apiSuccessRate: null,
    firstSeenAt: new Date("2024-01-01"),
    lastUpdated: new Date("2024-06-01"),
    ...overrides,
  };
}

export function makeCategory(overrides: Partial<Category> = {}): Category {
  return {
    id: overrides.id ?? nextId(),
    name: "api",
    color: null,
    description: null,
    merchantCount: 5,
    medianPrice: "0.01",
    createdAt: new Date("2024-01-01"),
    ...overrides,
  };
}

export function makeMerchantData(
  overrides: {
    merchant?: Partial<Merchant>;
    resources?: Partial<Resource>[];
    category?: Partial<Category> | null;
  } = {},
): MerchantData {
  const merchant = makeMerchant(overrides.merchant);
  const cat = overrides.category === null
    ? null
    : makeCategory(overrides.category);

  if (cat && !merchant.categoryId) {
    merchant.categoryId = cat.id;
  }

  const resourceOverrides = overrides.resources ?? [{}];
  const res = resourceOverrides.map((ro) => makeResource(merchant.id, ro));

  return { merchant, resources: res, category: cat };
}

export function makeBazaarResource(
  overrides: Partial<BazaarResource> = {},
): BazaarResource {
  return {
    resource: `https://api.example.com/bazaar/${nextId()}`,
    type: "tool",
    serviceName: "Test Bazaar Service",
    description: "A test bazaar resource",
    tags: ["api"],
    quality: {
      l30DaysTotalCalls: 10,
      l30DaysUniquePayers: 3,
      lastCalledAt: "2024-06-01T00:00:00Z",
    },
    accepts: [
      {
        amount: "0.01",
        asset: "USDC",
        network: "base",
        payTo: "0x1234567890abcdef1234567890abcdef12345678",
        scheme: "exact",
      },
    ],
    ...overrides,
  };
}

export function makeTrend(
  merchantId: string,
  overrides: Partial<Trend> = {},
): Trend {
  return {
    id: overrides.id ?? nextId(),
    merchantId,
    snapshotDate: "2024-06-01",
    rankPosition: 1,
    rankerScore: "0.5",
    txCount30d: 10,
    uniqueBuyers: 5,
    totalAmount: "100",
    ...overrides,
  };
}
