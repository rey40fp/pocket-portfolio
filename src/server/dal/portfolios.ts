import { db } from "@/db";
import { portfolios } from "@/db/schema/portfolios";
import { eq, and } from "drizzle-orm";
import { auth } from "@clerk/nextjs/server";
import { logAuditEvent } from "./audit";

// ─── Types ───────────────────────────────────────────────────────────

interface CreatePortfolioInput {
  name: string;
  description?: string | null;
  isDefault?: boolean;
}

interface UpdatePortfolioInput {
  name?: string;
  description?: string | null;
  isDefault?: boolean;
}

// ─── DAL Functions ───────────────────────────────────────────────────

/**
 * Get all portfolios belonging to the authenticated user.
 */
export async function getPortfolios() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  return db
    .select()
    .from(portfolios)
    .where(eq(portfolios.userId, userId));
}

/**
 * Get a single portfolio by ID.
 * Enforces that the portfolio belongs to the authenticated user.
 */
export async function getPortfolioById(portfolioId: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const [portfolio] = await db
    .select()
    .from(portfolios)
    .where(and(eq(portfolios.id, portfolioId), eq(portfolios.userId, userId)));

  return portfolio ?? null;
}

/**
 * Create a new portfolio for the authenticated user.
 */
export async function createPortfolio(input: CreatePortfolioInput) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const now = new Date();

  const [portfolio] = await db
    .insert(portfolios)
    .values({
      userId,
      name: input.name,
      description: input.description ?? null,
      isDefault: input.isDefault ?? false,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  await logAuditEvent({
    actorId: userId,
    action: "CREATE",
    resourceType: "portfolio",
    resourceId: portfolio.id,
    metadata: { name: input.name },
  });

  return portfolio;
}

/**
 * Update an existing portfolio.
 * Enforces ownership via the userId WHERE clause.
 */
export async function updatePortfolio(
  portfolioId: string,
  input: UpdatePortfolioInput,
) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const setValues: Record<string, unknown> = { updatedAt: new Date() };
  if (input.name !== undefined) setValues.name = input.name;
  if (input.description !== undefined) setValues.description = input.description;
  if (input.isDefault !== undefined) setValues.isDefault = input.isDefault;

  const [updated] = await db
    .update(portfolios)
    .set(setValues)
    .where(and(eq(portfolios.id, portfolioId), eq(portfolios.userId, userId)))
    .returning();

  if (!updated) throw new Error("NOT_FOUND");

  await logAuditEvent({
    actorId: userId,
    action: "UPDATE",
    resourceType: "portfolio",
    resourceId: portfolioId,
    metadata: { changes: Object.keys(input) },
  });

  return updated;
}

/**
 * Delete a portfolio.
 * Hard delete — only allowed if the portfolio has no accounts.
 * Enforces ownership via the userId WHERE clause.
 */
export async function deletePortfolio(portfolioId: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const [deleted] = await db
    .delete(portfolios)
    .where(and(eq(portfolios.id, portfolioId), eq(portfolios.userId, userId)))
    .returning();

  if (!deleted) throw new Error("NOT_FOUND");

  await logAuditEvent({
    actorId: userId,
    action: "DELETE",
    resourceType: "portfolio",
    resourceId: portfolioId,
    metadata: { name: deleted.name },
  });

  return deleted;
}
