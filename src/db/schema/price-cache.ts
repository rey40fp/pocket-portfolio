import {
  pgTable,
  text,
  bigint,
  numeric,
  timestamp,
} from "drizzle-orm/pg-core";

export const priceCache = pgTable("price_cache", {
  ticker: text("ticker").primaryKey(),
  priceCents: bigint("price_cents", { mode: "number" }).notNull(),
  previousCloseCents: bigint("previous_close_cents", { mode: "number" }),
  changeCents: bigint("change_cents", { mode: "number" }),
  changePercent: numeric("change_percent", { precision: 8, scale: 4 }),
  volume: bigint("volume", { mode: "number" }),
  marketCapCents: bigint("market_cap_cents", { mode: "number" }),
  name: text("name"),
  sector: text("sector"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
