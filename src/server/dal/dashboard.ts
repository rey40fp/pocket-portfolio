import { db } from "@/db";
import { holdings } from "@/db/schema/holdings";
import { lots } from "@/db/schema/lots";
import { priceCache } from "@/db/schema/price-cache";
import { auditLogs } from "@/db/schema/audit-logs";
import { eq, and, isNull, inArray, desc } from "drizzle-orm";
import { auth } from "@clerk/nextjs/server";
import { ASSET_TYPES, MARKET_ASSET_TYPES, type AssetType, type TimePeriod } from "@/lib/constants";

// ─── Types ───────────────────────────────────────────────────────────

export interface AssetAllocationSlice {
  assetType: AssetType;
  label: string;
  valueCents: number;
  percent: number;
}

export interface TopMover {
  ticker: string;
  name: string;
  changeCents: number;
  changePercent: number;
}

export interface TopMoversData {
  gainers: TopMover[];
  losers: TopMover[];
}

export interface NetWorthDataPoint {
  /** ISO date string (YYYY-MM-DD) */
  date: string;
  /** Net worth in cents */
  valueCents: number;
}

export interface DashboardKPIs {
  /** Total portfolio value in cents */
  netWorthCents: number;
  /** Day change from previous close in cents */
  dayChangeCents: number;
  /** Day change as a percentage */
  dayChangePercent: number;
  /** Unrealized gain/loss across all active holdings in cents */
  totalGainLossCents: number;
  /** Unrealized gain/loss as a percentage of cost basis */
  totalGainLossPercent: number;
  /** Total cost basis in cents */
  totalCostBasisCents: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────

const isMarketAsset = (assetType: string): boolean =>
  MARKET_ASSET_TYPES.includes(assetType as AssetType);

// ─── DAL Function ────────────────────────────────────────────────────

/**
 * Compute dashboard KPI values for the authenticated user.
 *
 * Gathers all active (non-liquidated, non-deleted) holdings and their
 * lots, enriches market assets with cached prices, and computes:
 *   - Net Worth (total current market value)
 *   - Day Change ($ and %)
 *   - Total Unrealized Gain/Loss ($ and %)
 */
export async function getDashboardKPIs(): Promise<DashboardKPIs> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  // 1. Get all active holdings for this user
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

  if (userHoldings.length === 0) {
    return {
      netWorthCents: 0,
      dayChangeCents: 0,
      dayChangePercent: 0,
      totalGainLossCents: 0,
      totalGainLossPercent: 0,
      totalCostBasisCents: 0,
    };
  }

  const holdingIds = userHoldings.map((h) => h.id);

  // 2. Get all non-liquidated lots for those holdings
  const userLots = await db
    .select()
    .from(lots)
    .where(
      and(
        inArray(lots.holdingId, holdingIds),
        eq(lots.isLiquidated, false),
      ),
    );

  // 3. Get cached prices for all market-asset tickers
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

  // 4. Build a lookup: holdingId → holding
  const holdingMap = new Map(userHoldings.map((h) => [h.id, h]));

  // 5. Aggregate KPIs across all lots
  let netWorthCents = 0;
  let previousCloseTotalCents = 0;
  let totalCostBasisCents = 0;

  for (const lot of userLots) {
    const holding = holdingMap.get(lot.holdingId);
    if (!holding) continue;

    const shares = lot.shares ? parseFloat(lot.shares) : 0;
    const costBasis = lot.costBasisCents ?? 0;
    totalCostBasisCents += costBasis;

    if (isMarketAsset(holding.assetType) && holding.ticker) {
      const price = priceMap.get(holding.ticker.toUpperCase());
      if (price) {
        const currentValue = Math.round(shares * price.priceCents);
        netWorthCents += currentValue;

        const prevClose = price.previousCloseCents ?? price.priceCents;
        previousCloseTotalCents += Math.round(shares * prevClose);
      } else {
        // No cached price — fall back to cost basis as estimated value
        netWorthCents += costBasis;
        previousCloseTotalCents += costBasis;
      }
    } else {
      // Manual asset (real estate, cash, other) — use currentValueCents or cost basis
      const manualValue = lot.currentValueCents ?? costBasis;
      netWorthCents += manualValue;
      previousCloseTotalCents += manualValue; // No intraday change for manual assets
    }
  }

  const dayChangeCents = netWorthCents - previousCloseTotalCents;
  const dayChangePercent =
    previousCloseTotalCents !== 0
      ? (dayChangeCents / previousCloseTotalCents) * 100
      : 0;

  const totalGainLossCents = netWorthCents - totalCostBasisCents;
  const totalGainLossPercent =
    totalCostBasisCents !== 0
      ? (totalGainLossCents / totalCostBasisCents) * 100
      : 0;

  return {
    netWorthCents,
    dayChangeCents,
    dayChangePercent,
    totalGainLossCents,
    totalGainLossPercent,
    totalCostBasisCents,
  };
}

// ─── Asset Allocation ────────────────────────────────────────────────

/**
 * Compute asset allocation breakdown by asset class for the authenticated user.
 * Returns slices sorted by value descending, each with a dollar amount and percentage.
 */
export async function getAssetAllocation(): Promise<AssetAllocationSlice[]> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

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

  const userLots = await db
    .select()
    .from(lots)
    .where(
      and(
        inArray(lots.holdingId, holdingIds),
        eq(lots.isLiquidated, false),
      ),
    );

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

  // Accumulate value per asset type
  const valueByType = new Map<AssetType, number>();
  let totalValue = 0;

  for (const lot of userLots) {
    const holding = holdingMap.get(lot.holdingId);
    if (!holding) continue;

    const assetType = holding.assetType as AssetType;
    const shares = lot.shares ? parseFloat(lot.shares) : 0;
    const costBasis = lot.costBasisCents ?? 0;
    let lotValue = 0;

    if (isMarketAsset(assetType) && holding.ticker) {
      const price = priceMap.get(holding.ticker.toUpperCase());
      lotValue = price ? Math.round(shares * price.priceCents) : costBasis;
    } else {
      lotValue = lot.currentValueCents ?? costBasis;
    }

    valueByType.set(assetType, (valueByType.get(assetType) ?? 0) + lotValue);
    totalValue += lotValue;
  }

  // Build sorted slices
  const slices: AssetAllocationSlice[] = [];
  for (const [assetType, valueCents] of valueByType) {
    slices.push({
      assetType,
      label: ASSET_TYPES[assetType],
      valueCents,
      percent: totalValue > 0 ? (valueCents / totalValue) * 100 : 0,
    });
  }

  slices.sort((a, b) => b.valueCents - a.valueCents);
  return slices;
}

// ─── Top Movers ─────────────────────────────────────────────────────

/**
 * Get the top 3 gainers and top 3 losers from the user's market-priced
 * holdings based on today's price change from previous close.
 */
export async function getTopMovers(): Promise<TopMoversData> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  // Get distinct market tickers from user's active holdings
  const userHoldings = await db
    .select({ ticker: holdings.ticker, assetType: holdings.assetType })
    .from(holdings)
    .where(
      and(
        eq(holdings.userId, userId),
        eq(holdings.isLiquidated, false),
        isNull(holdings.deletedAt),
      ),
    );

  const marketTickers = [
    ...new Set(
      userHoldings
        .filter((h) => isMarketAsset(h.assetType) && h.ticker)
        .map((h) => h.ticker!.toUpperCase()),
    ),
  ];

  if (marketTickers.length === 0) return { gainers: [], losers: [] };

  const prices = await db
    .select()
    .from(priceCache)
    .where(inArray(priceCache.ticker, marketTickers));

  // Build mover entries with computed change
  const movers: TopMover[] = prices
    .filter((p) => p.previousCloseCents != null && p.previousCloseCents > 0)
    .map((p) => {
      const change = p.changeCents ?? p.priceCents - (p.previousCloseCents ?? p.priceCents);
      const pct = p.changePercent
        ? parseFloat(p.changePercent)
        : (p.previousCloseCents ? (change / p.previousCloseCents) * 100 : 0);
      return {
        ticker: p.ticker,
        name: p.name ?? p.ticker,
        changeCents: change,
        changePercent: pct,
      };
    });

  // Sort: gainers desc by %, losers asc by %
  const sorted = [...movers].sort((a, b) => b.changePercent - a.changePercent);

  const gainers = sorted.filter((m) => m.changeCents > 0).slice(0, 3);
  const losers = sorted.filter((m) => m.changeCents < 0).slice(-3).reverse();

  return { gainers, losers };
}

// ─── Net Worth History ───────────────────────────────────────────────

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
 * Ensures the same net worth produces the same historical curve
 * across page loads so the chart doesn't jitter on every request.
 */
function seededRandom(seed: number) {
  let t = seed + 0x6d2b79f5;
  return () => {
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Generate simulated historical net worth data points.
 *
 * Since we don't store historical snapshots yet (that's a future feature),
 * this works backwards from the current net worth and cost basis to produce
 * a plausible growth curve. Uses a seeded PRNG so the chart is stable
 * across re-renders for the same portfolio value.
 *
 * @returns Data points for ALL periods (730 days). The client component
 *          filters to the selected period for responsiveness.
 */
export async function getNetWorthHistory(
  currentNetWorthCents: number,
  totalCostBasisCents: number,
): Promise<NetWorthDataPoint[]> {
  const totalDays = PERIOD_DAYS.ALL;
  const today = new Date();
  const rand = seededRandom(currentNetWorthCents + totalCostBasisCents);

  // The earliest simulated value is roughly around cost basis
  // with some variance to look realistic
  const startValue = totalCostBasisCents > 0
    ? totalCostBasisCents * (0.85 + rand() * 0.15)
    : currentNetWorthCents * 0.6;

  const endValue = currentNetWorthCents;
  const points: NetWorthDataPoint[] = [];

  for (let i = totalDays; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);

    // Progress from 0 → 1 over the time span
    const progress = (totalDays - i) / totalDays;

    // Base value: smooth interpolation from start to end
    const baseValue = startValue + (endValue - startValue) * progress;

    // Add daily volatility: ±1.5% random noise, dampened near the end
    // so the final point lands exactly on the current net worth
    const dampening = Math.max(0, 1 - progress * 1.1);
    const noise = (rand() - 0.48) * 0.015 * baseValue * dampening;

    const value = i === 0
      ? endValue
      : Math.round(baseValue + noise);

    const dateStr = date.toISOString().split("T")[0];
    points.push({ date: dateStr, valueCents: value });
  }

  return points;
}

// ─── Recent Activity ─────────────────────────────────────────────────

export interface ActivityEntry {
  id: string;
  action: string;
  resourceType: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

/**
 * Get the last 10 audit log entries for the authenticated user.
 */
export async function getRecentActivity(): Promise<ActivityEntry[]> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const rows = await db
    .select({
      id: auditLogs.id,
      action: auditLogs.action,
      resourceType: auditLogs.resourceType,
      metadata: auditLogs.metadata,
      createdAt: auditLogs.createdAt,
    })
    .from(auditLogs)
    .where(eq(auditLogs.actorId, userId))
    .orderBy(desc(auditLogs.createdAt))
    .limit(10);

  return rows.map((r) => ({
    id: r.id,
    action: r.action,
    resourceType: r.resourceType,
    metadata: (r.metadata ?? {}) as Record<string, unknown>,
    createdAt: r.createdAt,
  }));
}
