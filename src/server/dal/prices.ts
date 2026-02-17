import { db } from "@/db";
import { priceCache } from "@/db/schema/price-cache";
import { eq, inArray, desc } from "drizzle-orm";
import { auth } from "@clerk/nextjs/server";

// ─── Types ───────────────────────────────────────────────────────────

interface UpdatePriceCacheInput {
  ticker: string;
  priceCents: number;
  /** Raw dollar price for full precision (supports sub-cent meme coins). */
  priceDollars?: number | null;
  previousCloseCents?: number | null;
  changeCents?: number | null;
  changePercent?: string | null;
  volume?: number | null;
  marketCapCents?: number | null;
  name?: string | null;
  sector?: string | null;
}

interface SetManualPriceInput {
  ticker: string;
  priceCents: number;
  /** Raw dollar price for full precision. */
  priceDollars: number;
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
 *
 * IMPORTANT: This does NOT set isManualOverride — it always writes
 * false. Use `setManualPrice` for user-set price overrides.
 */
export async function updatePriceCache(input: UpdatePriceCacheInput) {
  const now = new Date();
  const ticker = input.ticker.toUpperCase();

  const priceDollars = input.priceDollars ?? input.priceCents / 100;

  const [price] = await db
    .insert(priceCache)
    .values({
      ticker,
      priceCents: input.priceCents,
      priceDollars,
      previousCloseCents: input.previousCloseCents ?? null,
      changeCents: input.changeCents ?? null,
      changePercent: input.changePercent ?? null,
      volume: input.volume ?? null,
      marketCapCents: input.marketCapCents ?? null,
      name: input.name ?? null,
      sector: input.sector ?? null,
      isManualOverride: false,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: priceCache.ticker,
      set: {
        priceCents: input.priceCents,
        priceDollars,
        previousCloseCents: input.previousCloseCents ?? null,
        changeCents: input.changeCents ?? null,
        changePercent: input.changePercent ?? null,
        volume: input.volume ?? null,
        marketCapCents: input.marketCapCents ?? null,
        name: input.name ?? null,
        sector: input.sector ?? null,
        isManualOverride: false,
        updatedAt: now,
      },
    })
    .returning();

  return price;
}

/**
 * Set a manual price override for a ticker.
 * This price will NOT be overwritten by the automated refresh pipeline.
 * Requires authentication.
 */
export async function setManualPrice(input: SetManualPriceInput) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const now = new Date();
  const ticker = input.ticker.toUpperCase();

  const [price] = await db
    .insert(priceCache)
    .values({
      ticker,
      priceCents: input.priceCents,
      priceDollars: input.priceDollars,
      isManualOverride: true,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: priceCache.ticker,
      set: {
        priceCents: input.priceCents,
        priceDollars: input.priceDollars,
        isManualOverride: true,
        updatedAt: now,
      },
    })
    .returning();

  return price;
}

/**
 * Remove the manual override for a ticker, allowing the refresh
 * pipeline to update its price automatically again.
 * Requires authentication.
 */
export async function clearManualOverride(ticker: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  await db
    .update(priceCache)
    .set({ isManualOverride: false })
    .where(eq(priceCache.ticker, ticker.toUpperCase()));
}

/**
 * Get tickers that have a manual price override.
 * Used by the refresh pipeline to skip them.
 */
export async function getManualOverrideTickers(): Promise<Set<string>> {
  const rows = await db
    .select({ ticker: priceCache.ticker })
    .from(priceCache)
    .where(eq(priceCache.isManualOverride, true));

  return new Set(rows.map((r) => r.ticker));
}

/**
 * Get the most recent updatedAt timestamp from the price cache.
 * Used to display "Prices as of X minutes ago" in the UI.
 * Requires authentication.
 */
export async function getLatestPriceUpdate(): Promise<Date | null> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const [row] = await db
    .select({ updatedAt: priceCache.updatedAt })
    .from(priceCache)
    .orderBy(desc(priceCache.updatedAt))
    .limit(1);

  return row?.updatedAt ?? null;
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
