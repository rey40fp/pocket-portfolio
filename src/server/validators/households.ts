import { z } from "zod";
import { HOUSEHOLD_ROLES } from "@/lib/constants";

// ─── Household Validators ───────────────────────────────────────────

export const createHouseholdSchema = z.object({
  name: z
    .string()
    .min(1, "Household name is required")
    .max(100, "Household name must be 100 characters or fewer"),
});

export const inviteMemberSchema = z.object({
  householdId: z.string().uuid("Invalid household ID"),
  targetUserId: z.string().min(1, "User ID is required"),
  role: z
    .enum(Object.keys(HOUSEHOLD_ROLES) as [string, ...string[]], {
      message: "Invalid household role",
    })
    .optional()
    .default("member"),
});

export const removeMemberSchema = z.object({
  householdId: z.string().uuid("Invalid household ID"),
  targetUserId: z.string().min(1, "User ID is required"),
});

export const acceptInvitationSchema = z.object({
  householdId: z.string().uuid("Invalid household ID"),
});

// ─── Inferred Types ─────────────────────────────────────────────────

export type CreateHouseholdInput = z.infer<typeof createHouseholdSchema>;
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;
export type RemoveMemberInput = z.infer<typeof removeMemberSchema>;
export type AcceptInvitationInput = z.infer<typeof acceptInvitationSchema>;
