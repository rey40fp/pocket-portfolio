"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import {
  liquidatePositionSchema,
  undoLiquidationSchema,
  type LiquidatePositionInput,
  type UndoLiquidationInput,
} from "@/server/validators/transactions";
import { liquidatePosition as liquidateInDB } from "@/server/dal/transactions";
import { db } from "@/db";
import { realizedTransactions } from "@/db/schema/realized-transactions";
import { lots } from "@/db/schema/lots";
import { holdings } from "@/db/schema/holdings";
import { eq, and } from "drizzle-orm";
import { logAuditEvent } from "@/server/dal/audit";

/**
 * Liquidate a position (sell shares from a lot).
 *
 * Validates input, delegates to the DAL which computes realized gain,
 * creates the transaction record, and marks the lot/holding as liquidated.
 */
export async function liquidatePosition(input: LiquidatePositionInput) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const validated = liquidatePositionSchema.parse(input);

  const result = await liquidateInDB({
    ...validated,
    soldAt: new Date(validated.soldAt),
  });

  revalidatePath("/dashboard/holdings");
  revalidatePath(`/dashboard/holdings/${validated.holdingId}`);
  revalidatePath("/dashboard");
  return {
    success: true as const,
    transactionId: result.transaction.id,
    realizedGainCents: result.realizedGainCents,
  };
}

/**
 * Undo a liquidation within 24 hours.
 *
 * Reverses the realized transaction: deletes the transaction record,
 * marks the lot as not liquidated, and rechecks the holding's status.
 *
 * This function accesses the DB directly because the undo logic is
 * specific to Server Actions and doesn't warrant a separate DAL function
 * that would only be called from here. The auth check and audit log
 * are still enforced.
 */
export async function undoLiquidation(input: UndoLiquidationInput) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const validated = undoLiquidationSchema.parse(input);

  // Fetch the transaction and verify ownership
  const [transaction] = await db
    .select()
    .from(realizedTransactions)
    .where(
      and(
        eq(realizedTransactions.id, validated.transactionId),
        eq(realizedTransactions.userId, userId),
      ),
    );

  if (!transaction) throw new Error("NOT_FOUND");

  // Enforce 24-hour undo window
  const hoursSinceCreation =
    (Date.now() - transaction.createdAt.getTime()) / (1000 * 60 * 60);
  if (hoursSinceCreation > 24) {
    throw new Error("UNDO_WINDOW_EXPIRED");
  }

  // Delete the realized transaction
  await db
    .delete(realizedTransactions)
    .where(eq(realizedTransactions.id, validated.transactionId));

  // Un-liquidate the lot
  await db
    .update(lots)
    .set({ isLiquidated: false, updatedAt: new Date() })
    .where(eq(lots.id, transaction.lotId));

  // Un-liquidate the holding (it has at least one active lot now)
  await db
    .update(holdings)
    .set({ isLiquidated: false, liquidatedAt: null, updatedAt: new Date() })
    .where(eq(holdings.id, transaction.holdingId));

  await logAuditEvent({
    actorId: userId,
    action: "DELETE",
    resourceType: "transaction",
    resourceId: validated.transactionId,
    metadata: {
      action: "undo_liquidation",
      lotId: transaction.lotId,
      holdingId: transaction.holdingId,
    },
  });

  revalidatePath("/dashboard/holdings");
  revalidatePath(`/dashboard/holdings/${transaction.holdingId}`);
  revalidatePath("/dashboard");
  return { success: true as const };
}
