import { describe, it, expect } from "vitest";
import {
  formatNumber,
  formatPrice,
  formatRelativeDate,
  formatDate,
  toDisplayScore,
  formatPercent,
  truncate,
  formatAddress,
} from "@/dashboard/lib/formatters";

describe("formatNumber", () => {
  it("formats billions", () => {
    expect(formatNumber(1_500_000_000)).toBe("1.5B");
  });
  it("formats millions", () => {
    expect(formatNumber(2_500_000)).toBe("2.5M");
  });
  it("formats thousands", () => {
    expect(formatNumber(1_500)).toBe("1.5K");
  });
  it("returns raw for small numbers", () => {
    expect(formatNumber(0)).toBe("0");
    expect(formatNumber(42)).toBe("42");
  });
});

describe("formatPrice", () => {
  it("formats dollars with 2 decimals", () => {
    expect(formatPrice(5)).toBe("$5.00");
    expect(formatPrice(0.99)).toBe("$0.99");
  });
  it("formats sub-cent with 4 decimals", () => {
    expect(formatPrice(0.005)).toBe("$0.0050");
  });
});

describe("formatRelativeDate", () => {
  it('returns "just now" for recent timestamps', () => {
    const now = new Date();
    expect(formatRelativeDate(now.toISOString())).toBe("just now");
  });

  it("returns minute-based strings", () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
    expect(formatRelativeDate(fiveMinAgo.toISOString())).toBe("5 minutes ago");
  });

  it("returns hour-based strings", () => {
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);
    expect(formatRelativeDate(threeHoursAgo.toISOString())).toBe("3 hours ago");
  });

  it("returns day-based strings", () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    expect(formatRelativeDate(twoDaysAgo.toISOString())).toBe("2 days ago");
  });

  it("falls back to formatDate for > 30 days", () => {
    const twoMonthsAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
    const result = formatRelativeDate(twoMonthsAgo.toISOString());
    expect(result).not.toContain("ago");
    expect(result).toContain(twoMonthsAgo.getFullYear().toString());
  });

  it("accepts Date objects", () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
    expect(formatRelativeDate(fiveMinAgo)).toBe("5 minutes ago");
  });
});

describe("formatDate", () => {
  it("formats date in US locale", () => {
    const result = formatDate("2024-06-15");
    expect(result).toBe("Jun 15, 2024");
  });
});

describe("toDisplayScore", () => {
  it("converts a stored 0..1 score to the 0..100 display scale", () => {
    expect(toDisplayScore(0.6412)).toBe(64);
  });
  it("maps 1 to 100", () => {
    expect(toDisplayScore(1)).toBe(100);
  });
  it("maps 0 to 0", () => {
    expect(toDisplayScore(0)).toBe(0);
  });
  it("treats null and undefined as 0", () => {
    expect(toDisplayScore(null)).toBe(0);
    expect(toDisplayScore(undefined)).toBe(0);
  });
  it("clamps out-of-range input rather than returning >100 or <0", () => {
    expect(toDisplayScore(1.5)).toBe(100);
    expect(toDisplayScore(-0.2)).toBe(0);
  });
  it("rounds to the nearest integer", () => {
    expect(toDisplayScore(0.645)).toBe(65);
    expect(toDisplayScore(0.644)).toBe(64);
  });
});

describe("formatPercent", () => {
  it("formats decimal to percent string", () => {
    expect(formatPercent(0.75)).toBe("75%");
    expect(formatPercent(1)).toBe("100%");
    expect(formatPercent(0)).toBe("0%");
  });
});

describe("truncate", () => {
  it("does not truncate short strings", () => {
    expect(truncate("hello", 10)).toBe("hello");
  });
  it("truncates long strings with ellipsis", () => {
    expect(truncate("hello world this is long", 10)).toBe("hello w...");
  });
});

describe("formatAddress", () => {
  it("returns full address for short strings", () => {
    expect(formatAddress("abc")).toBe("abc");
  });
  it("truncates long addresses", () => {
    const addr = "0x1234567890abcdef1234567890abcdef12345678";
    expect(formatAddress(addr)).toBe("0x1234...5678");
  });
});
