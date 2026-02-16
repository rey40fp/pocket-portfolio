import { pgTable, text, timestamp, pgEnum } from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("user_role", [
  "user",
  "admin",
  "wealth_manager",
  "analyst",
]);

export const users = pgTable("users", {
  id: text("id").primaryKey(), // Clerk user ID (e.g., "user_2abc...")
  email: text("email").notNull().unique(),
  displayName: text("display_name"),
  role: userRoleEnum("role").notNull().default("user"),
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
