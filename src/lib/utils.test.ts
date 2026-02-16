import { describe, expect, it } from "vitest";
import { formatCurrency, formatPercent, formatShares } from "./utils";

describe("formatCurrency", () => {
  it("converts positive cents to dollar string", () => {
    expect(formatCurrency(15050)).toBe("$150.50");
  });

  it("converts negative cents (losses)", () => {
    expect(formatCurrency(-15050)).toBe("-$150.50");
  });

  it("handles zero", () => {
    expect(formatCurrency(0)).toBe("$0.00");
  });

  it("handles single cent", () => {
    expect(formatCurrency(1)).toBe("$0.01");
    expect(formatCurrency(-1)).toBe("-$0.01");
  });

  it("formats large numbers with commas", () => {
    expect(formatCurrency(123456789)).toBe("$1,234,567.89");
  });

  it("shows + sign when showSign is true", () => {
    expect(formatCurrency(15050, { showSign: true })).toBe("+$150.50");
  });

  it("shows - sign when showSign is true for negative", () => {
    expect(formatCurrency(-15050, { showSign: true })).toBe("-$150.50");
  });

  it("does not show sign for zero with showSign", () => {
    expect(formatCurrency(0, { showSign: true })).toBe("$0.00");
  });

  it("uses compact notation for large values", () => {
    const result = formatCurrency(123456789000, { compact: true });
    expect(result).toContain("B");
  });

  it("uses compact notation for millions", () => {
    const result = formatCurrency(100000000, { compact: true });
    expect(result).toContain("M");
  });
});

describe("formatPercent", () => {
  it("formats positive percentage", () => {
    expect(formatPercent(12.5)).toBe("12.50%");
  });

  it("formats negative percentage", () => {
    expect(formatPercent(-3.25)).toBe("-3.25%");
  });

  it("handles zero", () => {
    expect(formatPercent(0)).toBe("0.00%");
  });

  it("shows + sign when requested", () => {
    expect(formatPercent(12.5, { showSign: true })).toBe("+12.50%");
  });

  it("respects custom decimal places", () => {
    expect(formatPercent(12.567, { decimals: 1 })).toBe("12.6%");
  });
});

describe("formatShares", () => {
  it("formats whole numbers", () => {
    expect(formatShares(100)).toBe("100");
  });

  it("formats with thousands separator", () => {
    expect(formatShares(1000)).toBe("1,000");
  });

  it("preserves meaningful decimals", () => {
    expect(formatShares(10.5)).toBe("10.5");
  });

  it("trims trailing zeros", () => {
    expect(formatShares(0.00125)).toBe("0.00125");
  });

  it("handles fractional crypto amounts", () => {
    expect(formatShares(0.00000001)).toBe("0.00000001");
  });
});
