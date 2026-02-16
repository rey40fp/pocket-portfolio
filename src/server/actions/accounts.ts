"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import {
  createAccountSchema,
  updateAccountSchema,
  deleteAccountSchema,
  type CreateAccountInput,
  type UpdateAccountInput,
  type DeleteAccountInput,
} from "@/server/validators/accounts";
import {
  createAccount as createAccountInDB,
  updateAccount as updateAccountInDB,
  softDeleteAccount,
} from "@/server/dal/accounts";

/**
 * Create a new account under a portfolio.
 */
export async function createAccount(input: CreateAccountInput) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const validated = createAccountSchema.parse(input);

  const account = await createAccountInDB(validated);

  revalidatePath("/dashboard/accounts");
  revalidatePath("/dashboard");
  return { success: true as const, accountId: account.id };
}

/**
 * Update an existing account.
 */
export async function updateAccount(
  accountId: string,
  input: UpdateAccountInput,
) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const validated = updateAccountSchema.parse(input);

  const account = await updateAccountInDB(accountId, validated);

  revalidatePath("/dashboard/accounts");
  revalidatePath(`/dashboard/accounts/${accountId}`);
  revalidatePath("/dashboard");
  return { success: true as const, accountId: account.id };
}

/**
 * Soft-delete an account.
 */
export async function deleteAccount(input: DeleteAccountInput) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const validated = deleteAccountSchema.parse(input);

  await softDeleteAccount(validated.accountId);

  revalidatePath("/dashboard/accounts");
  revalidatePath("/dashboard");
  return { success: true as const };
}
