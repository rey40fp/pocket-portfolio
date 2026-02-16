import { z } from "zod";
import {
  ASSET_TYPES,
  ASSET_CATEGORIES,
  SECTORS,
  HOLDING_SOURCES,
} from "@/lib/constants";

// ─── Holding Validators ─────────────────────────────────────────────

export const createHoldingSchema = z.object({
  accountId: z.string().uuid("Invalid account ID"),
  ticker: z
    .string()
    .min(1)
    .max(10)
    .toUpperCase()
    .nullish(),
  name: z
    .string()
    .min(1, "Holding name is required")
    .max(200, "Holding name must be 200 characters or fewer"),
  assetType: z.enum(
    Object.keys(ASSET_TYPES) as [string, ...string[]],
    { message: "Invalid asset type" },
  ),
  assetCategory: z
    .enum(Object.keys(ASSET_CATEGORIES) as [string, ...string[]], {
      message: "Invalid asset category",
    })
    .nullish(),
  sector: z
    .enum(Object.keys(SECTORS) as [string, ...string[]], {
      message: "Invalid sector",
    })
    .nullish(),
  notes: z
    .string()
    .max(1000, "Notes must be 1000 characters or fewer")
    .nullish(),
  source: z
    .enum(Object.keys(HOLDING_SOURCES) as [string, ...string[]], {
      message: "Invalid source",
    })
    .optional()
    .default("manual"),
});

export const updateHoldingSchema = z.object({
  ticker: z
    .string()
    .min(1)
    .max(10)
    .toUpperCase()
    .nullish(),
  name: z
    .string()
    .min(1, "Holding name is required")
    .max(200, "Holding name must be 200 characters or fewer")
    .optional(),
  assetType: z
    .enum(Object.keys(ASSET_TYPES) as [string, ...string[]], {
      message: "Invalid asset type",
    })
    .optional(),
  assetCategory: z
    .enum(Object.keys(ASSET_CATEGORIES) as [string, ...string[]], {
      message: "Invalid asset category",
    })
    .nullish(),
  sector: z
    .enum(Object.keys(SECTORS) as [string, ...string[]], {
      message: "Invalid sector",
    })
    .nullish(),
  notes: z
    .string()
    .max(1000, "Notes must be 1000 characters or fewer")
    .nullish(),
});

// ─── Inferred Types ─────────────────────────────────────────────────

export type CreateHoldingInput = z.infer<typeof createHoldingSchema>;
export type UpdateHoldingInput = z.infer<typeof updateHoldingSchema>;
