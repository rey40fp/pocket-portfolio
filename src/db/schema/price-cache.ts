import {
  pgTable,
  text,
  bigint,
  boolean,
  doublePrecision,
  numeric,
  timestamp,
} from "drizzle-orm/pg-core";

export const priceCache = pgTable("price_cache", {
  ticker: text("ticker").primaryKey(),
  priceCents: bigint("price_cents", { mode: "number" }).notNull(),
  /** Raw dollar price with full floating-point precision.
   *  Supports sub-cent prices like meme coins ($0.00002847).
   *  When available, this is preferred over priceCents for calculations. */
  priceDollars: doublePrecision("price_dollars"),
  previousCloseCents: bigint("previous_close_cents", { mode: "number" }),
  changeCents: bigint("change_cents", { mode: "number" }),
  changePercent: numeric("change_percent", { precision: 8, scale: 4 }),
  volume: bigint("volume", { mode: "number" }),
  marketCapCents: bigint("market_cap_cents", { mode: "number" }),
  name: text("name"),
  sector: text("sector"),
  /** When true, the price was set manually by the user and should NOT be
   *  overwritten by the automated price refresh pipeline. */
  isManualOverride: boolean("is_manual_override").default(false).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
