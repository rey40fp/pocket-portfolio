import {
  pgTable,
  uuid,
  text,
  bigint,
  numeric,
  timestamp,
} from "drizzle-orm/pg-core";
import { users } from "./users";
import { holdings } from "./holdings";
import { lots } from "./lots";

export const realizedTransactions = pgTable("realized_transactions", {
  id: uuid("id").defaultRandom().primaryKey(),
  lotId: uuid("lot_id")
    .notNull()
    .references(() => lots.id),
  holdingId: uuid("holding_id")
    .notNull()
    .references(() => holdings.id),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  sharesSold: numeric("shares_sold", { precision: 18, scale: 8 }).notNull(),
  sellPriceCents: bigint("sell_price_cents", { mode: "number" }).notNull(),
  totalProceedsCents: bigint("total_proceeds_cents", {
    mode: "number",
  }).notNull(),
  costBasisCents: bigint("cost_basis_cents", { mode: "number" }).notNull(),
  feesCents: bigint("fees_cents", { mode: "number" }).notNull().default(0),
  realizedGainCents: bigint("realized_gain_cents", {
    mode: "number",
  }).notNull(),
  soldAt: timestamp("sold_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
