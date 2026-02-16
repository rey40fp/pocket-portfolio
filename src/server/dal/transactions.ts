import { db } from "@/db";
import { realizedTransactions } from "@/db/schema/realized-transactions";
import { lots } from "@/db/schema/lots";
import { holdings } from "@/db/schema/holdings";
import { eq, and, sum } from "drizzle-orm";
import { auth } from "@clerk/nextjs/server";
import { logAuditEvent } from "./audit";

// ─── Types ───────────────────────────────────────────────────────────

interface LiquidatePositionInput {
  lotId: string;
  holdingId: string;
  sharesSold: string;
  sellPriceCents: number;
  feesCents?: number;
  soldAt: Date;
}

// ─── DAL Functions ───────────────────────────────────────────────────

/**
 * Liquidate a position (sell shares from a lot).
 *
 * 1. Validates ownership of the lot
 * 2. Computes realized gain = (sellPrice × sharesSold) − costBasis − fees
 * 3. Creates a `realized_transactions` record
 * 4. Marks the lot as liquidated
 * 5. Checks if all lots for the holding are liquidated; if so, marks the holding
 *
 * All financial amounts are integer cents.
 */
export async function liquidatePosition(input: LiquidatePositionInput) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  // Verify lot ownership
  const [lot] = await db
    .select()
    .from(lots)
    .where(and(eq(lots.id, input.lotId), eq(lots.userId, userId)));

  if (!lot) throw new Error("NOT_FOUND");
  if (lot.isLiquidated) throw new Error("LOT_ALREADY_LIQUIDATED");

  // Compute realized gain: (sellPrice × sharesSold) − costBasis − fees
  const sharesSoldNum = parseFloat(input.sharesSold);
  const totalProceeds = Math.round(input.sellPriceCents * sharesSoldNum);
  const fees = input.feesCents ?? 0;
  const realizedGainCents = totalProceeds - lot.costBasisCents - fees;

  // Create the realized transaction record
  const [transaction] = await db
    .insert(realizedTransactions)
    .values({
      lotId: input.lotId,
      holdingId: input.holdingId,
      userId,
      sharesSold: input.sharesSold,
      sellPriceCents: input.sellPriceCents,
      totalProceedsCents: totalProceeds,
      costBasisCents: lot.costBasisCents,
      feesCents: fees,
      realizedGainCents,
      soldAt: input.soldAt,
    })
    .returning();

  // Mark the lot as liquidated
  await db
    .update(lots)
    .set({ isLiquidated: true, updatedAt: new Date() })
    .where(eq(lots.id, input.lotId));

  // Check if all lots for this holding are now liquidated
  const remainingLots = await db
    .select()
    .from(lots)
    .where(
      and(
        eq(lots.holdingId, input.holdingId),
        eq(lots.userId, userId),
        eq(lots.isLiquidated, false),
      ),
    );

  if (remainingLots.length === 0) {
    const now = new Date();
    await db
      .update(holdings)
      .set({ isLiquidated: true, liquidatedAt: now, updatedAt: now })
      .where(eq(holdings.id, input.holdingId));
  }

  await logAuditEvent({
    actorId: userId,
    action: "CREATE",
    resourceType: "transaction",
    resourceId: transaction.id,
    metadata: {
      lotId: input.lotId,
      holdingId: input.holdingId,
      sharesSold: input.sharesSold,
      realizedGainCents,
    },
  });

  return { transaction, realizedGainCents };
}

/**
 * Get all realized transactions for the authenticated user.
 * Ordered by most recent sale first.
 */
export async function getRealizedTransactions() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  return db
    .select()
    .from(realizedTransactions)
    .where(eq(realizedTransactions.userId, userId))
    .orderBy(realizedTransactions.soldAt);
}

/**
 * Get realized transactions filtered by holding.
 */
export async function getRealizedTransactionsByHolding(holdingId: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  return db
    .select()
    .from(realizedTransactions)
    .where(
      and(
        eq(realizedTransactions.holdingId, holdingId),
        eq(realizedTransactions.userId, userId),
      ),
    );
}

/**
 * Get the total cashed-out amount (sum of all realized proceeds minus fees).
 * Returns integer cents.
 */
export async function getCashedOutTotal(): Promise<number> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const [result] = await db
    .select({
      totalProceeds: sum(realizedTransactions.totalProceedsCents),
      totalFees: sum(realizedTransactions.feesCents),
    })
    .from(realizedTransactions)
    .where(eq(realizedTransactions.userId, userId));

  const proceeds = Number(result?.totalProceeds ?? 0);
  const fees = Number(result?.totalFees ?? 0);

  return proceeds - fees;
}
