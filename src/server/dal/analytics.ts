import { db } from "@/db";
import { holdings } from "@/db/schema/holdings";
import { lots } from "@/db/schema/lots";
import { priceCache } from "@/db/schema/price-cache";
import { eq, and, isNull, inArray } from "drizzle-orm";
import { auth } from "@clerk/nextjs/server";
import { MARKET_ASSET_TYPES, type AssetType, type TimePeriod } from "@/lib/constants";

// ─── Types ───────────────────────────────────────────────────────────

export interface PortfolioValueDataPoint {
  /** ISO date string (YYYY-MM-DD) */
  date: string;
  /** Total portfolio value including deposits/withdrawals (cents) */
  totalValueCents: number;
  /** Investment return only — excludes deposits (cents). Starts from 0. */
  returnOnlyCents: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────

const isMarketAsset = (assetType: string): boolean =>
  MARKET_ASSET_TYPES.includes(assetType as AssetType);

/** Number of calendar days for each period */
const PERIOD_DAYS: Record<TimePeriod, number> = {
  "1W": 7,
  "1M": 30,
  "3M": 90,
  "6M": 180,
  "1Y": 365,
  ALL: 730,
};

/**
 * Seeded pseudo-random number generator (mulberry32).
 * Ensures the same inputs produce the same curve across page loads.
 */
function seededRandom(seed: number) {
  let t = seed + 0x6d2b79f5;
  return () => {
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ─── Portfolio Value History ─────────────────────────────────────────

/**
 * Generate simulated portfolio value history with two series:
 *
 * 1. **totalValueCents** — full portfolio value over time (includes deposits)
 * 2. **returnOnlyCents** — cumulative investment return only (excludes deposit
 *    contributions, starts from 0)
 *
 * Since historical snapshots aren't stored yet, both series are generated
 * synthetically from the current portfolio state using a seeded PRNG for
 * stable rendering across page loads.
 *
 * The deposit simulation models periodic contributions that grow the cost
 * basis over time, while the return series shows the pure investment gain
 * component separately.
 */
export async function getPortfolioValueHistory(): Promise<PortfolioValueDataPoint[]> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  // 1. Get all active holdings
  const userHoldings = await db
    .select()
    .from(holdings)
    .where(
      and(
        eq(holdings.userId, userId),
        eq(holdings.isLiquidated, false),
        isNull(holdings.deletedAt),
      ),
    );

  if (userHoldings.length === 0) return [];

  const holdingIds = userHoldings.map((h) => h.id);

  // 2. Get all non-liquidated lots
  const userLots = await db
    .select()
    .from(lots)
    .where(
      and(
        inArray(lots.holdingId, holdingIds),
        eq(lots.isLiquidated, false),
      ),
    );

  // 3. Get cached prices for market assets
  const marketTickers = [
    ...new Set(
      userHoldings
        .filter((h) => isMarketAsset(h.assetType) && h.ticker)
        .map((h) => h.ticker!.toUpperCase()),
    ),
  ];

  const prices =
    marketTickers.length > 0
      ? await db
          .select()
          .from(priceCache)
          .where(inArray(priceCache.ticker, marketTickers))
      : [];

  const priceMap = new Map(prices.map((p) => [p.ticker, p]));
  const holdingMap = new Map(userHoldings.map((h) => [h.id, h]));

  // 4. Compute current totals
  let currentNetWorth = 0;
  let totalCostBasis = 0;

  for (const lot of userLots) {
    const holding = holdingMap.get(lot.holdingId);
    if (!holding) continue;

    const shares = lot.shares ? parseFloat(lot.shares) : 0;
    const costBasis = lot.costBasisCents ?? 0;
    totalCostBasis += costBasis;

    if (isMarketAsset(holding.assetType) && holding.ticker) {
      const price = priceMap.get(holding.ticker.toUpperCase());
      if (price) {
        const dollars = price.priceDollars ?? price.priceCents / 100;
        currentNetWorth += Math.round(shares * dollars * 100);
      } else {
        currentNetWorth += costBasis;
      }
    } else {
      currentNetWorth += lot.currentValueCents ?? costBasis;
    }
  }

  // 5. Generate historical data for ALL periods (730 days)
  return generateValueHistory(currentNetWorth, totalCostBasis);
}

/**
 * Generates synthetic portfolio value history with two distinct series.
 *
 * The total value line models a portfolio that grows through both
 * deposits and investment returns. The return-only line isolates
 * the investment return component by subtracting cumulative deposits.
 */
function generateValueHistory(
  currentNetWorthCents: number,
  totalCostBasisCents: number,
): PortfolioValueDataPoint[] {
  const totalDays = PERIOD_DAYS.ALL;
  const today = new Date();
  const seed = currentNetWorthCents + totalCostBasisCents * 3;
  const rand = seededRandom(seed);

  // Current investment return = market value - cost basis
  const currentReturn = currentNetWorthCents - totalCostBasisCents;

  // Model: deposits accumulate gradually, returns grow on top
  // Start with ~20% of cost basis deposited at day 0
  const initialDeposit = totalCostBasisCents > 0
    ? totalCostBasisCents * (0.15 + rand() * 0.1)
    : 0;

  const points: PortfolioValueDataPoint[] = [];

  for (let i = totalDays; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);

    const progress = (totalDays - i) / totalDays;

    // Deposits accumulate with an S-curve (slow start, faster middle, taper)
    // This models realistic contribution behavior
    const depositProgress = Math.pow(progress, 0.7);
    const cumulativeDeposits = initialDeposit +
      (totalCostBasisCents - initialDeposit) * depositProgress;

    // Investment returns grow exponentially with noise
    const returnProgress = Math.pow(progress, 1.3);
    const baseReturn = currentReturn * returnProgress;

    // Add daily volatility to returns (±2% noise, dampened near end)
    const dampening = Math.max(0, 1 - progress * 1.05);
    const returnNoise = (rand() - 0.47) * 0.02 * Math.abs(baseReturn || cumulativeDeposits * 0.1) * dampening;

    // Final values for this day
    const returnValue = i === 0
      ? currentReturn
      : Math.round(baseReturn + returnNoise);

    const totalValue = i === 0
      ? currentNetWorthCents
      : Math.round(cumulativeDeposits + returnValue);

    const dateStr = date.toISOString().split("T")[0];
    points.push({
      date: dateStr,
      totalValueCents: totalValue,
      returnOnlyCents: returnValue,
    });
  }

  return points;
}
