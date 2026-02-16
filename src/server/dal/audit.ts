import { db } from "@/db";
import { auditLogs } from "@/db/schema/audit-logs";
import type { AuditAction, AuditResourceType } from "@/lib/constants";

// ─── Types ───────────────────────────────────────────────────────────

interface AuditEventInput {
  actorId: string;
  action: AuditAction;
  resourceType: AuditResourceType;
  resourceId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  success?: boolean;
}

// ─── DAL Functions ───────────────────────────────────────────────────

/**
 * Write an audit log entry.
 *
 * Called by every DAL mutation (create, update, delete) to maintain a
 * tamper-evident history of all financial data changes.
 *
 * This function intentionally does NOT call `auth()` itself — the
 * `actorId` is passed in by the calling DAL function which has already
 * verified the session. This keeps audit logging decoupled from the
 * auth mechanism (e.g., webhook-originated writes can still be audited).
 */
export async function logAuditEvent(input: AuditEventInput) {
  const [entry] = await db
    .insert(auditLogs)
    .values({
      actorId: input.actorId,
      action: input.action,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      metadata: input.metadata ?? {},
      ipAddress: input.ipAddress,
      success: input.success ?? true,
    })
    .returning();

  return entry;
}
