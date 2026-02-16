"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import {
  createPortfolioSchema,
  updatePortfolioSchema,
  deletePortfolioSchema,
  type CreatePortfolioInput,
  type UpdatePortfolioInput,
  type DeletePortfolioInput,
} from "@/server/validators/portfolios";
import {
  createPortfolio as createPortfolioInDB,
  updatePortfolio as updatePortfolioInDB,
  deletePortfolio as deletePortfolioInDB,
} from "@/server/dal/portfolios";

/**
 * Create a new portfolio.
 */
export async function createPortfolio(input: CreatePortfolioInput) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const validated = createPortfolioSchema.parse(input);

  const portfolio = await createPortfolioInDB(validated);

  revalidatePath("/dashboard");
  return { success: true as const, portfolioId: portfolio.id };
}

/**
 * Update an existing portfolio.
 */
export async function updatePortfolio(
  portfolioId: string,
  input: UpdatePortfolioInput,
) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const validated = updatePortfolioSchema.parse(input);

  const portfolio = await updatePortfolioInDB(portfolioId, validated);

  revalidatePath("/dashboard");
  return { success: true as const, portfolioId: portfolio.id };
}

/**
 * Delete a portfolio.
 * Will fail if the portfolio still has accounts under it.
 */
export async function deletePortfolio(input: DeletePortfolioInput) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const validated = deletePortfolioSchema.parse(input);

  await deletePortfolioInDB(validated.portfolioId);

  revalidatePath("/dashboard");
  return { success: true as const };
}
