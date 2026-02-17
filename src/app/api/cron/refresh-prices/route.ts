import { NextRequest, NextResponse } from "next/server";
import { getAllTrackedTickers } from "@/server/dal/holdings";
import {
  batchUpdatePriceCache,
  getManualOverrideTickers,
} from "@/server/dal/prices";
import {
  fetchBatchQuotes,
  type TickerWithType,
} from "@/server/services/market-data";

// ─── Auth ────────────────────────────────────────────────────────────

function isAuthorized(request: NextRequest): boolean {
  // Vercel Cron sends the secret as a Bearer token in the Authorization header
  const authHeader = request.headers.get("authorization");
  if (authHeader) {
    const token = authHeader.replace("Bearer ", "");
    if (token === process.env.CRON_SECRET) return true;
  }

  // Also check x-cron-secret for manual/dev invocations
  const cronSecret = request.headers.get("x-cron-secret");
  if (cronSecret === process.env.CRON_SECRET) return true;

  return false;
}

// ─── Handler ─────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // 1. Collect all unique tickers from all users' active holdings
    const trackedTickers = await getAllTrackedTickers();

    if (trackedTickers.length === 0) {
      return NextResponse.json({
        message: "No tickers to refresh",
        refreshed: 0,
        failed: [],
        durationMs: 0,
      });
    }

    // 1b. Exclude tickers with manual price overrides
    const manualOverrides = await getManualOverrideTickers();
    const filteredTickers = trackedTickers.filter(
      (t) => !manualOverrides.has(t.ticker),
    );

    if (manualOverrides.size > 0) {
      console.log(
        `[refresh-prices] Skipping ${manualOverrides.size} manually-overridden tickers: ${[...manualOverrides].join(", ")}`,
      );
    }

    console.log(
      `[refresh-prices] Refreshing ${filteredTickers.length} tickers (${trackedTickers.length} total, ${manualOverrides.size} manual overrides)...`,
    );

    // 2. Fetch quotes from providers
    const tickersWithType: TickerWithType[] = filteredTickers.map((t) => ({
      ticker: t.ticker,
      assetType: t.assetType,
    }));

    const { quotes, failed, skipped, durationMs } =
      await fetchBatchQuotes(tickersWithType);

    // 3. Upsert into price_cache
    if (quotes.length > 0) {
      await batchUpdatePriceCache(
        quotes.map((q) => ({
          ticker: q.ticker,
          priceCents: q.priceCents,
          priceDollars: q.priceDollars,
          previousCloseCents: q.previousCloseCents,
          changeCents: q.changeCents,
          changePercent: q.changePercent,
          volume: q.volume,
        })),
      );
    }

    const summary = {
      message: "Price refresh complete",
      total: trackedTickers.length,
      refreshed: quotes.length,
      skipped: skipped.length,
      manualOverrides: manualOverrides.size,
      failed,
      durationMs,
    };

    console.log(`[refresh-prices] Done:`, summary);

    return NextResponse.json(summary);
  } catch (error) {
    console.error("[refresh-prices] Cron job failed:", error);
    return NextResponse.json(
      {
        error: "Price refresh failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
