import {
  pgTable,
  uuid,
  text,
  bigint,
  integer,
  numeric,
  boolean,
  timestamp,
} from "drizzle-orm/pg-core";
import { users } from "./users";
import { holdings } from "./holdings";

export const lots = pgTable("lots", {
  id: uuid("id").defaultRandom().primaryKey(),
  holdingId: uuid("holding_id")
    .notNull()
    .references(() => holdings.id),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  shares: numeric("shares", { precision: 18, scale: 8 }),
  costBasisCents: bigint("cost_basis_cents", { mode: "number" }).notNull(),
  costPerShareCents: bigint("cost_per_share_cents", { mode: "number" }),
  acquiredAt: timestamp("acquired_at", { withTimezone: true }),
  currentValueCents: bigint("current_value_cents", { mode: "number" }),
  mortgageMonthlyCents: bigint("mortgage_monthly_cents", { mode: "number" }),
  escrowMonthlyCents: bigint("escrow_monthly_cents", { mode: "number" }),
  interestRateBps: integer("interest_rate_bps"),
  isLiquidated: boolean("is_liquidated").notNull().default(false),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
