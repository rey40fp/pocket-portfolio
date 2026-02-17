/**
 * Dev script to manually refresh all market prices.
 * Run with: npm run prices:refresh
 *
 * This calls the same service used by the cron job, but directly
 * from the command line — useful during development and testing.
 */

import "dotenv/config";

async function main() {
  // Dynamic imports so env vars are loaded first
  const { getAllTrackedTickers } = await import("@/server/dal/holdings");
  const { batchUpdatePriceCache } = await import("@/server/dal/prices");
  const { fetchBatchQuotes } = await import("@/server/services/market-data");

  console.log("🔄 Fetching tracked tickers...");
  const tickers = await getAllTrackedTickers();
  console.log(`📊 Found ${tickers.length} unique tickers`);

  if (tickers.length === 0) {
    console.log("✅ No tickers to refresh. Done.");
    process.exit(0);
  }

  console.log(
    "Tickers:",
    tickers.map((t) => `${t.ticker} (${t.assetType})`).join(", "),
  );

  console.log("\n🌐 Fetching prices from Finnhub...");
  const { quotes, failed, durationMs } = await fetchBatchQuotes(
    tickers.map((t) => ({ ticker: t.ticker, assetType: t.assetType })),
  );

  console.log(`\n✅ Got ${quotes.length} quotes in ${durationMs}ms`);

  if (failed.length > 0) {
    console.log(`⚠️  Failed tickers: ${failed.join(", ")}`);
  }

  if (quotes.length > 0) {
    console.log("\n💾 Updating price cache...");
    await batchUpdatePriceCache(
      quotes.map((q) => ({
        ticker: q.ticker,
        priceCents: q.priceCents,
        previousCloseCents: q.previousCloseCents,
        changeCents: q.changeCents,
        changePercent: q.changePercent,
        volume: q.volume,
      })),
    );

    console.log("\n📈 Price summary:");
    for (const q of quotes) {
      const price = (q.priceCents / 100).toFixed(2);
      const change = q.changeCents ? (q.changeCents / 100).toFixed(2) : "N/A";
      const pct = q.changePercent ?? "N/A";
      console.log(
        `  ${q.ticker.padEnd(10)} $${price.padStart(10)}  change: $${change}  (${pct}%)`,
      );
    }
  }

  console.log("\n✅ Done!");
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Script failed:", err);
  process.exit(1);
});
