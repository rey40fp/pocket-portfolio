import {
  pgTable,
  uuid,
  text,
  boolean,
  jsonb,
  inet,
  timestamp,
  pgEnum,
} from "drizzle-orm/pg-core";

export const auditActionEnum = pgEnum("audit_action", [
  "CREATE",
  "UPDATE",
  "DELETE",
  "LOGIN",
  "EXPORT",
  "ROLE_CHANGE",
]);

export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  actorId: text("actor_id").notNull(),
  action: auditActionEnum("action").notNull(),
  resourceType: text("resource_type").notNull(),
  resourceId: uuid("resource_id"),
  metadata: jsonb("metadata").default({}),
  ipAddress: inet("ip_address"),
  success: boolean("success").default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
