import { z } from "zod";

// ─── Lot Validators ─────────────────────────────────────────────────

export const addLotSchema = z.object({
  holdingId: z.string().uuid("Invalid holding ID"),
  shares: z
    .string()
    .regex(/^\d+(\.\d{1,8})?$/, "Shares must be a valid positive number")
    .nullish(),
  costBasisCents: z
    .number()
    .int("Cost basis must be an integer (cents)")
    .nonnegative("Cost basis cannot be negative"),
  costPerShareCents: z
    .number()
    .int("Cost per share must be an integer (cents)")
    .nonnegative("Cost per share cannot be negative")
    .nullish(),
  acquiredAt: z
    .string()
    .datetime({ message: "Invalid date format" })
    .nullish(),
  currentValueCents: z
    .number()
    .int("Current value must be an integer (cents)")
    .nonnegative("Current value cannot be negative")
    .nullish(),
  mortgageMonthlyCents: z
    .number()
    .int("Mortgage amount must be an integer (cents)")
    .nonnegative("Mortgage amount cannot be negative")
    .nullish(),
  escrowMonthlyCents: z
    .number()
    .int("Escrow amount must be an integer (cents)")
    .nonnegative("Escrow amount cannot be negative")
    .nullish(),
  interestRateBps: z
    .number()
    .int("Interest rate must be an integer (basis points)")
    .nonnegative("Interest rate cannot be negative")
    .max(10000, "Interest rate cannot exceed 100%")
    .nullish(),
  notes: z
    .string()
    .max(1000, "Notes must be 1000 characters or fewer")
    .nullish(),
});

export const updateLotSchema = z.object({
  shares: z
    .string()
    .regex(/^\d+(\.\d{1,8})?$/, "Shares must be a valid positive number")
    .nullish(),
  costBasisCents: z
    .number()
    .int("Cost basis must be an integer (cents)")
    .nonnegative("Cost basis cannot be negative")
    .optional(),
  costPerShareCents: z
    .number()
    .int("Cost per share must be an integer (cents)")
    .nonnegative("Cost per share cannot be negative")
    .nullish(),
  acquiredAt: z
    .string()
    .datetime({ message: "Invalid date format" })
    .nullish(),
  currentValueCents: z
    .number()
    .int("Current value must be an integer (cents)")
    .nonnegative("Current value cannot be negative")
    .nullish(),
  mortgageMonthlyCents: z
    .number()
    .int("Mortgage amount must be an integer (cents)")
    .nonnegative("Mortgage amount cannot be negative")
    .nullish(),
  escrowMonthlyCents: z
    .number()
    .int("Escrow amount must be an integer (cents)")
    .nonnegative("Escrow amount cannot be negative")
    .nullish(),
  interestRateBps: z
    .number()
    .int("Interest rate must be an integer (basis points)")
    .nonnegative("Interest rate cannot be negative")
    .max(10000, "Interest rate cannot exceed 100%")
    .nullish(),
  notes: z
    .string()
    .max(1000, "Notes must be 1000 characters or fewer")
    .nullish(),
});

// ─── Liquidation Validator ───────────────────────────────────────────

export const liquidateLotSchema = z.object({
  lotId: z.string().uuid("Invalid lot ID"),
  sharesSold: z
    .number()
    .positive("Shares sold must be greater than 0"),
  sellPriceCents: z
    .number()
    .int("Sell price must be an integer (cents)")
    .positive("Sell price must be greater than 0"),
  feesCents: z
    .number()
    .int("Fees must be an integer (cents)")
    .nonnegative("Fees cannot be negative")
    .default(0),
  soldAt: z
    .string()
    .datetime({ message: "Invalid date format" }),
});

// ─── Inferred Types ─────────────────────────────────────────────────

export type AddLotInput = z.infer<typeof addLotSchema>;
export type UpdateLotInput = z.infer<typeof updateLotSchema>;
export type LiquidateLotInput = z.infer<typeof liquidateLotSchema>;
