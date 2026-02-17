import { z } from "zod";
import {
  ASSET_TYPES,
  ASSET_CATEGORIES,
  SECTORS,
  HOLDING_SOURCES,
  type AssetType,
} from "@/lib/constants";

// ─── Helpers ─────────────────────────────────────────────────────────

/** Type-safe Object.keys that preserves literal key types */
function keysOf<T extends Record<string, unknown>>(obj: T): [keyof T & string, ...(keyof T & string)[]] {
  return Object.keys(obj) as [keyof T & string, ...(keyof T & string)[]];
}

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
  assetType: z.enum(keysOf(ASSET_TYPES), { message: "Invalid asset type" }),
  assetCategory: z
    .enum(keysOf(ASSET_CATEGORIES), { message: "Invalid asset category" })
    .nullish(),
  sector: z
    .enum(keysOf(SECTORS), { message: "Invalid sector" })
    .nullish(),
  notes: z
    .string()
    .max(1000, "Notes must be 1000 characters or fewer")
    .nullish(),
  source: z
    .enum(keysOf(HOLDING_SOURCES), { message: "Invalid source" })
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
    .enum(keysOf(ASSET_TYPES), { message: "Invalid asset type" })
    .optional(),
  assetCategory: z
    .enum(keysOf(ASSET_CATEGORIES), { message: "Invalid asset category" })
    .nullish(),
  sector: z
    .enum(keysOf(SECTORS), { message: "Invalid sector" })
    .nullish(),
  notes: z
    .string()
    .max(1000, "Notes must be 1000 characters or fewer")
    .nullish(),
});

// ─── Inferred Types ─────────────────────────────────────────────────

export type CreateHoldingInput = z.infer<typeof createHoldingSchema>;
export type UpdateHoldingInput = z.infer<typeof updateHoldingSchema>;
