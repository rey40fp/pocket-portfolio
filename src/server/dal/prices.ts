import { db } from "@/db";
import { priceCache } from "@/db/schema/price-cache";
import { eq, inArray } from "drizzle-orm";
import { auth } from "@clerk/nextjs/server";

// ─── Types ───────────────────────────────────────────────────────────

interface UpdatePriceCacheInput {
  ticker: string;
  priceCents: number;
  previousCloseCents?: number | null;
  changeCents?: number | null;
  changePercent?: string | null;
  volume?: number | null;
  marketCapCents?: number | null;
  name?: string | null;
  sector?: string | null;
}

// ─── DAL Functions ───────────────────────────────────────────────────

/**
 * Get the cached price for a single ticker.
 * Requires authentication.
 */
export async function getCachedPrice(ticker: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const [price] = await db
    .select()
    .from(priceCache)
    .where(eq(priceCache.ticker, ticker.toUpperCase()));

  return price ?? null;
}

/**
 * Get cached prices for multiple tickers at once.
 * Requires authentication. Returns an array of price records.
 */
export async function batchGetPrices(tickers: string[]) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  if (tickers.length === 0) return [];

  const upperTickers = tickers.map((t) => t.toUpperCase());

  return db
    .select()
    .from(priceCache)
    .where(inArray(priceCache.ticker, upperTickers));
}

/**
 * Upsert a price record in the cache.
 *
 * Called by the background cron job that fetches prices from the
 * market data API. This function does NOT require an active user
 * session — it is designed to run in a server-side cron context
 * where auth is handled at the API route level.
 */
export async function updatePriceCache(input: UpdatePriceCacheInput) {
  const now = new Date();
  const ticker = input.ticker.toUpperCase();

  const [price] = await db
    .insert(priceCache)
    .values({
      ticker,
      priceCents: input.priceCents,
      previousCloseCents: input.previousCloseCents ?? null,
      changeCents: input.changeCents ?? null,
      changePercent: input.changePercent ?? null,
      volume: input.volume ?? null,
      marketCapCents: input.marketCapCents ?? null,
      name: input.name ?? null,
      sector: input.sector ?? null,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: priceCache.ticker,
      set: {
        priceCents: input.priceCents,
        previousCloseCents: input.previousCloseCents ?? null,
        changeCents: input.changeCents ?? null,
        changePercent: input.changePercent ?? null,
        volume: input.volume ?? null,
        marketCapCents: input.marketCapCents ?? null,
        name: input.name ?? null,
        sector: input.sector ?? null,
        updatedAt: now,
      },
    })
    .returning();

  return price;
}

/**
 * Batch upsert multiple price records.
 * Used by the cron job to refresh all tracked tickers at once.
 */
export async function batchUpdatePriceCache(inputs: UpdatePriceCacheInput[]) {
  if (inputs.length === 0) return [];

  const results = await Promise.all(inputs.map(updatePriceCache));
  return results;
}
