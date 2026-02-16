import { z } from "zod";

// ─── Transaction Validators ─────────────────────────────────────────

export const liquidatePositionSchema = z.object({
  lotId: z.string().uuid("Invalid lot ID"),
  holdingId: z.string().uuid("Invalid holding ID"),
  sharesSold: z
    .string()
    .regex(/^\d+(\.\d{1,8})?$/, "Shares sold must be a valid positive number"),
  sellPriceCents: z
    .number()
    .int("Sell price must be an integer (cents)")
    .positive("Sell price must be positive"),
  feesCents: z
    .number()
    .int("Fees must be an integer (cents)")
    .nonnegative("Fees cannot be negative")
    .optional()
    .default(0),
  soldAt: z
    .string()
    .datetime({ message: "Invalid date format" }),
});

export const undoLiquidationSchema = z.object({
  transactionId: z.string().uuid("Invalid transaction ID"),
});

// ─── Inferred Types ─────────────────────────────────────────────────

export type LiquidatePositionInput = z.infer<typeof liquidatePositionSchema>;
export type UndoLiquidationInput = z.infer<typeof undoLiquidationSchema>;
