import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// shadcn/ui class merge utility
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Tremor Raw cx — alias for cn (used by Tremor components)
export function cx(...args: ClassValue[]) {
  return twMerge(clsx(...args));
}

// Tremor Raw focusInput [v0.0.2]
export const focusInput = [
  "focus:ring-2",
  "focus:ring-blue-200 dark:focus:ring-blue-700/30",
  "focus:border-blue-500 dark:focus:border-blue-700",
];

// Tremor Raw focusRing [v0.0.1]
export const focusRing = [
  "outline outline-offset-2 outline-0 focus-visible:outline-2",
  "outline-blue-500 dark:outline-blue-500",
];

// Tremor Raw hasErrorInput [v0.0.1]
export const hasErrorInput = [
  "ring-2",
  "border-red-500 dark:border-red-700",
  "ring-red-200 dark:ring-red-700/30",
];

// ─── Financial formatting ────────────────────────────────────────────

interface FormatCurrencyOptions {
  /** Show +/− sign for positive/negative values. Default: false */
  showSign?: boolean;
  /** Minimum fraction digits. Default: 2 */
  minimumFractionDigits?: number;
  /** Maximum fraction digits. Default: 2 */
  maximumFractionDigits?: number;
  /** Compact display for large numbers (e.g. $1.2M). Default: false */
  compact?: boolean;
}

/**
 * Converts an integer cents value to a formatted USD string.
 *
 * All monetary values in the database are stored as integer cents (BIGINT).
 * This function is the **only** place where cents → display conversion happens.
 *
 * @example
 *   formatCurrency(15050)      // "$150.50"
 *   formatCurrency(-15050)     // "-$150.50"
 *   formatCurrency(0)          // "$0.00"
 *   formatCurrency(123456789)  // "$1,234,567.89"
 *   formatCurrency(15050, { showSign: true })  // "+$150.50"
 *   formatCurrency(-15050, { showSign: true }) // "-$150.50"
 *   formatCurrency(123456789000, { compact: true }) // "$1.23B"
 */
export const formatCurrency = (
  cents: number,
  options: FormatCurrencyOptions = {},
): string => {
  const {
    showSign = false,
    minimumFractionDigits = 2,
    maximumFractionDigits = 2,
    compact = false,
  } = options;

  const dollars = cents / 100;

  const formatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: compact ? 0 : minimumFractionDigits,
    maximumFractionDigits: compact ? 2 : maximumFractionDigits,
    notation: compact ? "compact" : "standard",
    signDisplay: showSign ? "exceptZero" : "auto",
  });

  return formatter.format(dollars);
};

/**
 * Formats a percentage value for display.
 *
 * @example
 *   formatPercent(12.5)                      // "12.50%"
 *   formatPercent(-3.25)                     // "-3.25%"
 *   formatPercent(12.5, { showSign: true })  // "+12.50%"
 */
export const formatPercent = (
  value: number,
  options: { showSign?: boolean; decimals?: number } = {},
): string => {
  const { showSign = false, decimals = 2 } = options;

  const formatted = Math.abs(value).toFixed(decimals);
  const sign = value > 0 && showSign ? "+" : value < 0 ? "-" : "";

  return `${sign}${formatted}%`;
};

/**
 * Formats a number of shares/units for display.
 * Uses up to 8 decimal places (matches NUMERIC(18,8) in the DB)
 * but trims trailing zeros for cleanliness.
 *
 * @example
 *   formatShares(100)         // "100"
 *   formatShares(10.5)        // "10.5"
 *   formatShares(0.00125000)  // "0.00125"
 */
export const formatShares = (shares: number): string => {
  if (Number.isInteger(shares)) return shares.toLocaleString("en-US");

  // Format with up to 8 decimals, then strip trailing zeros
  const formatted = shares.toFixed(8).replace(/\.?0+$/, "");
  const [intPart, decPart] = formatted.split(".");

  const intFormatted = Number(intPart).toLocaleString("en-US");
  return decPart ? `${intFormatted}.${decPart}` : intFormatted;
};
