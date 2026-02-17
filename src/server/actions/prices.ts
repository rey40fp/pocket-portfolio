"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getUserTrackedTickers } from "@/server/dal/holdings";
import {
  batchUpdatePriceCache,
  setManualPrice as setManualPriceInDB,
  clearManualOverride as clearManualOverrideInDB,
  getCachedPrice,
  getManualOverrideTickers,
} from "@/server/dal/prices";
import { fetchBatchQuotes } from "@/server/services/market-data";

// ─── In-memory rate limit (per-user, per-server-instance) ────────────
// Prevents a single user from hammering the refresh button.
// In production with multiple instances, consider Upstash Redis instead.

const rateLimitMap = new Map<string, number>();
const RATE_LIMIT_MS = 5 * 60 * 1000; // 5 minutes

function checkRateLimit(userId: string): { allowed: boolean; retryAfterMs: number } {
  const lastRefresh = rateLimitMap.get(userId);
  const now = Date.now();

  if (lastRefresh && now - lastRefresh < RATE_LIMIT_MS) {
    return {
      allowed: false,
      retryAfterMs: RATE_LIMIT_MS - (now - lastRefresh),
    };
  }

  return { allowed: true, retryAfterMs: 0 };
}

// ─── Server Action ───────────────────────────────────────────────────

export interface RefreshPricesResult {
  success: boolean;
  refreshed: number;
  skipped: number;
  failed: string[];
  lastUpdated: string;
  rateLimited?: boolean;
  retryAfterMs?: number;
  error?: string;
}

/**
 * Manually refresh market prices for the authenticated user's holdings.
 * Rate-limited to once every 5 minutes per user.
 */
export async function refreshPrices(): Promise<RefreshPricesResult> {
  const { userId } = await auth();
  if (!userId) {
    return {
      success: false,
      refreshed: 0,
      skipped: 0,
      failed: [],
      lastUpdated: new Date().toISOString(),
      error: "Unauthorized",
    };
  }

  // Check rate limit
  const { allowed, retryAfterMs } = checkRateLimit(userId);
  if (!allowed) {
    return {
      success: false,
      refreshed: 0,
      skipped: 0,
      failed: [],
      lastUpdated: new Date().toISOString(),
      rateLimited: true,
      retryAfterMs,
      error: `Rate limited. Try again in ${Math.ceil(retryAfterMs / 1000)}s.`,
    };
  }

  try {
    // 1. Get the user's unique tickers
    const trackedTickers = await getUserTrackedTickers(userId);

    if (trackedTickers.length === 0) {
      return {
        success: true,
        refreshed: 0,
        skipped: 0,
        failed: [],
        lastUpdated: new Date().toISOString(),
      };
    }

    // 2. Exclude manually-overridden tickers
    const manualOverrides = await getManualOverrideTickers();
    const tickersToFetch = trackedTickers.filter(
      (t) => !manualOverrides.has(t.ticker),
    );

    // 3. Fetch quotes (cash/money market tickers auto-skipped)
    const { quotes, failed, skipped } = await fetchBatchQuotes(
      tickersToFetch.map((t) => ({
        ticker: t.ticker,
        assetType: t.assetType,
      })),
    );

    // 3. Upsert into price_cache
    if (quotes.length > 0) {
      await batchUpdatePriceCache(
        quotes.map((q) => ({
          ticker: q.ticker,
          priceCents: q.priceCents,
          priceDollars: q.priceDollars,
          previousCloseCents: q.previousCloseCents,
          changeCents: q.changeCents,
          changePercent: q.changePercent,
          volume: q.volume,
        })),
      );
    }

    // Record the refresh time for rate limiting
    rateLimitMap.set(userId, Date.now());

    // Revalidate pages that show prices
    revalidatePath("/dashboard");
    revalidatePath("/holdings");
    revalidatePath("/accounts");

    return {
      success: true,
      refreshed: quotes.length,
      skipped: skipped.length,
      failed,
      lastUpdated: new Date().toISOString(),
    };
  } catch (error) {
    console.error("[refreshPrices] Failed:", error);
    return {
      success: false,
      refreshed: 0,
      skipped: 0,
      failed: [],
      lastUpdated: new Date().toISOString(),
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// ─── Manual Price Override ───────────────────────────────────────────

const setManualPriceSchema = z.object({
  ticker: z.string().min(1).max(10).toUpperCase(),
  priceDollars: z.number().positive("Price must be positive"),
});

export interface ManualPriceResult {
  success: boolean;
  error?: string;
}

/**
 * Set a manual price override for a ticker.
 * The automated refresh pipeline will skip this ticker until the
 * override is cleared.
 */
export async function setManualPriceAction(
  ticker: string,
  priceDollars: number,
): Promise<ManualPriceResult> {
  const { userId } = await auth();
  if (!userId) return { success: false, error: "Unauthorized" };

  const validated = setManualPriceSchema.safeParse({ ticker, priceDollars });
  if (!validated.success) {
    return {
      success: false,
      error: validated.error.issues[0]?.message ?? "Invalid input",
    };
  }

  try {
    const priceDollars = validated.data.priceDollars;
    const priceCents = Math.round(priceDollars * 100);
    await setManualPriceInDB({
      ticker: validated.data.ticker,
      priceCents,
      priceDollars,
    });

    revalidatePath("/dashboard");
    revalidatePath("/holdings", "layout");
    revalidatePath("/accounts", "layout");

    return { success: true };
  } catch (error) {
    console.error("[setManualPrice] Failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Clear the manual price override for a ticker, allowing the
 * automated refresh pipeline to update its price again.
 */
export async function clearManualOverrideAction(
  ticker: string,
): Promise<ManualPriceResult> {
  const { userId } = await auth();
  if (!userId) return { success: false, error: "Unauthorized" };

  try {
    await clearManualOverrideInDB(ticker);

    revalidatePath("/dashboard");
    revalidatePath("/holdings", "layout");
    revalidatePath("/accounts", "layout");

    return { success: true };
  } catch (error) {
    console.error("[clearManualOverride] Failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Check if a ticker currently has a manual price override.
 */
export async function getTickerPriceInfo(
  ticker: string,
): Promise<{ priceCents: number; isManualOverride: boolean } | null> {
  const { userId } = await auth();
  if (!userId) return null;

  try {
    const price = await getCachedPrice(ticker);
    if (!price) return null;
    return {
      priceCents: price.priceCents,
      isManualOverride: price.isManualOverride,
    };
  } catch {
    return null;
  }
}
