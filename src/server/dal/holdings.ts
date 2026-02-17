import { db } from "@/db";
import { holdings } from "@/db/schema/holdings";
import { accounts } from "@/db/schema/accounts";
import { lots } from "@/db/schema/lots";
import { priceCache } from "@/db/schema/price-cache";
import { eq, and, isNull, isNotNull, inArray } from "drizzle-orm";
import { auth } from "@clerk/nextjs/server";
import { logAuditEvent } from "./audit";
import {
  ASSET_TYPES,
  MARKET_ASSET_TYPES,
  CUSTODIANS,
  type AssetType,
  type AssetCategory,
  type HoldingSource,
  type Sector,
  type Custodian,
} from "@/lib/constants";

// ─── Types ───────────────────────────────────────────────────────────

interface CreateHoldingInput {
  accountId: string;
  ticker?: string | null;
  name: string;
  assetType: AssetType;
  assetCategory?: AssetCategory | null;
  sector?: Sector | null;
  notes?: string | null;
  source?: HoldingSource;
}

interface UpdateHoldingInput {
  ticker?: string | null;
  name?: string;
  assetType?: AssetType;
  assetCategory?: AssetCategory | null;
  sector?: Sector | null;
  notes?: string | null;
}

// ─── Cron / System Functions (no auth) ───────────────────────────────

export interface TrackedTicker {
  ticker: string;
  assetType: string;
}

/**
 * Get all unique tickers being tracked across ALL users' holdings.
 * Does NOT require authentication — designed to be called from the
 * cron job context that refreshes the price cache.
 *
 * Returns each unique ticker once, along with its asset type so the
 * caller knows whether to use the stock or crypto endpoint.
 */
export async function getAllTrackedTickers(): Promise<TrackedTicker[]> {
  const rows = await db
    .selectDistinctOn([holdings.ticker], {
      ticker: holdings.ticker,
      assetType: holdings.assetType,
    })
    .from(holdings)
    .where(
      and(
        isNotNull(holdings.ticker),
        isNull(holdings.deletedAt),
        eq(holdings.isLiquidated, false),
      ),
    );

  const result: TrackedTicker[] = [];
  for (const r of rows) {
    if (r.ticker) {
      result.push({ ticker: r.ticker.toUpperCase(), assetType: r.assetType });
    }
  }
  return result;
}

/**
 * Get all unique tickers tracked by a specific user.
 * Used by the manual refresh Server Action (user-scoped).
 */
export async function getUserTrackedTickers(userId: string): Promise<TrackedTicker[]> {
  const rows = await db
    .selectDistinctOn([holdings.ticker], {
      ticker: holdings.ticker,
      assetType: holdings.assetType,
    })
    .from(holdings)
    .where(
      and(
        eq(holdings.userId, userId),
        isNotNull(holdings.ticker),
        isNull(holdings.deletedAt),
        eq(holdings.isLiquidated, false),
      ),
    );

  const result: TrackedTicker[] = [];
  for (const r of rows) {
    if (r.ticker) {
      result.push({ ticker: r.ticker.toUpperCase(), assetType: r.assetType });
    }
  }
  return result;
}

// ─── DAL Functions ───────────────────────────────────────────────────

/**
 * Get all non-deleted holdings for the authenticated user.
 * Optionally filter by accountId.
 */
export async function getHoldings(accountId?: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const conditions = [eq(holdings.userId, userId), isNull(holdings.deletedAt)];
  if (accountId) conditions.push(eq(holdings.accountId, accountId));

  return db
    .select()
    .from(holdings)
    .where(and(...conditions));
}

/**
 * Get a single holding by ID.
 * Enforces ownership and excludes soft-deleted records.
 */
export async function getHoldingById(holdingId: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const [holding] = await db
    .select()
    .from(holdings)
    .where(
      and(
        eq(holdings.id, holdingId),
        eq(holdings.userId, userId),
        isNull(holdings.deletedAt),
      ),
    );

  return holding ?? null;
}

/**
 * Get all holdings with the same ticker across all accounts.
 * Used for the cross-custodian grouped view.
 * Only returns non-deleted, non-liquidated holdings.
 */
export async function getHoldingsByTicker(ticker: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  return db
    .select()
    .from(holdings)
    .where(
      and(
        eq(holdings.userId, userId),
        eq(holdings.ticker, ticker),
        isNull(holdings.deletedAt),
        eq(holdings.isLiquidated, false),
      ),
    );
}

/**
 * Find an active (non-deleted, non-liquidated) holding by ticker within a
 * specific account for the authenticated user.
 *
 * Used to avoid duplicate holdings — when a user buys more shares of a
 * stock they already own, we add a new lot to the existing holding.
 *
 * Returns null for non-market assets (no ticker) or when no match found.
 */
export async function findHoldingByTickerInAccount(
  accountId: string,
  ticker: string | null | undefined,
) {
  if (!ticker) return null;

  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const [existing] = await db
    .select()
    .from(holdings)
    .where(
      and(
        eq(holdings.userId, userId),
        eq(holdings.accountId, accountId),
        eq(holdings.ticker, ticker.toUpperCase()),
        eq(holdings.isLiquidated, false),
        isNull(holdings.deletedAt),
      ),
    );

  return existing ?? null;
}

/**
 * Create a new holding under an account.
 */
export async function createHolding(input: CreateHoldingInput) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const now = new Date();

  const [holding] = await db
    .insert(holdings)
    .values({
      accountId: input.accountId,
      userId,
      ticker: input.ticker ?? null,
      name: input.name,
      assetType: input.assetType,
      assetCategory: input.assetCategory ?? null,
      sector: input.sector ?? null,
      notes: input.notes ?? null,
      source: input.source ?? "manual",
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  await logAuditEvent({
    actorId: userId,
    action: "CREATE",
    resourceType: "holding",
    resourceId: holding.id,
    metadata: { ticker: input.ticker, name: input.name, assetType: input.assetType },
  });

  return holding;
}

/**
 * Update an existing holding.
 * Enforces ownership via userId WHERE clause.
 */
export async function updateHolding(
  holdingId: string,
  input: UpdateHoldingInput,
) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const setValues: Record<string, unknown> = { updatedAt: new Date() };
  if (input.ticker !== undefined) setValues.ticker = input.ticker;
  if (input.name !== undefined) setValues.name = input.name;
  if (input.assetType !== undefined) setValues.assetType = input.assetType;
  if (input.assetCategory !== undefined) setValues.assetCategory = input.assetCategory;
  if (input.sector !== undefined) setValues.sector = input.sector;
  if (input.notes !== undefined) setValues.notes = input.notes;

  const [updated] = await db
    .update(holdings)
    .set(setValues)
    .where(
      and(
        eq(holdings.id, holdingId),
        eq(holdings.userId, userId),
        isNull(holdings.deletedAt),
      ),
    )
    .returning();

  if (!updated) throw new Error("NOT_FOUND");

  await logAuditEvent({
    actorId: userId,
    action: "UPDATE",
    resourceType: "holding",
    resourceId: holdingId,
    metadata: { changes: Object.keys(input) },
  });

  return updated;
}

// ─── Holding Detail Data ────────────────────────────────────────────

export interface LotRow {
  id: string;
  shares: number;
  costBasisCents: number;
  costPerShareCents: number;
  currentValueCents: number;
  gainLossCents: number;
  gainLossPercent: number;
  acquiredAt: Date | null;
  isLiquidated: boolean;
  // Real estate specific
  mortgageMonthlyCents: number | null;
  escrowMonthlyCents: number | null;
  // Cash specific
  interestRateBps: number | null;
  notes: string | null;
}

export interface HoldingDetailData {
  holding: {
    id: string;
    ticker: string | null;
    name: string;
    assetType: string;
    assetTypeLabel: string;
    assetCategory: string | null;
    sector: string | null;
    isLiquidated: boolean;
    notes: string | null;
    source: string;
    createdAt: Date;
  };
  account: {
    id: string;
    name: string;
    custodian: string;
    custodianLabel: string;
  };
  kpis: {
    totalShares: number;
    totalCostBasisCents: number;
    currentPriceCents: number;
    marketValueCents: number;
    gainLossCents: number;
    gainLossPercent: number;
    avgCostPerShareCents: number;
    lotCount: number;
  };
  lots: LotRow[];
  isMarket: boolean;
}

/**
 * Get full detail data for a single holding:
 *   - Holding metadata + account info
 *   - KPI values (shares, cost basis, value, gain/loss)
 *   - Per-lot breakdown with individual performance
 */
export async function getHoldingDetailData(
  holdingId: string,
): Promise<HoldingDetailData | null> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  // 1. Fetch the holding
  const [holding] = await db
    .select()
    .from(holdings)
    .where(
      and(
        eq(holdings.id, holdingId),
        eq(holdings.userId, userId),
        isNull(holdings.deletedAt),
      ),
    );

  if (!holding) return null;

  // 2. Fetch the parent account
  const [account] = await db
    .select()
    .from(accounts)
    .where(eq(accounts.id, holding.accountId));

  // 3. Fetch all lots (including liquidated, for history)
  const holdingLots = await db
    .select()
    .from(lots)
    .where(and(eq(lots.holdingId, holdingId), eq(lots.userId, userId)));

  // 4. Fetch cached price for market assets
  const isMarket = isMarketAsset(holding.assetType);
  let priceDollars = 0;
  let priceCents = 0;

  if (isMarket && holding.ticker) {
    const [price] = await db
      .select()
      .from(priceCache)
      .where(eq(priceCache.ticker, holding.ticker.toUpperCase()));
    // Prefer priceDollars (full precision) over priceCents (truncated for sub-cent prices)
    priceDollars = price?.priceDollars ?? (price?.priceCents ? price.priceCents / 100 : 0);
    priceCents = price?.priceCents ?? 0;
  }

  // 5. Build lot rows with computed values
  const activeLots = holdingLots.filter((l) => !l.isLiquidated);

  let totalShares = 0;
  let totalCostBasis = 0;
  let totalCurrentValue = 0;

  const lotRows: LotRow[] = holdingLots.map((lot) => {
    const shares = lot.shares ? parseFloat(lot.shares) : 0;
    const costBasis = lot.costBasisCents ?? 0;
    const costPerShare = lot.costPerShareCents ?? (shares > 0 ? Math.round(costBasis / shares) : 0);

    let currentValue: number;
    if (isMarket && priceDollars > 0) {
      // Use priceDollars for full precision (supports sub-cent meme coins)
      currentValue = Math.round(shares * priceDollars * 100);
    } else {
      currentValue = lot.currentValueCents ?? costBasis;
    }

    const gainLoss = currentValue - costBasis;
    const gainLossPercent = costBasis !== 0 ? (gainLoss / costBasis) * 100 : 0;

    if (!lot.isLiquidated) {
      totalShares += shares;
      totalCostBasis += costBasis;
      totalCurrentValue += currentValue;
    }

    return {
      id: lot.id,
      shares,
      costBasisCents: costBasis,
      costPerShareCents: costPerShare,
      currentValueCents: currentValue,
      gainLossCents: gainLoss,
      gainLossPercent,
      acquiredAt: lot.acquiredAt,
      isLiquidated: lot.isLiquidated,
      mortgageMonthlyCents: lot.mortgageMonthlyCents ?? null,
      escrowMonthlyCents: lot.escrowMonthlyCents ?? null,
      interestRateBps: lot.interestRateBps ?? null,
      notes: lot.notes,
    };
  });

  // Sort lots: active first (newest first), then liquidated
  lotRows.sort((a, b) => {
    if (a.isLiquidated !== b.isLiquidated) return a.isLiquidated ? 1 : -1;
    const dateA = a.acquiredAt?.getTime() ?? 0;
    const dateB = b.acquiredAt?.getTime() ?? 0;
    return dateB - dateA;
  });

  const gainLossCents = totalCurrentValue - totalCostBasis;
  const gainLossPercent =
    totalCostBasis !== 0 ? (gainLossCents / totalCostBasis) * 100 : 0;
  const avgCostPerShare =
    totalShares > 0 ? Math.round(totalCostBasis / totalShares) : totalCostBasis;

  return {
    holding: {
      id: holding.id,
      ticker: holding.ticker,
      name: holding.name,
      assetType: holding.assetType,
      assetTypeLabel: ASSET_TYPES[holding.assetType as AssetType] ?? holding.assetType,
      assetCategory: holding.assetCategory,
      sector: holding.sector,
      isLiquidated: holding.isLiquidated,
      notes: holding.notes,
      source: holding.source,
      createdAt: holding.createdAt,
    },
    account: {
      id: account?.id ?? holding.accountId,
      name: account?.name ?? "Unknown",
      custodian: account?.custodian ?? "other",
      custodianLabel:
        CUSTODIANS[(account?.custodian ?? "other") as Custodian] ??
        account?.custodian ??
        "Other",
    },
    kpis: {
      totalShares,
      totalCostBasisCents: totalCostBasis,
      currentPriceCents: isMarket ? Math.round(priceDollars * 100) : 0,
      marketValueCents: totalCurrentValue,
      gainLossCents,
      gainLossPercent,
      avgCostPerShareCents: avgCostPerShare,
      lotCount: activeLots.length,
    },
    lots: lotRows,
    isMarket,
  };
}

// ─── All Holdings with Details ──────────────────────────────────────

const isMarketAsset = (assetType: string): boolean =>
  MARKET_ASSET_TYPES.includes(assetType as AssetType);

export interface HoldingRow {
  id: string;
  ticker: string | null;
  name: string;
  assetType: string;
  assetTypeLabel: string;
  shares: number;
  avgCostCents: number;
  currentPriceCents: number;
  marketValueCents: number;
  gainLossCents: number;
  gainLossPercent: number;
  custodian: string;
  custodianLabel: string;
  accountId: string;
  accountName: string;
}

/**
 * Get all holdings across all accounts for the authenticated user,
 * enriched with aggregated lot data, market prices, and account info.
 *
 * Used by the All Holdings page.
 */
export async function getAllHoldingsWithDetails(): Promise<HoldingRow[]> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  // 1. Fetch all active holdings
  const activeHoldings = await db
    .select()
    .from(holdings)
    .where(
      and(
        eq(holdings.userId, userId),
        eq(holdings.isLiquidated, false),
        isNull(holdings.deletedAt),
      ),
    );

  if (activeHoldings.length === 0) return [];

  const holdingIds = activeHoldings.map((h) => h.id);

  // 2. Fetch accounts for custodian info
  const accountIds = [...new Set(activeHoldings.map((h) => h.accountId))];
  const userAccounts = await db
    .select()
    .from(accounts)
    .where(and(inArray(accounts.id, accountIds), isNull(accounts.deletedAt)));

  const accountMap = new Map(userAccounts.map((a) => [a.id, a]));

  // 3. Fetch non-liquidated lots
  const activeLots = await db
    .select()
    .from(lots)
    .where(and(inArray(lots.holdingId, holdingIds), eq(lots.isLiquidated, false)));

  // 4. Fetch cached prices for market tickers
  const marketTickers = [
    ...new Set(
      activeHoldings
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

  // 5. Aggregate lots per holding
  interface LotAgg {
    totalShares: number;
    totalCostBasis: number;
    totalCurrentValue: number;
  }

  const lotAgg = new Map<string, LotAgg>();

  for (const lot of activeLots) {
    const holding = activeHoldings.find((h) => h.id === lot.holdingId);
    if (!holding) continue;

    const shares = lot.shares ? parseFloat(lot.shares) : 0;
    const costBasis = lot.costBasisCents ?? 0;
    let currentValue = 0;

    if (isMarketAsset(holding.assetType) && holding.ticker) {
      const price = priceMap.get(holding.ticker.toUpperCase());
      if (price) {
        // Prefer priceDollars (full precision) for sub-cent meme coins
        const dollars = price.priceDollars ?? price.priceCents / 100;
        currentValue = Math.round(shares * dollars * 100);
      } else {
        currentValue = costBasis;
      }
    } else {
      currentValue = lot.currentValueCents ?? costBasis;
    }

    const existing = lotAgg.get(holding.id) ?? {
      totalShares: 0,
      totalCostBasis: 0,
      totalCurrentValue: 0,
    };

    lotAgg.set(holding.id, {
      totalShares: existing.totalShares + shares,
      totalCostBasis: existing.totalCostBasis + costBasis,
      totalCurrentValue: existing.totalCurrentValue + currentValue,
    });
  }

  // 6. Build rows
  const rows: HoldingRow[] = activeHoldings.map((h) => {
    const agg = lotAgg.get(h.id) ?? {
      totalShares: 0,
      totalCostBasis: 0,
      totalCurrentValue: 0,
    };

    const gainLoss = agg.totalCurrentValue - agg.totalCostBasis;
    const gainLossPercent =
      agg.totalCostBasis !== 0 ? (gainLoss / agg.totalCostBasis) * 100 : 0;

    const avgCostCents =
      agg.totalShares > 0
        ? Math.round(agg.totalCostBasis / agg.totalShares)
        : agg.totalCostBasis;

    const currentPriceCents = (() => {
      if (isMarketAsset(h.assetType) && h.ticker) {
        const price = priceMap.get(h.ticker.toUpperCase());
        if (price) {
          const dollars = price.priceDollars ?? price.priceCents / 100;
          return Math.round(dollars * 100);
        }
        return 0;
      }
      return agg.totalShares > 0
        ? Math.round(agg.totalCurrentValue / agg.totalShares)
        : agg.totalCurrentValue;
    })();

    const acct = accountMap.get(h.accountId);

    return {
      id: h.id,
      ticker: h.ticker,
      name: h.name,
      assetType: h.assetType,
      assetTypeLabel: ASSET_TYPES[h.assetType as AssetType] ?? h.assetType,
      shares: agg.totalShares,
      avgCostCents,
      currentPriceCents,
      marketValueCents: agg.totalCurrentValue,
      gainLossCents: gainLoss,
      gainLossPercent,
      custodian: acct?.custodian ?? "other",
      custodianLabel: CUSTODIANS[(acct?.custodian ?? "other") as Custodian] ?? acct?.custodian ?? "Other",
      accountId: h.accountId,
      accountName: acct?.name ?? "Unknown",
    };
  });

  // Sort by market value descending
  rows.sort((a, b) => b.marketValueCents - a.marketValueCents);

  return rows;
}
