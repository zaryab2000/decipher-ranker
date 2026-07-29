import { describe, it, expect } from "vitest";
import { computeServiceNameQuality } from "@/lib/analytics/service-name-quality";

describe("computeServiceNameQuality", () => {
  it("returns 0 for null or empty", () => {
    expect(computeServiceNameQuality(null)).toBe(0);
    expect(computeServiceNameQuality("")).toBe(0);
    expect(computeServiceNameQuality("   ")).toBe(0);
  });

  it("returns 0.1 for generic names", () => {
    expect(computeServiceNameQuality("API")).toBe(0.1);
    expect(computeServiceNameQuality("Service")).toBe(0.1);
    expect(computeServiceNameQuality("tool")).toBe(0.1);
    expect(computeServiceNameQuality("test")).toBe(0.1);
  });

  it("returns 1.0 for specific multi-word capitalized names", () => {
    expect(computeServiceNameQuality("Weather Forecast API")).toBe(1.0);
    expect(computeServiceNameQuality("Shared Inference Output")).toBe(1.0);
    expect(computeServiceNameQuality("Business Change Intelligence API")).toBe(1.0);
  });

  it("returns 0.8 for hyphenated names", () => {
    expect(computeServiceNameQuality("basescout-feed")).toBe(0.8);
    expect(computeServiceNameQuality("agent-id-x402")).toBe(0.8);
  });

  it("returns 0.7 for single capitalized words 5+ chars", () => {
    expect(computeServiceNameQuality("StableEnrich")).toBe(0.7);
    expect(computeServiceNameQuality("Relaystation")).toBe(0.7);
  });

  it("returns 0.5 for single lowercase words 5+ chars", () => {
    expect(computeServiceNameQuality("scoop")).toBe(0.5);
    expect(computeServiceNameQuality("feeler")).toBe(0.5);
  });

  it("returns 0.3 for 3-4 char lowercase abbreviations", () => {
    expect(computeServiceNameQuality("wxyz")).toBe(0.3);
  });
});
