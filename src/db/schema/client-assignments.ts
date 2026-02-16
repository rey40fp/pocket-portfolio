import { pgTable, uuid, text, timestamp, unique } from "drizzle-orm/pg-core";
import { users } from "./users";

export const clientAssignments = pgTable(
  "client_assignments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    wealthManagerId: text("wealth_manager_id")
      .notNull()
      .references(() => users.id),
    clientId: text("client_id")
      .notNull()
      .references(() => users.id),
    assignedAt: timestamp("assigned_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [unique().on(table.wealthManagerId, table.clientId)],
);
