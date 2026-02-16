import { db } from "@/db";
import { lots } from "@/db/schema/lots";
import { eq, and } from "drizzle-orm";
import { auth } from "@clerk/nextjs/server";
import { logAuditEvent } from "./audit";

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
