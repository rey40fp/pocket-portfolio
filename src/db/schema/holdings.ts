import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  pgEnum,
} from "drizzle-orm/pg-core";
import { users } from "./users";
import { accounts } from "./accounts";

export const assetTypeEnum = pgEnum("asset_type", [
  "stock",
  "etf",
  "mutual_fund",
  "bond",
  "crypto",
  "real_estate",
  "cash",
  "other",
]);

export const holdingSourceEnum = pgEnum("holding_source", [
  "manual",
  "plaid",
  "csv_import",
]);

export const holdings = pgTable("holdings", {
  id: uuid("id").defaultRandom().primaryKey(),
  accountId: uuid("account_id")
    .notNull()
    .references(() => accounts.id),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  ticker: text("ticker"),
  name: text("name").notNull(),
  assetType: assetTypeEnum("asset_type").notNull(),
  assetCategory: text("asset_category"),
  sector: text("sector"),
  isLiquidated: boolean("is_liquidated").notNull().default(false),
  liquidatedAt: timestamp("liquidated_at", { withTimezone: true }),
  notes: text("notes"),
  source: holdingSourceEnum("holding_source").notNull().default("manual"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});
