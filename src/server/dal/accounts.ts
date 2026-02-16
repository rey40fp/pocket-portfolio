import { db } from "@/db";
import { accounts } from "@/db/schema/accounts";
import { eq, and, isNull } from "drizzle-orm";
import { auth } from "@clerk/nextjs/server";
import { logAuditEvent } from "./audit";

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
