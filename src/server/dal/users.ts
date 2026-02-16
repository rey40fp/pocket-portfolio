import { db } from "@/db";
import { users } from "@/db/schema/users";
import { eq } from "drizzle-orm";
import { auth, currentUser } from "@clerk/nextjs/server";
import type { UserRole } from "@/lib/constants";
import { DEFAULT_USER_ROLE } from "@/lib/constants";

// ─── Types ───────────────────────────────────────────────────────────

interface SyncUserInput {
  id: string;
  email: string;
  displayName?: string | null;
  role?: UserRole;
  avatarUrl?: string | null;
}

// ─── DAL Functions ───────────────────────────────────────────────────

/**
 * Upsert a user record from Clerk data.
 *
 * Called after Clerk sign-up/sign-in (e.g., from a Clerk webhook or
 * on first authenticated request) to keep the local `users` table in
 * sync with Clerk's user directory.
 *
 * This function does NOT require an active session — it is designed
 * to be called from webhook handlers where only the Clerk payload
 * (not a browser session) is available.
 */
export async function syncUserFromClerk(input: SyncUserInput) {
  const now = new Date();

  const [user] = await db
    .insert(users)
    .values({
      id: input.id,
      email: input.email,
      displayName: input.displayName ?? null,
      role: input.role ?? DEFAULT_USER_ROLE,
      avatarUrl: input.avatarUrl ?? null,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: users.id,
      set: {
        email: input.email,
        displayName: input.displayName ?? null,
        avatarUrl: input.avatarUrl ?? null,
        updatedAt: now,
      },
    })
    .returning();

  return user;
}

/**
 * Get a user record by Clerk user ID.
 *
 * Requires an authenticated session. Regular users can only fetch
 * their own record; admins and wealth managers can fetch any user.
 */
export async function getUserById(targetUserId: string) {
  const { userId, sessionClaims } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const role: UserRole =
    sessionClaims?.metadata?.role ?? DEFAULT_USER_ROLE;

  // Non-privileged users can only look up themselves
  const isPrivileged = role === "admin" || role === "wealth_manager";
  if (!isPrivileged && userId !== targetUserId) {
    throw new Error("Forbidden");
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, targetUserId));

  return user ?? null;
}

/**
 * Get the database-stored role for a user.
 *
 * Requires an authenticated session. Returns the role column from the
 * `users` table (which is the authoritative source synced from Clerk
 * metadata). Falls back to the default "user" role if the user record
 * doesn't exist yet.
 *
 * Regular users can only query their own role; admins and wealth
 * managers can query any user's role.
 */
export async function getUserRole(targetUserId: string): Promise<UserRole> {
  const { userId, sessionClaims } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const callerRole: UserRole =
    sessionClaims?.metadata?.role ?? DEFAULT_USER_ROLE;

  // Non-privileged users can only check their own role
  const isPrivileged = callerRole === "admin" || callerRole === "wealth_manager";
  if (!isPrivileged && userId !== targetUserId) {
    throw new Error("Forbidden");
  }

  const [user] = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, targetUserId));

  return (user?.role as UserRole) ?? DEFAULT_USER_ROLE;
}

/**
 * Ensure the authenticated Clerk user exists in the local `users` table.
 *
 * Call this from server components / pages that need the user row to exist
 * (e.g., before creating portfolios, accounts, or any table with a FK to
 * users.id). This is a no-op if the user already exists.
 *
 * This replaces the need for a Clerk webhook during development and serves
 * as a safety net in production if the webhook delivery is delayed.
 */
export async function ensureUserSynced() {
  const { userId } = await auth();
  if (!userId) return null;

  // Fast-path: check if user already exists
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, userId));

  if (existing) return existing;

  // User doesn't exist — fetch details from Clerk and sync
  const clerkUser = await currentUser();
  if (!clerkUser) return null;

  const synced = await syncUserFromClerk({
    id: clerkUser.id,
    email: clerkUser.emailAddresses[0]?.emailAddress ?? "",
    displayName:
      [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") ||
      null,
    avatarUrl: clerkUser.imageUrl ?? null,
  });

  return synced;
}
