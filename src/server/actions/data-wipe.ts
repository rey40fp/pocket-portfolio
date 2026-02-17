"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { wipeAllUserData } from "@/server/dal/data-wipe";

const wipeDataSchema = z.object({
  confirmation: z
    .string()
    .refine((val) => val === "DELETE ALL MY DATA", {
      message: 'You must type "DELETE ALL MY DATA" to confirm.',
    }),
});

/**
 * Server Action: wipe all financial data for the current user.
 *
 * Requires the user to type a confirmation phrase to prevent accidental
 * triggers. The user's Clerk account remains intact — only portfolio,
 * account, holding, lot, and transaction data is removed.
 */
export async function wipeUserData(input: { confirmation: string }) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  // Validate the confirmation phrase
  const parsed = wipeDataSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false as const,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }

  try {
    const result = await wipeAllUserData(userId);

    // Revalidate all dashboard routes so they show empty states
    revalidatePath("/dashboard");
    revalidatePath("/accounts");
    revalidatePath("/holdings");
    revalidatePath("/analytics");
    revalidatePath("/settings");

    return {
      success: true as const,
      deletedCounts: result.deletedCounts,
    };
  } catch (err) {
    console.error("Data wipe failed:", err);
    return {
      success: false as const,
      error: "An unexpected error occurred. Please try again.",
    };
  }
}
