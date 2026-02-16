import { auth } from "@clerk/nextjs/server";
import type { UserRole } from "@/lib/constants";
import { DEFAULT_USER_ROLE } from "@/lib/constants";

/**
 * Require that the request is authenticated.
 * Throws "Unauthorized" if no user session exists.
 */
export async function requireAuth() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  return { userId };
}

/**
 * Require that the authenticated user has one of the specified roles.
 * Extracts the role from Clerk session claims (`publicMetadata.role`).
 * Falls back to the default "user" role if none is set.
 *
 * @throws {Error} "Unauthorized" if not authenticated
 * @throws {Error} "Forbidden" if the user's role is not in `allowedRoles`
 *
 * @example
 * // In a Server Action or DAL function:
 * const { userId, role } = await requireRole(["admin", "wealth_manager"]);
 */
export async function requireRole(allowedRoles: UserRole[]) {
  const { userId, sessionClaims } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const role: UserRole = sessionClaims?.metadata?.role ?? DEFAULT_USER_ROLE;

  if (!allowedRoles.includes(role)) throw new Error("Forbidden");

  return { userId, role };
}

/**
 * Get the current user's role without enforcing any specific role.
 * Useful for conditional UI or branching logic.
 * Returns the default "user" role if no role metadata is set.
 *
 * @throws {Error} "Unauthorized" if not authenticated
 */
export async function getCurrentUser() {
  const { userId, sessionClaims } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const role: UserRole = sessionClaims?.metadata?.role ?? DEFAULT_USER_ROLE;

  return { userId, role };
}
