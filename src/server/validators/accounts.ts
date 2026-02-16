import { z } from "zod";
import { ACCOUNT_TYPES, CUSTODIANS } from "@/lib/constants";

// ─── Account Validators ─────────────────────────────────────────────

export const createAccountSchema = z.object({
  portfolioId: z.string().uuid("Invalid portfolio ID"),
  name: z
    .string()
    .min(1, "Account name is required")
    .max(100, "Account name must be 100 characters or fewer"),
  custodian: z.enum(
    Object.keys(CUSTODIANS) as [string, ...string[]],
    { message: "Invalid custodian" },
  ),
  accountType: z.enum(
    Object.keys(ACCOUNT_TYPES) as [string, ...string[]],
    { message: "Invalid account type" },
  ),
  notes: z
    .string()
    .max(1000, "Notes must be 1000 characters or fewer")
    .nullish(),
});

export const updateAccountSchema = z.object({
  name: z
    .string()
    .min(1, "Account name is required")
    .max(100, "Account name must be 100 characters or fewer")
    .optional(),
  custodian: z
    .enum(Object.keys(CUSTODIANS) as [string, ...string[]], {
      message: "Invalid custodian",
    })
    .optional(),
  accountType: z
    .enum(Object.keys(ACCOUNT_TYPES) as [string, ...string[]], {
      message: "Invalid account type",
    })
    .optional(),
  notes: z
    .string()
    .max(1000, "Notes must be 1000 characters or fewer")
    .nullish(),
});

export const deleteAccountSchema = z.object({
  accountId: z.string().uuid("Invalid account ID"),
});

// ─── Inferred Types ─────────────────────────────────────────────────

export type CreateAccountInput = z.infer<typeof createAccountSchema>;
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;
export type DeleteAccountInput = z.infer<typeof deleteAccountSchema>;
