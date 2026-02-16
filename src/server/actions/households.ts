"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import {
  createHouseholdSchema,
  inviteMemberSchema,
  removeMemberSchema,
  acceptInvitationSchema,
  type CreateHouseholdInput,
  type InviteMemberInput,
  type RemoveMemberInput,
  type AcceptInvitationInput,
} from "@/server/validators/households";
import {
  createHousehold as createHouseholdInDB,
  inviteMember as inviteMemberInDB,
  removeMember as removeMemberInDB,
  acceptInvitation as acceptInvitationInDB,
} from "@/server/dal/households";
import type { HouseholdRole } from "@/lib/constants";

/**
 * Create a new household.
 * The authenticated user becomes the owner automatically.
 */
export async function createHousehold(input: CreateHouseholdInput) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const validated = createHouseholdSchema.parse(input);

  const household = await createHouseholdInDB(validated);

  revalidatePath("/dashboard/household");
  return { success: true as const, householdId: household.id };
}

/**
 * Invite a user to join a household.
 * Only the household owner can invite members.
 */
export async function inviteMember(input: InviteMemberInput) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const validated = inviteMemberSchema.parse(input);

  const member = await inviteMemberInDB(
    validated.householdId,
    validated.targetUserId,
    validated.role as HouseholdRole,
  );

  revalidatePath("/dashboard/household");
  return { success: true as const, memberId: member.id };
}

/**
 * Remove a member from a household.
 * Only the household owner can remove members.
 */
export async function removeMember(input: RemoveMemberInput) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const validated = removeMemberSchema.parse(input);

  await removeMemberInDB(validated.householdId, validated.targetUserId);

  revalidatePath("/dashboard/household");
  return { success: true as const };
}

/**
 * Accept a pending household invitation.
 */
export async function acceptInvitation(input: AcceptInvitationInput) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const validated = acceptInvitationSchema.parse(input);

  await acceptInvitationInDB(validated.householdId);

  revalidatePath("/dashboard/household");
  revalidatePath("/dashboard");
  return { success: true as const };
}
