import { z } from "zod";

// ─── Portfolio Validators ───────────────────────────────────────────

export const createPortfolioSchema = z.object({
  name: z
    .string()
    .min(1, "Portfolio name is required")
    .max(100, "Portfolio name must be 100 characters or fewer"),
  description: z
    .string()
    .max(500, "Description must be 500 characters or fewer")
    .nullish(),
  isDefault: z.boolean().optional().default(false),
});

export const updatePortfolioSchema = z.object({
  name: z
    .string()
    .min(1, "Portfolio name is required")
    .max(100, "Portfolio name must be 100 characters or fewer")
    .optional(),
  description: z
    .string()
    .max(500, "Description must be 500 characters or fewer")
    .nullish(),
  isDefault: z.boolean().optional(),
});

export const deletePortfolioSchema = z.object({
  portfolioId: z.string().uuid("Invalid portfolio ID"),
});

// ─── Inferred Types ─────────────────────────────────────────────────

export type CreatePortfolioInput = z.infer<typeof createPortfolioSchema>;
export type UpdatePortfolioInput = z.infer<typeof updatePortfolioSchema>;
export type DeletePortfolioInput = z.infer<typeof deletePortfolioSchema>;
