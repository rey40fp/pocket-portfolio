import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL is not set. Add it to .env.local with your Supabase connection string.",
  );
}

/**
 * Raw postgres.js client used by Drizzle.
 * Uses connection pooling params suited for serverless (Vercel).
 *
 * This file must only be imported in server-side code:
 *   - Server Components
 *   - Server Actions
 *   - API Routes
 *   - DAL functions (src/server/dal/*)
 *
 * NEVER import this in files marked "use client".
 */
const client = postgres(process.env.DATABASE_URL, {
  max: 1,
  idle_timeout: 20,
  connect_timeout: 10,
});

export const db = drizzle(client, { schema });
