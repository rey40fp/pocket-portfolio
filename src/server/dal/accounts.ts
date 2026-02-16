import { db } from "@/db";
import { accounts } from "@/db/schema/accounts";
import { holdings } from "@/db/schema/holdings";
import { lots } from "@/db/schema/lots";
import { priceCache } from "@/db/schema/price-cache";
import { eq, and, isNull, inArray } from "drizzle-orm";
import { auth } from "@clerk/nextjs/server";
import { logAuditEvent } from "./audit";
import { ASSET_TYPES, MARKET_ASSET_TYPES, CUSTODIANS, ACCOUNT_TYPES, type AssetType, type Custodian, type AccountType } from "@/lib/constants";

// ─── Types ───────────────────────────────────────────────────────────

interface CreateAccountInput {
  portfolioId: string;
  name: string;
  custodian: string;
  accountType: string;
  notes?: string | null;
}

interface UpdateAccountInput {
  name?: string;
  custodian?: string;
  accountType?: string;
  notes?: string | null;
}

export interface AccountSummary {
  id: string;
  name: string;
  custodian: string;
  custodianLabel: string;
  accountType: string;
  accountTypeLabel: string;
  holdingsCount: number;
  totalValueCents: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────

const isMarketAsset = (assetType: string): boolean =>
  MARKET_ASSET_TYPES.includes(assetType as AssetType);

// ─── DAL Functions ───────────────────────────────────────────────────

/**
 * Get all non-deleted accounts for the authenticated user.
 * Optionally filter by portfolio.
 */
export async function getAccounts(portfolioId?: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const conditions = [eq(accounts.userId, userId), isNull(accounts.deletedAt)];
  if (portfolioId) conditions.push(eq(accounts.portfolioId, portfolioId));

  return db
    .select()
    .from(accounts)
    .where(and(...conditions));
}

/**
 * Get all accounts with computed summary data:
 *   - number of active holdings
 *   - total current value (market price × shares for market assets, manual value for others)
 *
 * Used by the Accounts list page.
 */
export async function getAccountsWithSummary(): Promise<AccountSummary[]> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  // 1. Fetch all non-deleted accounts
  const userAccounts = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.userId, userId), isNull(accounts.deletedAt)));

  if (userAccounts.length === 0) return [];

  const accountIds = userAccounts.map((a) => a.id);

  // 2. Fetch all active holdings for those accounts
  const activeHoldings = await db
    .select()
    .from(holdings)
    .where(
      and(
        inArray(holdings.accountId, accountIds),
        eq(holdings.isLiquidated, false),
        isNull(holdings.deletedAt),
      ),
    );

  const holdingIds = activeHoldings.map((h) => h.id);

  // 3. Fetch non-liquidated lots for those holdings
  const activeLots =
    holdingIds.length > 0
      ? await db
          .select()
          .from(lots)
          .where(
            and(inArray(lots.holdingId, holdingIds), eq(lots.isLiquidated, false)),
          )
      : [];

  // 4. Fetch cached prices for market-asset tickers
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

  // 5. Build lookup maps
  const holdingMap = new Map(activeHoldings.map((h) => [h.id, h]));

  // holdingsCount per account
  const holdingsCountByAccount = new Map<string, number>();
  for (const h of activeHoldings) {
    holdingsCountByAccount.set(
      h.accountId,
      (holdingsCountByAccount.get(h.accountId) ?? 0) + 1,
    );
  }

  // totalValue per account
  const valueByAccount = new Map<string, number>();
  for (const lot of activeLots) {
    const holding = holdingMap.get(lot.holdingId);
    if (!holding) continue;

    const shares = lot.shares ? parseFloat(lot.shares) : 0;
    const costBasis = lot.costBasisCents ?? 0;
    let lotValue = 0;

    if (isMarketAsset(holding.assetType) && holding.ticker) {
      const price = priceMap.get(holding.ticker.toUpperCase());
      lotValue = price ? Math.round(shares * price.priceCents) : costBasis;
    } else {
      lotValue = lot.currentValueCents ?? costBasis;
    }

    valueByAccount.set(
      holding.accountId,
      (valueByAccount.get(holding.accountId) ?? 0) + lotValue,
    );
  }

  // 6. Assemble summaries
  return userAccounts.map((acct) => ({
    id: acct.id,
    name: acct.name,
    custodian: acct.custodian,
    custodianLabel:
      CUSTODIANS[acct.custodian as Custodian] ?? acct.custodian,
    accountType: acct.accountType,
    accountTypeLabel:
      ACCOUNT_TYPES[acct.accountType as AccountType] ?? acct.accountType,
    holdingsCount: holdingsCountByAccount.get(acct.id) ?? 0,
    totalValueCents: valueByAccount.get(acct.id) ?? 0,
  }));
}

/**
 * Get a single account by ID.
 * Enforces ownership and excludes soft-deleted records.
 */
export async function getAccountById(accountId: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const [account] = await db
    .select()
    .from(accounts)
    .where(
      and(
        eq(accounts.id, accountId),
        eq(accounts.userId, userId),
        isNull(accounts.deletedAt),
      ),
    );

  return account ?? null;
}

/**
 * Create a new account under a portfolio.
 */
export async function createAccount(input: CreateAccountInput) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const now = new Date();

  const [account] = await db
    .insert(accounts)
    .values({
      portfolioId: input.portfolioId,
      userId,
      name: input.name,
      custodian: input.custodian,
      accountType: input.accountType,
      notes: input.notes ?? null,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  await logAuditEvent({
    actorId: userId,
    action: "CREATE",
    resourceType: "account",
    resourceId: account.id,
    metadata: { name: input.name, custodian: input.custodian },
  });

  return account;
}

/**
 * Update an existing account.
 * Enforces ownership via userId WHERE clause.
 */
export async function updateAccount(
  accountId: string,
  input: UpdateAccountInput,
) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const setValues: Record<string, unknown> = { updatedAt: new Date() };
  if (input.name !== undefined) setValues.name = input.name;
  if (input.custodian !== undefined) setValues.custodian = input.custodian;
  if (input.accountType !== undefined) setValues.accountType = input.accountType;
  if (input.notes !== undefined) setValues.notes = input.notes;

  const [updated] = await db
    .update(accounts)
    .set(setValues)
    .where(
      and(
        eq(accounts.id, accountId),
        eq(accounts.userId, userId),
        isNull(accounts.deletedAt),
      ),
    )
    .returning();

  if (!updated) throw new Error("NOT_FOUND");

  await logAuditEvent({
    actorId: userId,
    action: "UPDATE",
    resourceType: "account",
    resourceId: accountId,
    metadata: { changes: Object.keys(input) },
  });

  return updated;
}

/**
 * Soft-delete an account by setting `deletedAt`.
 * Holdings under this account remain in the DB but the account
 * is excluded from all normal queries.
 */
export async function softDeleteAccount(accountId: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const now = new Date();

  const [deleted] = await db
    .update(accounts)
    .set({ deletedAt: now, updatedAt: now })
    .where(
      and(
        eq(accounts.id, accountId),
        eq(accounts.userId, userId),
        isNull(accounts.deletedAt),
      ),
    )
    .returning();

  if (!deleted) throw new Error("NOT_FOUND");

  await logAuditEvent({
    actorId: userId,
    action: "DELETE",
    resourceType: "account",
    resourceId: accountId,
    metadata: { name: deleted.name, softDelete: true },
  });

  return deleted;
}

// ─── Account Detail Data ────────────────────────────────────────────

export interface AccountKPIs {
  totalValueCents: number;
  totalCostBasisCents: number;
  gainLossCents: number;
  gainLossPercent: number;
  holdingsCount: number;
}

export interface AccountAllocationSlice {
  assetType: AssetType;
  label: string;
  valueCents: number;
  percent: number;
}

export interface AccountHoldingRow {
  id: string;
  ticker: string | null;
  name: string;
  assetType: string;
  assetTypeLabel: string;
  shares: number;
  costBasisCents: number;
  currentValueCents: number;
  gainLossCents: number;
  gainLossPercent: number;
}

export interface AccountDetailData {
  account: {
    id: string;
    name: string;
    custodian: string;
    custodianLabel: string;
    accountType: string;
    accountTypeLabel: string;
    notes: string | null;
  };
  kpis: AccountKPIs;
  allocation: AccountAllocationSlice[];
  holdings: AccountHoldingRow[];
}

/**
 * Get full detail data for a single account:
 *   - Account metadata
 *   - KPI values (total value, cost basis, gain/loss, holdings count)
 *   - Asset allocation slices
 *   - Holdings rows with computed values
 */
export async function getAccountDetailData(
  accountId: string,
): Promise<AccountDetailData | null> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  // 1. Fetch the account itself
  const [account] = await db
    .select()
    .from(accounts)
    .where(
      and(
        eq(accounts.id, accountId),
        eq(accounts.userId, userId),
        isNull(accounts.deletedAt),
      ),
    );

  if (!account) return null;

  // 2. Fetch active holdings for this account
  const activeHoldings = await db
    .select()
    .from(holdings)
    .where(
      and(
        eq(holdings.accountId, accountId),
        eq(holdings.isLiquidated, false),
        isNull(holdings.deletedAt),
      ),
    );

  const holdingIds = activeHoldings.map((h) => h.id);

  // 3. Fetch active lots
  const activeLots =
    holdingIds.length > 0
      ? await db
          .select()
          .from(lots)
          .where(
            and(inArray(lots.holdingId, holdingIds), eq(lots.isLiquidated, false)),
          )
      : [];

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

  // 5. Aggregate lot values per holding
  interface HoldingAgg {
    totalShares: number;
    totalCostBasis: number;
    totalCurrentValue: number;
  }

  const holdingAgg = new Map<string, HoldingAgg>();
  const holdingMap = new Map(activeHoldings.map((h) => [h.id, h]));

  for (const lot of activeLots) {
    const holding = holdingMap.get(lot.holdingId);
    if (!holding) continue;

    const shares = lot.shares ? parseFloat(lot.shares) : 0;
    const costBasis = lot.costBasisCents ?? 0;
    let currentValue = 0;

    if (isMarketAsset(holding.assetType) && holding.ticker) {
      const price = priceMap.get(holding.ticker.toUpperCase());
      currentValue = price ? Math.round(shares * price.priceCents) : costBasis;
    } else {
      currentValue = lot.currentValueCents ?? costBasis;
    }

    const existing = holdingAgg.get(holding.id) ?? {
      totalShares: 0,
      totalCostBasis: 0,
      totalCurrentValue: 0,
    };

    holdingAgg.set(holding.id, {
      totalShares: existing.totalShares + shares,
      totalCostBasis: existing.totalCostBasis + costBasis,
      totalCurrentValue: existing.totalCurrentValue + currentValue,
    });
  }

  // 6. Build holding rows
  const holdingRows: AccountHoldingRow[] = activeHoldings.map((h) => {
    const agg = holdingAgg.get(h.id) ?? {
      totalShares: 0,
      totalCostBasis: 0,
      totalCurrentValue: 0,
    };
    const gainLoss = agg.totalCurrentValue - agg.totalCostBasis;
    const gainLossPercent =
      agg.totalCostBasis !== 0 ? (gainLoss / agg.totalCostBasis) * 100 : 0;

    return {
      id: h.id,
      ticker: h.ticker,
      name: h.name,
      assetType: h.assetType,
      assetTypeLabel: ASSET_TYPES[h.assetType as AssetType] ?? h.assetType,
      shares: agg.totalShares,
      costBasisCents: agg.totalCostBasis,
      currentValueCents: agg.totalCurrentValue,
      gainLossCents: gainLoss,
      gainLossPercent,
    };
  });

  // Sort by current value descending
  holdingRows.sort((a, b) => b.currentValueCents - a.currentValueCents);

  // 7. Compute account KPIs
  let totalValueCents = 0;
  let totalCostBasisCents = 0;

  for (const row of holdingRows) {
    totalValueCents += row.currentValueCents;
    totalCostBasisCents += row.costBasisCents;
  }

  const gainLossCents = totalValueCents - totalCostBasisCents;
  const gainLossPercent =
    totalCostBasisCents !== 0 ? (gainLossCents / totalCostBasisCents) * 100 : 0;

  // 8. Compute allocation by asset type
  const valueByType = new Map<AssetType, number>();
  for (const row of holdingRows) {
    const t = row.assetType as AssetType;
    valueByType.set(t, (valueByType.get(t) ?? 0) + row.currentValueCents);
  }

  const allocation: AccountAllocationSlice[] = [];
  for (const [assetType, valueCents] of valueByType) {
    allocation.push({
      assetType,
      label: ASSET_TYPES[assetType],
      valueCents,
      percent: totalValueCents > 0 ? (valueCents / totalValueCents) * 100 : 0,
    });
  }
  allocation.sort((a, b) => b.valueCents - a.valueCents);

  return {
    account: {
      id: account.id,
      name: account.name,
      custodian: account.custodian,
      custodianLabel: CUSTODIANS[account.custodian as Custodian] ?? account.custodian,
      accountType: account.accountType,
      accountTypeLabel: ACCOUNT_TYPES[account.accountType as AccountType] ?? account.accountType,
      notes: account.notes,
    },
    kpis: {
      totalValueCents,
      totalCostBasisCents,
      gainLossCents,
      gainLossPercent,
      holdingsCount: activeHoldings.length,
    },
    allocation,
    holdings: holdingRows,
  };
}
