import { db } from "@/db";
import { lots } from "@/db/schema/lots";
import { holdings } from "@/db/schema/holdings";
import { accounts } from "@/db/schema/accounts";
import { eq, and, isNull, inArray } from "drizzle-orm";
import { auth } from "@clerk/nextjs/server";
import { logAuditEvent } from "./audit";
import {
  ASSET_TYPES,
  CUSTODIANS,
  type AssetType,
  type Custodian,
} from "@/lib/constants";

// ─── Types ───────────────────────────────────────────────────────────

interface AddLotInput {
  holdingId: string;
  shares?: string | null;
  costBasisCents: number;
  costPerShareCents?: number | null;
  acquiredAt?: Date | null;
  currentValueCents?: number | null;
  mortgageMonthlyCents?: number | null;
  escrowMonthlyCents?: number | null;
  interestRateBps?: number | null;
  notes?: string | null;
}

interface UpdateLotInput {
  shares?: string | null;
  costBasisCents?: number;
  costPerShareCents?: number | null;
  acquiredAt?: Date | null;
  currentValueCents?: number | null;
  mortgageMonthlyCents?: number | null;
  escrowMonthlyCents?: number | null;
  interestRateBps?: number | null;
  notes?: string | null;
}

// ─── DAL Functions ───────────────────────────────────────────────────

/**
 * Get all lots for a specific holding.
 * Enforces ownership via userId.
 */
export async function getLotsByHolding(holdingId: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  return db
    .select()
    .from(lots)
    .where(and(eq(lots.holdingId, holdingId), eq(lots.userId, userId)));
}

/**
 * Get a single lot by ID.
 * Enforces ownership via userId.
 */
export async function getLotById(lotId: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const [lot] = await db
    .select()
    .from(lots)
    .where(and(eq(lots.id, lotId), eq(lots.userId, userId)));

  return lot ?? null;
}

/**
 * Add a new lot (purchase) to a holding.
 * Each lot represents a distinct purchase with its own cost basis and date.
 */
export async function addLot(input: AddLotInput) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const now = new Date();

  const [lot] = await db
    .insert(lots)
    .values({
      holdingId: input.holdingId,
      userId,
      shares: input.shares ?? null,
      costBasisCents: input.costBasisCents,
      costPerShareCents: input.costPerShareCents ?? null,
      acquiredAt: input.acquiredAt ?? null,
      currentValueCents: input.currentValueCents ?? null,
      mortgageMonthlyCents: input.mortgageMonthlyCents ?? null,
      escrowMonthlyCents: input.escrowMonthlyCents ?? null,
      interestRateBps: input.interestRateBps ?? null,
      notes: input.notes ?? null,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  await logAuditEvent({
    actorId: userId,
    action: "CREATE",
    resourceType: "lot",
    resourceId: lot.id,
    metadata: {
      holdingId: input.holdingId,
      costBasisCents: input.costBasisCents,
      shares: input.shares,
    },
  });

  return lot;
}

/**
 * Update an existing lot.
 * Enforces ownership via userId WHERE clause.
 */
export async function updateLot(lotId: string, input: UpdateLotInput) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const setValues: Record<string, unknown> = { updatedAt: new Date() };
  if (input.shares !== undefined) setValues.shares = input.shares;
  if (input.costBasisCents !== undefined) setValues.costBasisCents = input.costBasisCents;
  if (input.costPerShareCents !== undefined) setValues.costPerShareCents = input.costPerShareCents;
  if (input.acquiredAt !== undefined) setValues.acquiredAt = input.acquiredAt;
  if (input.currentValueCents !== undefined) setValues.currentValueCents = input.currentValueCents;
  if (input.mortgageMonthlyCents !== undefined) setValues.mortgageMonthlyCents = input.mortgageMonthlyCents;
  if (input.escrowMonthlyCents !== undefined) setValues.escrowMonthlyCents = input.escrowMonthlyCents;
  if (input.interestRateBps !== undefined) setValues.interestRateBps = input.interestRateBps;
  if (input.notes !== undefined) setValues.notes = input.notes;

  const [updated] = await db
    .update(lots)
    .set(setValues)
    .where(and(eq(lots.id, lotId), eq(lots.userId, userId)))
    .returning();

  if (!updated) throw new Error("NOT_FOUND");

  await logAuditEvent({
    actorId: userId,
    action: "UPDATE",
    resourceType: "lot",
    resourceId: lotId,
    metadata: { changes: Object.keys(input) },
  });

  return updated;
}

// ─── Liquidation ────────────────────────────────────────────────────

interface LiquidateLotInput {
  lotId: string;
  sharesSold: number;
  sellPriceCents: number;
  feesCents: number;
  soldAt: Date;
}

interface LiquidationResult {
  proceedsCents: number;
  costBasisCents: number;
  realizedGainLossCents: number;
  isFullLiquidation: boolean;
  holdingFullyLiquidated: boolean;
}

/**
 * Liquidate (sell) shares from a lot.
 *
 * **Full liquidation** — if sharesSold equals the lot's total shares:
 *   - Mark the lot as liquidated
 *   - Store proceeds (sell price × shares − fees) as currentValueCents
 *
 * **Partial liquidation** — if selling fewer shares than the lot holds:
 *   - Reduce the original lot's shares by sharesSold
 *   - Create a new "sold" lot with the sold portion, marked as liquidated
 *
 * After processing the lot, checks if ALL lots in the parent holding
 * are now liquidated, and if so, marks the holding itself as liquidated.
 *
 * Returns the realized gain/loss for the sold portion.
 */
export async function liquidateLot(
  input: LiquidateLotInput,
): Promise<LiquidationResult> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const now = new Date();

  // 1. Fetch the lot and verify ownership
  const [lot] = await db
    .select()
    .from(lots)
    .where(and(eq(lots.id, input.lotId), eq(lots.userId, userId)));

  if (!lot) throw new Error("NOT_FOUND");
  if (lot.isLiquidated) throw new Error("LOT_ALREADY_LIQUIDATED");

  const lotShares = lot.shares ? parseFloat(lot.shares) : 0;
  if (lotShares <= 0) throw new Error("LOT_HAS_NO_SHARES");
  if (input.sharesSold > lotShares)
    throw new Error("CANNOT_SELL_MORE_THAN_OWNED");

  // 2. Calculate financials
  const costPerShare = lot.costPerShareCents ?? (lotShares > 0 ? Math.round(lot.costBasisCents / lotShares) : 0);
  const soldCostBasis = Math.round(costPerShare * input.sharesSold);
  const grossProceeds = Math.round(input.sellPriceCents * input.sharesSold);
  const netProceeds = grossProceeds - input.feesCents;
  const realizedGainLoss = netProceeds - soldCostBasis;
  const isFullLiquidation = input.sharesSold >= lotShares;

  const sellNote = [
    `Sold ${input.sharesSold} shares @ ${(input.sellPriceCents / 100).toFixed(2)}/share`,
    `on ${input.soldAt.toISOString().split("T")[0]}`,
    input.feesCents > 0 ? `(fees: $${(input.feesCents / 100).toFixed(2)})` : "",
  ]
    .filter(Boolean)
    .join(" ");

  if (isFullLiquidation) {
    // Mark the entire lot as liquidated
    await db
      .update(lots)
      .set({
        isLiquidated: true,
        currentValueCents: netProceeds,
        notes: lot.notes ? `${lot.notes}\n${sellNote}` : sellNote,
        updatedAt: now,
      })
      .where(eq(lots.id, input.lotId));

    await logAuditEvent({
      actorId: userId,
      action: "UPDATE",
      resourceType: "lot",
      resourceId: input.lotId,
      metadata: {
        action: "full_liquidation",
        sharesSold: input.sharesSold,
        sellPriceCents: input.sellPriceCents,
        feesCents: input.feesCents,
        proceedsCents: netProceeds,
        realizedGainLossCents: realizedGainLoss,
      },
    });
  } else {
    // Partial liquidation: reduce original lot, create sold lot
    const remainingShares = lotShares - input.sharesSold;
    const remainingCostBasis = lot.costBasisCents - soldCostBasis;

    // Update the original lot with reduced shares
    await db
      .update(lots)
      .set({
        shares: remainingShares.toString(),
        costBasisCents: remainingCostBasis,
        updatedAt: now,
      })
      .where(eq(lots.id, input.lotId));

    // Create a new lot for the sold portion
    const [soldLot] = await db
      .insert(lots)
      .values({
        holdingId: lot.holdingId,
        userId,
        shares: input.sharesSold.toString(),
        costBasisCents: soldCostBasis,
        costPerShareCents: costPerShare,
        acquiredAt: lot.acquiredAt,
        currentValueCents: netProceeds,
        isLiquidated: true,
        notes: sellNote,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    await logAuditEvent({
      actorId: userId,
      action: "UPDATE",
      resourceType: "lot",
      resourceId: input.lotId,
      metadata: {
        action: "partial_liquidation",
        sharesSold: input.sharesSold,
        remainingShares,
        sellPriceCents: input.sellPriceCents,
        feesCents: input.feesCents,
        proceedsCents: netProceeds,
        realizedGainLossCents: realizedGainLoss,
        newSoldLotId: soldLot.id,
      },
    });
  }

  // 3. Check if all lots in the holding are now liquidated
  const remainingActiveLots = await db
    .select()
    .from(lots)
    .where(
      and(
        eq(lots.holdingId, lot.holdingId),
        eq(lots.userId, userId),
        eq(lots.isLiquidated, false),
      ),
    );

  const holdingFullyLiquidated = remainingActiveLots.length === 0;

  if (holdingFullyLiquidated) {
    await db
      .update(holdings)
      .set({
        isLiquidated: true,
        liquidatedAt: now,
        updatedAt: now,
      })
      .where(
        and(
          eq(holdings.id, lot.holdingId),
          eq(holdings.userId, userId),
          isNull(holdings.deletedAt),
        ),
      );

    await logAuditEvent({
      actorId: userId,
      action: "UPDATE",
      resourceType: "holding",
      resourceId: lot.holdingId,
      metadata: { action: "fully_liquidated" },
    });
  }

  return {
    proceedsCents: netProceeds,
    costBasisCents: soldCostBasis,
    realizedGainLossCents: realizedGainLoss,
    isFullLiquidation,
    holdingFullyLiquidated,
  };
}

// ─── Realized Transactions ──────────────────────────────────────────

export interface RealizedTransactionRow {
  id: string;
  holdingId: string;
  ticker: string | null;
  holdingName: string;
  assetType: string;
  assetTypeLabel: string;
  sharesSold: number;
  costBasisCents: number;
  costPerShareCents: number;
  proceedsCents: number;
  realizedGainLossCents: number;
  realizedGainLossPercent: number;
  acquiredAt: Date | null;
  soldAt: Date;
  accountName: string;
  custodianLabel: string;
  notes: string | null;
}

/**
 * Get all liquidated lots across all holdings for the authenticated user,
 * enriched with holding metadata and account info.
 *
 * Used by the Realized Transactions page.
 * Sorted by soldAt (updatedAt) descending — most recent sales first.
 */
export async function getRealizedTransactions(): Promise<RealizedTransactionRow[]> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  // 1. Fetch all liquidated lots
  const liquidatedLots = await db
    .select()
    .from(lots)
    .where(and(eq(lots.userId, userId), eq(lots.isLiquidated, true)));

  if (liquidatedLots.length === 0) return [];

  // 2. Fetch parent holdings
  const holdingIds = [...new Set(liquidatedLots.map((l) => l.holdingId))];
  const parentHoldings = await db
    .select()
    .from(holdings)
    .where(inArray(holdings.id, holdingIds));

  const holdingMap = new Map(parentHoldings.map((h) => [h.id, h]));

  // 3. Fetch accounts
  const accountIds = [...new Set(parentHoldings.map((h) => h.accountId))];
  const userAccounts = accountIds.length > 0
    ? await db
        .select()
        .from(accounts)
        .where(inArray(accounts.id, accountIds))
    : [];

  const accountMap = new Map(userAccounts.map((a) => [a.id, a]));

  // 4. Build rows
  const rows: RealizedTransactionRow[] = liquidatedLots.map((lot) => {
    const holding = holdingMap.get(lot.holdingId);
    const acct = holding ? accountMap.get(holding.accountId) : undefined;

    const shares = lot.shares ? parseFloat(lot.shares) : 0;
    const costBasis = lot.costBasisCents ?? 0;
    const proceeds = lot.currentValueCents ?? 0;
    const costPerShare = lot.costPerShareCents ?? (shares > 0 ? Math.round(costBasis / shares) : 0);
    const realizedGainLoss = proceeds - costBasis;
    const realizedGainLossPercent =
      costBasis !== 0 ? (realizedGainLoss / costBasis) * 100 : 0;

    return {
      id: lot.id,
      holdingId: lot.holdingId,
      ticker: holding?.ticker ?? null,
      holdingName: holding?.name ?? "Unknown",
      assetType: holding?.assetType ?? "other",
      assetTypeLabel: ASSET_TYPES[(holding?.assetType ?? "other") as AssetType] ?? "Other",
      sharesSold: shares,
      costBasisCents: costBasis,
      costPerShareCents: costPerShare,
      proceedsCents: proceeds,
      realizedGainLossCents: realizedGainLoss,
      realizedGainLossPercent,
      acquiredAt: lot.acquiredAt,
      soldAt: lot.updatedAt,
      accountName: acct?.name ?? "Unknown",
      custodianLabel:
        CUSTODIANS[(acct?.custodian ?? "other") as Custodian] ??
        acct?.custodian ??
        "Other",
      notes: lot.notes,
    };
  });

  // Sort by sold date descending
  rows.sort((a, b) => b.soldAt.getTime() - a.soldAt.getTime());

  return rows;
}
