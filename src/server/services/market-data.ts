// ─── Market Data Service ─────────────────────────────────────────────
// Multi-provider price fetcher:
//   • Finnhub (primary) — stocks, ETFs, crypto
//   • Yahoo Finance (fallback) — mutual funds, bonds, anything Finnhub misses
//
// Designed to be called from cron jobs and server actions — NEVER from
// client components or during user page loads.

const FINNHUB_BASE = "https://finnhub.io/api/v1";
const YAHOO_BASE = "https://query1.finance.yahoo.com/v8/finance/chart";

// ─── Types ───────────────────────────────────────────────────────────

export interface MarketQuote {
  ticker: string;
  priceCents: number;
  /** Raw dollar price for full precision (supports sub-cent meme coins). */
  priceDollars: number;
  previousCloseCents: number | null;
  changeCents: number | null;
  changePercent: string | null;
  volume: number | null;
}

interface FinnhubQuoteResponse {
  /** Current price */
  c: number;
  /** Change */
  d: number | null;
  /** Change percent */
  dp: number | null;
  /** High of the day */
  h: number;
  /** Low of the day */
  l: number;
  /** Open */
  o: number;
  /** Previous close */
  pc: number;
  /** Timestamp */
  t: number;
}

interface FinnhubCryptoCandle {
  /** Close prices */
  c: number[];
  /** High prices */
  h: number[];
  /** Low prices */
  l: number[];
  /** Open prices */
  o: number[];
  /** Volume */
  v: number[];
  /** Timestamps */
  t: number[];
  /** Status: "ok" | "no_data" */
  s: string;
}

// ─── Crypto Symbol Mapping ───────────────────────────────────────────
// Maps common crypto tickers to Finnhub's exchange-prefixed format.
// Finnhub crypto uses EXCHANGE:PAIR format for the /crypto/candle endpoint.

const CRYPTO_SYMBOL_MAP: Record<string, string> = {
  BTC: "BINANCE:BTCUSDT",
  ETH: "BINANCE:ETHUSDT",
  SOL: "BINANCE:SOLUSDT",
  ADA: "BINANCE:ADAUSDT",
  DOT: "BINANCE:DOTUSDT",
  AVAX: "BINANCE:AVAXUSDT",
  MATIC: "BINANCE:MATICUSDT",
  LINK: "BINANCE:LINKUSDT",
  UNI: "BINANCE:UNIUSDT",
  ATOM: "BINANCE:ATOMUSDT",
  XRP: "BINANCE:XRPUSDT",
  DOGE: "BINANCE:DOGEUSDT",
  SHIB: "BINANCE:SHIBUSDT",
  LTC: "BINANCE:LTCUSDT",
  BCH: "BINANCE:BCHUSDT",
  ALGO: "BINANCE:ALGOUSDT",
  XLM: "BINANCE:XLMUSDT",
  FIL: "BINANCE:FILUSDT",
  NEAR: "BINANCE:NEARUSDT",
  APT: "BINANCE:APTUSDT",
  ARB: "BINANCE:ARBUSDT",
  OP: "BINANCE:OPUSDT",
  SUI: "BINANCE:SUIUSDT",
  SEI: "BINANCE:SEIUSDT",
  TIA: "BINANCE:TIAUSDT",
  PEPE: "BINANCE:PEPEUSDT",
  WIF: "BINANCE:WIFUSDT",
  BONK: "BINANCE:BONKUSDT",
  RENDER: "BINANCE:RENDERUSDT",
  INJ: "BINANCE:INJUSDT",
};

/**
 * Convert a crypto ticker (e.g. "BTC", "ETH") to Yahoo Finance format
 * ("BTC-USD", "ETH-USD"). Yahoo uses {TICKER}-USD for crypto pairs.
 */
function resolveYahooCryptoSymbol(ticker: string): string {
  const upper = ticker.toUpperCase();
  // If it already has -USD suffix, use as-is
  if (upper.endsWith("-USD")) return upper;
  return `${upper}-USD`;
}

/**
 * Fetch a crypto price from Yahoo Finance as a fallback.
 * Uses the existing fetchYahooQuote with a {TICKER}-USD symbol,
 * but returns the result with the original ticker (without -USD).
 */
async function fetchCryptoViaYahoo(
  ticker: string,
): Promise<MarketQuote | null> {
  const yahooSymbol = resolveYahooCryptoSymbol(ticker);
  const quote = await fetchYahooQuote(yahooSymbol);
  if (quote) {
    // Return with the user's original ticker, not the Yahoo -USD variant
    return { ...quote, ticker: ticker.toUpperCase() };
  }
  return null;
}

// ─── Helpers ─────────────────────────────────────────────────────────

function getApiKey(): string {
  const key = process.env.FINNHUB_API_KEY;
  if (!key) throw new Error("FINNHUB_API_KEY is not configured");
  return key;
}

function dollarsToCents(dollars: number): number {
  return Math.round(dollars * 100);
}

/** Sleep for a given number of milliseconds. */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Resolve a crypto ticker to a Finnhub exchange-prefixed symbol.
 * Falls back to BINANCE:{ticker}USDT if not in the map.
 */
export function resolveCryptoSymbol(ticker: string): string {
  const upper = ticker.toUpperCase();
  return CRYPTO_SYMBOL_MAP[upper] ?? `BINANCE:${upper}USDT`;
}

// ─── Stock / ETF / Mutual Fund / Bond Quote ──────────────────────────

/**
 * Fetch a single stock-type quote from Finnhub.
 * Works for US stocks, ETFs, and most mutual funds.
 * Returns null if the API call fails or returns invalid data.
 */
export async function fetchStockQuote(
  ticker: string,
): Promise<MarketQuote | null> {
  const symbol = ticker.toUpperCase();

  try {
    const url = `${FINNHUB_BASE}/quote?symbol=${encodeURIComponent(symbol)}&token=${getApiKey()}`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      console.warn(
        `[market-data] Finnhub quote failed for ${symbol}: ${res.status} ${res.statusText}`,
      );
      return null;
    }

    const data: FinnhubQuoteResponse = await res.json();

    // Finnhub returns c=0 when it can't find the symbol
    if (!data.c || data.c === 0) {
      console.warn(`[market-data] No price data for ${symbol} (c=0)`);
      return null;
    }

    return {
      ticker: symbol,
      priceCents: dollarsToCents(data.c),
      priceDollars: data.c,
      previousCloseCents: data.pc ? dollarsToCents(data.pc) : null,
      changeCents: data.d != null ? dollarsToCents(data.d) : null,
      changePercent: data.dp != null ? data.dp.toFixed(4) : null,
      volume: null, // Quote endpoint doesn't return volume
    };
  } catch (error) {
    console.warn(`[market-data] Failed to fetch quote for ${symbol}:`, error);
    return null;
  }
}

// ─── Crypto Quote ────────────────────────────────────────────────────

/**
 * Fetch a crypto price from Finnhub using the /crypto/candle endpoint.
 * Retrieves the most recent daily candle to get the current price.
 * Returns null if the API call fails or returns no data.
 */
export async function fetchCryptoQuote(
  ticker: string,
): Promise<MarketQuote | null> {
  const upper = ticker.toUpperCase();
  const symbol = resolveCryptoSymbol(upper);

  try {
    const now = Math.floor(Date.now() / 1000);
    const oneDayAgo = now - 86_400;

    const url =
      `${FINNHUB_BASE}/crypto/candle` +
      `?symbol=${encodeURIComponent(symbol)}` +
      `&resolution=D` +
      `&from=${oneDayAgo}` +
      `&to=${now}` +
      `&token=${getApiKey()}`;

    const res = await fetch(url, {
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      console.warn(
        `[market-data] Finnhub crypto candle failed for ${upper} (${symbol}): ${res.status}`,
      );
      return null;
    }

    const data: FinnhubCryptoCandle = await res.json();

    if (data.s !== "ok" || !data.c?.length) {
      console.warn(
        `[market-data] No crypto data for ${upper} (${symbol}): status=${data.s}`,
      );
      return null;
    }

    // Use the last candle close price as the current price
    const lastIdx = data.c.length - 1;
    const currentPrice = data.c[lastIdx];
    const openPrice = data.o[0]; // First candle open = ~previous close
    const change = currentPrice - openPrice;
    const changePercent = openPrice !== 0 ? (change / openPrice) * 100 : 0;

    return {
      ticker: upper,
      priceCents: dollarsToCents(currentPrice),
      priceDollars: currentPrice,
      previousCloseCents: dollarsToCents(openPrice),
      changeCents: dollarsToCents(change),
      changePercent: changePercent.toFixed(4),
      volume: data.v?.[lastIdx] ? Math.round(data.v[lastIdx]) : null,
    };
  } catch (error) {
    console.warn(`[market-data] Failed to fetch crypto for ${upper}:`, error);
    return null;
  }
}

// ─── Yahoo Finance Fallback ──────────────────────────────────────────
// Used for mutual funds, bonds, and any tickers that Finnhub can't handle.
// No API key required. Returns the latest closing price.

interface YahooChartResponse {
  chart: {
    result: Array<{
      meta: {
        regularMarketPrice: number;
        previousClose: number;
        currency: string;
        symbol: string;
      };
      indicators: {
        quote: Array<{
          close: (number | null)[];
          volume: (number | null)[];
        }>;
      };
    }> | null;
    error: { code: string; description: string } | null;
  };
}

/**
 * Fetch a quote from Yahoo Finance's chart API.
 * Works for stocks, ETFs, mutual funds, bonds — virtually anything
 * with a Yahoo Finance listing. No API key required.
 */
export async function fetchYahooQuote(
  ticker: string,
): Promise<MarketQuote | null> {
  const symbol = ticker.toUpperCase();

  try {
    const url =
      `${YAHOO_BASE}/${encodeURIComponent(symbol)}` +
      `?range=2d&interval=1d&includePrePost=false`;

    const res = await fetch(url, {
      signal: AbortSignal.timeout(10_000),
      headers: {
        "User-Agent": "Mozilla/5.0",
      },
    });

    if (!res.ok) {
      console.warn(
        `[market-data] Yahoo quote failed for ${symbol}: ${res.status} ${res.statusText}`,
      );
      return null;
    }

    const data: YahooChartResponse = await res.json();

    if (data.chart.error || !data.chart.result?.length) {
      console.warn(
        `[market-data] Yahoo returned no data for ${symbol}:`,
        data.chart.error?.description ?? "no results",
      );
      return null;
    }

    const meta = data.chart.result[0].meta;
    const price = meta.regularMarketPrice;
    const prevClose = meta.previousClose;

    if (!price || price === 0) {
      console.warn(`[market-data] Yahoo price is 0 for ${symbol}`);
      return null;
    }

    const change = prevClose ? price - prevClose : null;
    const changePercent =
      prevClose && prevClose !== 0 ? ((price - prevClose) / prevClose) * 100 : null;

    return {
      ticker: symbol,
      priceCents: dollarsToCents(price),
      priceDollars: price,
      previousCloseCents: prevClose ? dollarsToCents(prevClose) : null,
      changeCents: change != null ? dollarsToCents(change) : null,
      changePercent: changePercent != null ? changePercent.toFixed(4) : null,
      volume: null,
    };
  } catch (error) {
    console.warn(`[market-data] Yahoo fetch failed for ${symbol}:`, error);
    return null;
  }
}

// ─── Asset types that don't need market price refreshes ──────────────
// Cash, real_estate, and "other" are manually valued — skip them entirely.

const SKIP_ASSET_TYPES = new Set(["cash", "real_estate", "other"]);

// ─── Money market / settlement fund tickers ──────────────────────────
// These trade at ~$1/share and don't need price refreshes. Users should
// reclassify them as "cash" type, but we skip them defensively regardless.

const MONEY_MARKET_TICKERS = new Set([
  "SPAXX", "FDRXX", "SPRXX", "FZFXX", "VMFXX", "VMMXX",
  "SWVXX", "SNVXX", "SNSXX", "FTEXX", "FCASH", "CORE",
  "FMPXX", "FRGXX", "FDLXX",
]);

// ─── Asset types that Finnhub doesn't handle well ────────────────────
// These go directly to Yahoo Finance instead of trying Finnhub first.

const YAHOO_FIRST_ASSET_TYPES = new Set(["mutual_fund", "bond"]);

// ─── Unified Quote ───────────────────────────────────────────────────

/**
 * Check whether a ticker/assetType combination should be skipped
 * during price refreshes (cash, real estate, money market funds, etc.).
 */
export function shouldSkipPriceRefresh(
  ticker: string,
  assetType: string,
): boolean {
  if (SKIP_ASSET_TYPES.has(assetType)) return true;
  if (MONEY_MARKET_TICKERS.has(ticker.toUpperCase())) return true;
  return false;
}

/**
 * Fetch a quote for any asset type, with automatic provider routing:
 *   • Cash / real_estate / other / money market → skipped (returns null)
 *   • Crypto → Finnhub /crypto/candle
 *   • Mutual funds & bonds → Yahoo Finance (Finnhub returns 0 for these)
 *   • Stocks & ETFs → Finnhub /quote, with Yahoo Finance fallback
 */
export async function fetchQuote(
  ticker: string,
  assetType: string,
): Promise<MarketQuote | null> {
  // Skip assets that don't have meaningful market prices
  if (shouldSkipPriceRefresh(ticker, assetType)) {
    console.log(
      `[market-data] Skipping ${ticker} (${assetType}) — no market price needed`,
    );
    return null;
  }

  // Crypto: try Finnhub candle first, fall back to Yahoo Finance ({TICKER}-USD)
  if (assetType === "crypto") {
    const quote = await fetchCryptoQuote(ticker);
    if (quote) return quote;

    console.log(
      `[market-data] Finnhub crypto failed for ${ticker}, trying Yahoo Finance...`,
    );
    return fetchCryptoViaYahoo(ticker);
  }

  // Mutual funds & bonds: go straight to Yahoo (Finnhub can't price these)
  if (YAHOO_FIRST_ASSET_TYPES.has(assetType)) {
    const quote = await fetchYahooQuote(ticker);
    if (quote) return quote;
    // Last resort: try Finnhub anyway in case Yahoo is down
    return fetchStockQuote(ticker);
  }

  // Stocks & ETFs: try Finnhub first, fall back to Yahoo
  const quote = await fetchStockQuote(ticker);
  if (quote) return quote;

  console.log(
    `[market-data] Finnhub failed for ${ticker}, trying Yahoo Finance...`,
  );
  return fetchYahooQuote(ticker);
}

// ─── Batch Fetch ─────────────────────────────────────────────────────

export interface TickerWithType {
  ticker: string;
  assetType: string;
}

export interface BatchQuoteResult {
  quotes: MarketQuote[];
  failed: string[];
  skipped: string[];
  durationMs: number;
}

/**
 * Fetch quotes for multiple tickers with rate-limit-aware pacing.
 *
 * Pre-filters out cash, real_estate, other, and money market tickers.
 *
 * Provider routing per ticker:
 *   • mutual_fund / bond → Yahoo Finance (no Finnhub rate cost)
 *   • crypto → Finnhub /crypto/candle
 *   • stock / etf → Finnhub /quote → Yahoo fallback if Finnhub returns 0
 *
 * Finnhub free tier: 60 calls/minute.
 * We pace at ~50ms between calls and add a longer pause every 55 calls.
 */
export async function fetchBatchQuotes(
  tickers: TickerWithType[],
): Promise<BatchQuoteResult> {
  const start = Date.now();
  const quotes: MarketQuote[] = [];
  const failed: string[] = [];
  const skipped: string[] = [];

  // Pre-filter: separate tickers that need fetching from those that don't
  const toFetch: TickerWithType[] = [];
  for (const t of tickers) {
    if (shouldSkipPriceRefresh(t.ticker, t.assetType)) {
      skipped.push(t.ticker);
    } else {
      toFetch.push(t);
    }
  }

  if (skipped.length > 0) {
    console.log(
      `[market-data] Skipping ${skipped.length} tickers (cash/money market): ${skipped.join(", ")}`,
    );
  }

  const BATCH_SIZE = 55;
  const DELAY_BETWEEN_CALLS_MS = 50;
  const BATCH_PAUSE_MS = 5_000;

  for (let i = 0; i < toFetch.length; i++) {
    // Rate limit pause every BATCH_SIZE calls
    if (i > 0 && i % BATCH_SIZE === 0) {
      console.log(
        `[market-data] Pausing for rate limit after ${i} calls...`,
      );
      await sleep(BATCH_PAUSE_MS);
    }

    const { ticker, assetType } = toFetch[i];
    const quote = await fetchQuote(ticker, assetType);

    if (quote) {
      quotes.push(quote);
    } else {
      failed.push(ticker);
    }

    // Small delay between each call
    if (i < toFetch.length - 1) {
      await sleep(DELAY_BETWEEN_CALLS_MS);
    }
  }

  return {
    quotes,
    failed,
    skipped,
    durationMs: Date.now() - start,
  };
}
