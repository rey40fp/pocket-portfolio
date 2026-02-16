import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";

export const newsCache = pgTable("news_cache", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: text("title").notNull(),
  summary: text("summary"),
  source: text("source").notNull(),
  url: text("url").notNull().unique(),
  imageUrl: text("image_url"),
  relatedTickers: text("related_tickers").array(),
  category: text("category"),
  publishedAt: timestamp("published_at", { withTimezone: true }).notNull(),
  cachedAt: timestamp("cached_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
