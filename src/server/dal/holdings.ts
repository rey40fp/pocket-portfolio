import { db } from "@/db";
import { holdings } from "@/db/schema/holdings";
import { eq, and, isNull } from "drizzle-orm";
import { auth } from "@clerk/nextjs/server";
import { logAuditEvent } from "./audit";
import type { AssetType, AssetCategory, HoldingSource, Sector } from "@/lib/constants";

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
