import type { UserRole } from "@/lib/constants";

export {};

declare global {
  /**
   * Extend Clerk's session claims to include our custom role metadata.
   *
   * In the Clerk Dashboard, configure the session token to include
   * `{{user.public_metadata}}` as the `metadata` claim. This gives
   * every authenticated request typed access to `sessionClaims.metadata.role`.
   */
  interface CustomJwtSessionClaims {
    metadata: {
      role?: UserRole;
    };
  }
}
