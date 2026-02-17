import { db } from "@/db";
import { realizedTransactions } from "@/db/schema/realized-transactions";
import { lots } from "@/db/schema/lots";
import { holdings } from "@/db/schema/holdings";
import { accounts } from "@/db/schema/accounts";
import { portfolios } from "@/db/schema/portfolios";
import { householdMembers } from "@/db/schema/households";
import { households } from "@/db/schema/households";
import { clientAssignments } from "@/db/schema/client-assignments";
import { auditLogs } from "@/db/schema/audit-logs";
import { eq } from "drizzle-orm";
import { logAuditEvent } from "./audit";

/**
 * Wipe all financial data belonging to a user.
 *
 * Deletes in strict FK-safe order (children → parents):
 *   1. realized_transactions
 *   2. lots
 *   3. holdings
 *   4. accounts
 *   5. portfolios
 *   6. household_members
 *   7. households (where user is creator)
 *   8. client_assignments
 *   9. audit_logs (user's own logs)
 *
 * Does NOT delete the `users` row — the user remains in the system
 * with their Clerk account intact, just with a clean slate.
 *
 * Logs a single audit event after the wipe completes.
 */
export async function wipeAllUserData(userId: string): Promise<{
  deletedCounts: Record<string, number>;
}> {
  const counts: Record<string, number> = {};

  // 1. Realized transactions
  const rt = await db
    .delete(realizedTransactions)
    .where(eq(realizedTransactions.userId, userId))
    .returning({ id: realizedTransactions.id });
  counts.realizedTransactions = rt.length;

  // 2. Lots
  const l = await db
    .delete(lots)
    .where(eq(lots.userId, userId))
    .returning({ id: lots.id });
  counts.lots = l.length;

  // 3. Holdings
  const h = await db
    .delete(holdings)
    .where(eq(holdings.userId, userId))
    .returning({ id: holdings.id });
  counts.holdings = h.length;

  // 4. Accounts
  const a = await db
    .delete(accounts)
    .where(eq(accounts.userId, userId))
    .returning({ id: accounts.id });
  counts.accounts = a.length;

  // 5. Portfolios
  const p = await db
    .delete(portfolios)
    .where(eq(portfolios.userId, userId))
    .returning({ id: portfolios.id });
  counts.portfolios = p.length;

  // 6. Household members
  const hm = await db
    .delete(householdMembers)
    .where(eq(householdMembers.userId, userId))
    .returning({ id: householdMembers.id });
  counts.householdMembers = hm.length;

  // 7. Households created by this user
  const hh = await db
    .delete(households)
    .where(eq(households.createdBy, userId))
    .returning({ id: households.id });
  counts.households = hh.length;

  // 8. Client assignments (as manager or client)
  const ca1 = await db
    .delete(clientAssignments)
    .where(eq(clientAssignments.wealthManagerId, userId))
    .returning({ id: clientAssignments.id });
  const ca2 = await db
    .delete(clientAssignments)
    .where(eq(clientAssignments.clientId, userId))
    .returning({ id: clientAssignments.id });
  counts.clientAssignments = ca1.length + ca2.length;

  // 9. Audit logs belonging to this user
  const al = await db
    .delete(auditLogs)
    .where(eq(auditLogs.actorId, userId))
    .returning({ id: auditLogs.id });
  counts.auditLogs = al.length;

  // Log the wipe event (this creates a new audit entry after clearing old ones)
  await logAuditEvent({
    actorId: userId,
    action: "DELETE",
    resourceType: "user",
    metadata: {
      operation: "data_wipe",
      deletedCounts: counts,
    },
  });

  return { deletedCounts: counts };
}
