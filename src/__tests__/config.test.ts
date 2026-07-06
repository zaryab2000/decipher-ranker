import { describe, it, expect } from "vitest";
import { REPORT_COST_USDC } from "@/lib/config";

describe("config", () => {
  it("REPORT_COST_USDC equals '0.03'", () => {
    expect(REPORT_COST_USDC).toBe("0.03");
  });
});
