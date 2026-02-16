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
  liquidateLotSchema,
  type AddLotInput,
} from "@/server/validators/lots";
import {
  createHolding as createHoldingInDB,
  updateHolding as updateHoldingInDB,
  findHoldingByTickerInAccount,
} from "@/server/dal/holdings";
import { addLot, liquidateLot } from "@/server/dal/lots";
import { findOrCreateAccountByName } from "@/server/dal/accounts";
import { getPortfolios, createPortfolio } from "@/server/dal/portfolios";

/**
 * Add a new holding (with an initial lot) to an account.
 *
 * If a holding with the same ticker already exists in the account
 * (for market assets), adds a new lot to the existing holding instead
 * of creating a duplicate. Each lot records a separate purchase with
 * its own cost basis, share count, and acquisition date — this enables
 * per-lot performance tracking and tax-lot accounting.
 *
 * For non-market assets (real estate, cash, other) a new holding is
 * always created since they have no ticker to match on.
 */
export async function addHolding(
  input: CreateHoldingInput & {
    shares?: string | null;
    costBasisCents: number;
    costPerShareCents?: number | null;
    acquiredAt?: string | null;
    currentValueCents?: number | null;
    mortgageMonthlyCents?: number | null;
    escrowMonthlyCents?: number | null;
    interestRateBps?: number | null;
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
    currentValueCents: addLotSchema.shape.currentValueCents,
    mortgageMonthlyCents: addLotSchema.shape.mortgageMonthlyCents,
    escrowMonthlyCents: addLotSchema.shape.escrowMonthlyCents,
    interestRateBps: addLotSchema.shape.interestRateBps,
  });
  const lotData = lotSchema.parse(input);

  // Check if a holding with the same ticker already exists in this account
  const existingHolding = await findHoldingByTickerInAccount(
    holdingData.accountId,
    holdingData.ticker,
  );

  const holdingId = existingHolding
    ? existingHolding.id
    : (await createHoldingInDB(holdingData)).id;

  // Create the lot under the holding (new or existing)
  await addLot({
    holdingId,
    shares: lotData.shares ?? null,
    costBasisCents: lotData.costBasisCents,
    costPerShareCents: lotData.costPerShareCents ?? null,
    acquiredAt: lotData.acquiredAt ? new Date(lotData.acquiredAt) : null,
    currentValueCents: lotData.currentValueCents ?? null,
    mortgageMonthlyCents: lotData.mortgageMonthlyCents ?? null,
    escrowMonthlyCents: lotData.escrowMonthlyCents ?? null,
    interestRateBps: lotData.interestRateBps ?? null,
  });

  revalidatePath("/holdings");
  revalidatePath("/accounts");
  revalidatePath("/dashboard");
  return {
    success: true as const,
    holdingId,
    isNewLot: !!existingHolding,
  };
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

  revalidatePath("/holdings");
  revalidatePath(`/holdings/${holdingId}`);
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

  revalidatePath("/holdings");
  revalidatePath(`/holdings/${validated.holdingId}`);
  revalidatePath("/dashboard");
  return { success: true as const, lotId: lot.id };
}

/**
 * Import holdings from a CSV file.
 *
 * Each row specifies an account_name (and optional account_number).
 * Accounts are auto-created if they don't already exist for this user.
 * If a holding with the same ticker already exists in the resolved account,
 * a new lot is added to the existing holding (multi-lot support).
 *
 * Dates are optional — when omitted, lots are created without an
 * acquisition date and performance tracking starts from inception.
 */
export async function importHoldingsFromCSV(
  rows: Array<{
    accountName: string;
    accountNumber?: string | null;
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

  // Ensure a default portfolio exists for account creation
  const portfolios = await getPortfolios();
  let defaultPortfolio = portfolios.find((p) => p.isDefault) ?? portfolios[0];
  if (!defaultPortfolio) {
    defaultPortfolio = await createPortfolio({
      name: "My Portfolio",
      isDefault: true,
    });
  }

  // Cache resolved accounts to avoid repeated lookups within the same import
  const accountCache = new Map<string, { id: string; name: string; isNew: boolean }>();
  const results: Array<{ holdingId: string; name: string; accountName: string }> = [];
  const accountsCreated: string[] = [];

  for (const row of rows) {
    // Resolve account (find existing or create new)
    const accountKey = row.accountName.trim().toLowerCase();
    let account = accountCache.get(accountKey);
    if (!account) {
      account = await findOrCreateAccountByName(
        defaultPortfolio.id,
        row.accountName,
        row.accountNumber,
      );
      accountCache.set(accountKey, account);
      if (account.isNew) accountsCreated.push(account.name);
    }

    const holdingData = createHoldingSchema.parse({
      accountId: account.id,
      ticker: row.ticker,
      name: row.name,
      assetType: row.assetType,
      source: "csv_import",
    });

    // Reuse existing holding if same ticker already exists in this account
    const existingHolding = await findHoldingByTickerInAccount(
      account.id,
      holdingData.ticker,
    );

    const holdingId = existingHolding
      ? existingHolding.id
      : (await createHoldingInDB(holdingData)).id;

    const lotValidated = addLotSchema.shape.costBasisCents.parse(row.costBasisCents);

    await addLot({
      holdingId,
      shares: row.shares ?? null,
      costBasisCents: lotValidated,
      costPerShareCents: row.costPerShareCents ?? null,
      acquiredAt: row.acquiredAt ? new Date(row.acquiredAt) : null,
    });

    results.push({ holdingId, name: row.name, accountName: account.name });
  }

  revalidatePath("/holdings");
  revalidatePath("/accounts");
  revalidatePath("/dashboard");
  return {
    success: true as const,
    imported: results.length,
    holdings: results,
    accountsCreated,
  };
}

/**
 * Liquidate (sell) shares from a specific lot.
 *
 * Handles both full and partial liquidation:
 * - Full: all shares sold → lot marked as liquidated
 * - Partial: some shares sold → lot split, sold portion marked as liquidated
 *
 * If all lots in the holding become liquidated, the holding itself
 * is marked as fully liquidated.
 */
export async function liquidatePosition(input: {
  lotId: string;
  sharesSold: number;
  sellPriceCents: number;
  feesCents: number;
  soldAt: string;
}) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const validated = liquidateLotSchema.parse(input);

  const result = await liquidateLot({
    lotId: validated.lotId,
    sharesSold: validated.sharesSold,
    sellPriceCents: validated.sellPriceCents,
    feesCents: validated.feesCents,
    soldAt: new Date(validated.soldAt),
  });

  revalidatePath("/holdings");
  revalidatePath("/accounts");
  revalidatePath("/dashboard");

  return {
    success: true as const,
    ...result,
  };
}
