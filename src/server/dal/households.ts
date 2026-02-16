import { db } from "@/db";
import { households, householdMembers } from "@/db/schema/households";
import { eq, and } from "drizzle-orm";
import { auth } from "@clerk/nextjs/server";
import { logAuditEvent } from "./audit";
import type { HouseholdRole } from "@/lib/constants";

// ─── Types ───────────────────────────────────────────────────────────

interface CreateHouseholdInput {
  name: string;
}

// ─── DAL Functions ───────────────────────────────────────────────────

/**
 * Create a new household and add the creator as the owner.
 */
export async function createHousehold(input: CreateHouseholdInput) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const now = new Date();

  const [household] = await db
    .insert(households)
    .values({
      name: input.name,
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  // Add the creator as the owner member
  await db.insert(householdMembers).values({
    householdId: household.id,
    userId,
    role: "owner",
    status: "active",
    invitedAt: now,
    acceptedAt: now,
  });

  await logAuditEvent({
    actorId: userId,
    action: "CREATE",
    resourceType: "household",
    resourceId: household.id,
    metadata: { name: input.name },
  });

  return household;
}

/**
 * Invite a user to a household.
 * Only the household owner can invite members.
 */
export async function inviteMember(
  householdId: string,
  targetUserId: string,
  role: HouseholdRole = "member",
) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  // Verify caller is the household owner
  const [callerMembership] = await db
    .select()
    .from(householdMembers)
    .where(
      and(
        eq(householdMembers.householdId, householdId),
        eq(householdMembers.userId, userId),
        eq(householdMembers.role, "owner"),
        eq(householdMembers.status, "active"),
      ),
    );

  if (!callerMembership) throw new Error("Forbidden");

  const now = new Date();

  const [member] = await db
    .insert(householdMembers)
    .values({
      householdId,
      userId: targetUserId,
      role,
      status: "pending",
      invitedAt: now,
    })
    .returning();

  await logAuditEvent({
    actorId: userId,
    action: "CREATE",
    resourceType: "household",
    resourceId: householdId,
    metadata: { action: "invite", targetUserId, role },
  });

  return member;
}

/**
 * Remove a member from a household.
 * Only the household owner can remove members.
 * Owners cannot remove themselves.
 */
export async function removeMember(householdId: string, targetUserId: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  // Verify caller is the household owner
  const [callerMembership] = await db
    .select()
    .from(householdMembers)
    .where(
      and(
        eq(householdMembers.householdId, householdId),
        eq(householdMembers.userId, userId),
        eq(householdMembers.role, "owner"),
        eq(householdMembers.status, "active"),
      ),
    );

  if (!callerMembership) throw new Error("Forbidden");
  if (targetUserId === userId) throw new Error("CANNOT_REMOVE_OWNER");

  const now = new Date();

  const [updated] = await db
    .update(householdMembers)
    .set({ status: "removed" })
    .where(
      and(
        eq(householdMembers.householdId, householdId),
        eq(householdMembers.userId, targetUserId),
      ),
    )
    .returning();

  if (!updated) throw new Error("NOT_FOUND");

  await logAuditEvent({
    actorId: userId,
    action: "DELETE",
    resourceType: "household",
    resourceId: householdId,
    metadata: { action: "remove_member", targetUserId },
  });

  return updated;
}

/**
 * Accept a household invitation.
 * The target user must have a pending membership for this household.
 */
export async function acceptInvitation(householdId: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const now = new Date();

  const [updated] = await db
    .update(householdMembers)
    .set({ status: "active", acceptedAt: now })
    .where(
      and(
        eq(householdMembers.householdId, householdId),
        eq(householdMembers.userId, userId),
        eq(householdMembers.status, "pending"),
      ),
    )
    .returning();

  if (!updated) throw new Error("NOT_FOUND");

  await logAuditEvent({
    actorId: userId,
    action: "UPDATE",
    resourceType: "household",
    resourceId: householdId,
    metadata: { action: "accept_invitation" },
  });

  return updated;
}

/**
 * Get all households the authenticated user belongs to (active or pending).
 */
export async function getHouseholds() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  return db
    .select({
      membership: householdMembers,
      household: households,
    })
    .from(householdMembers)
    .innerJoin(households, eq(householdMembers.householdId, households.id))
    .where(eq(householdMembers.userId, userId));
}

/**
 * Get all members of a household.
 * Only members of the household can view other members.
 */
export async function getHouseholdMembers(householdId: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  // Verify caller is a member of this household
  const [callerMembership] = await db
    .select()
    .from(householdMembers)
    .where(
      and(
        eq(householdMembers.householdId, householdId),
        eq(householdMembers.userId, userId),
      ),
    );

  if (!callerMembership) throw new Error("Forbidden");

  return db
    .select()
    .from(householdMembers)
    .where(eq(householdMembers.householdId, householdId));
}
