"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  createHoldingSchema,
  updateHoldingSchema,
  type CreateHoldingInput,
  type UpdateHoldingInput,
} from "@/server/validators/holdings";
import {
  addLotSchema,
  type AddLotInput,
} from "@/server/validators/lots";
import {
  createHolding as createHoldingInDB,
  updateHolding as updateHoldingInDB,
} from "@/server/dal/holdings";
import { addLot } from "@/server/dal/lots";

/**
 * Add a new holding (with an initial lot) to an account.
 *
 * Creates the holding record first, then creates the first lot
 * under it with the provided cost basis and share data.
 */
export async function addHolding(
  input: CreateHoldingInput & {
    shares?: string | null;
    costBasisCents: number;
    costPerShareCents?: number | null;
    acquiredAt?: string | null;
  },
) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  // Validate the holding fields
  const holdingData = createHoldingSchema.parse(input);

  // Validate the lot fields
  const lotSchema = z.object({
    shares: addLotSchema.shape.shares,
    costBasisCents: addLotSchema.shape.costBasisCents,
    costPerShareCents: addLotSchema.shape.costPerShareCents,
    acquiredAt: addLotSchema.shape.acquiredAt,
  });
  const lotData = lotSchema.parse(input);

  // Create the holding
  const holding = await createHoldingInDB(holdingData);

  // Create the first lot under it
  await addLot({
    holdingId: holding.id,
    shares: lotData.shares ?? null,
    costBasisCents: lotData.costBasisCents,
    costPerShareCents: lotData.costPerShareCents ?? null,
    acquiredAt: lotData.acquiredAt ? new Date(lotData.acquiredAt) : null,
  });

  revalidatePath("/dashboard/holdings");
  revalidatePath("/dashboard/accounts");
  revalidatePath("/dashboard");
  return { success: true as const, holdingId: holding.id };
}

/**
 * Update an existing holding's metadata.
 */
export async function updateHolding(
  holdingId: string,
  input: UpdateHoldingInput,
) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const validated = updateHoldingSchema.parse(input);

  const holding = await updateHoldingInDB(holdingId, validated);

  revalidatePath("/dashboard/holdings");
  revalidatePath(`/dashboard/holdings/${holdingId}`);
  revalidatePath("/dashboard");
  return { success: true as const, holdingId: holding.id };
}

/**
 * Add an additional lot (purchase) to an existing holding.
 */
export async function addLotToHolding(input: AddLotInput) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const validated = addLotSchema.parse(input);

  const lot = await addLot({
    ...validated,
    acquiredAt: validated.acquiredAt ? new Date(validated.acquiredAt) : null,
  });

  revalidatePath("/dashboard/holdings");
  revalidatePath(`/dashboard/holdings/${validated.holdingId}`);
  revalidatePath("/dashboard");
  return { success: true as const, lotId: lot.id };
}

/**
 * Import holdings from a CSV file.
 *
 * Accepts an array of pre-parsed rows (client parses the CSV,
 * server validates and inserts). Each row creates a holding + lot.
 */
export async function importHoldingsFromCSV(
  accountId: string,
  rows: Array<{
    ticker?: string | null;
    name: string;
    assetType: string;
    shares?: string | null;
    costBasisCents: number;
    costPerShareCents?: number | null;
    acquiredAt?: string | null;
  }>,
) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const accountIdSchema = z.string().uuid("Invalid account ID");
  accountIdSchema.parse(accountId);

  const results: Array<{ holdingId: string; name: string }> = [];

  for (const row of rows) {
    const holdingData = createHoldingSchema.parse({
      accountId,
      ticker: row.ticker,
      name: row.name,
      assetType: row.assetType,
      source: "csv_import",
    });

    const holding = await createHoldingInDB(holdingData);

    const lotValidated = addLotSchema.shape.costBasisCents.parse(row.costBasisCents);

    await addLot({
      holdingId: holding.id,
      shares: row.shares ?? null,
      costBasisCents: lotValidated,
      costPerShareCents: row.costPerShareCents ?? null,
      acquiredAt: row.acquiredAt ? new Date(row.acquiredAt) : null,
    });

    results.push({ holdingId: holding.id, name: row.name });
  }

  revalidatePath("/dashboard/holdings");
  revalidatePath("/dashboard/accounts");
  revalidatePath("/dashboard");
  return { success: true as const, imported: results.length, holdings: results };
}
