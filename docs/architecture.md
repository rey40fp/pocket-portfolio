# Architecture — Pocket Portfolio

## System Overview

```
┌─────────────────────────────────────────────────────────┐
│                     CLIENT (Browser)                     │
│  Next.js App Router (React Server Components + Client)   │
│  shadcn/ui + Tremor + Tailwind CSS                       │
│  Zustand (client state) + TanStack Query (cache)         │
└──────────────┬──────────────────────┬────────────────────┘
               │ Server Actions       │ API Routes
               │ (mutations)          │ (market data proxy)
┌──────────────▼──────────────────────▼────────────────────┐
│                    NEXT.JS SERVER                         │
│  Middleware (Clerk auth + rate limiting)                  │
│  Server Actions → Zod validation → DAL                   │
│  API Routes → Zod validation → DAL / External APIs       │
│  Data Access Layer (src/server/dal/) ← single DB gateway │
└──────────────┬──────────────────────┬────────────────────┘
               │ Drizzle ORM          │ REST/SDK
┌──────────────▼────────┐  ┌──────────▼───────────────────┐
│   SUPABASE (PostgreSQL)│  │      EXTERNAL SERVICES        │
│   - RLS enforced       │  │  Clerk (auth, MFA, roles)     │
│   - All tables         │  │  Finnhub (stock + crypto)     │
│   - audit_logs         │  │  Upstash Redis (rate limits)  │
│   - price_cache  ◄─────│──│  Vercel Cron (*/15 * * * *)   │
│   - news_cache         │  │                               │
└────────────────────────┘  └───────────────────────────────┘
```

## Key Architectural Decisions

### 1. Data Access Layer (DAL) Pattern
All database queries are centralized in `src/server/dal/`. This is the ONLY code that imports the Supabase client or Drizzle ORM. Benefits:
- Single point for authorization checks
- Audit logging applied consistently
- Easy to add caching layer later
- Clear boundary for testing (mock the DAL, not the database)

### 2. Server Components by Default
Pages fetch data server-side via the DAL. No loading spinners for initial page load. Client Components are used ONLY for interactivity (forms, dropdowns, charts with hover states). This means:
- Faster initial load (HTML streamed from server)
- No client-side data fetching waterfalls
- API keys never reach the browser
- SEO-friendly (though less critical for an authenticated app)

### 3. Money as Integer Cents
All monetary values are stored as integers representing cents (BIGINT in PostgreSQL, number in TypeScript). This prevents floating-point rounding errors that compound across calculations. The conversion to display format ("$1,234.56") happens exclusively in the `formatCurrency()` utility in the UI layer.

### 4. Background Price Caching (Phase 1H.a)
Market prices are NEVER fetched in real-time during user page loads. Instead:

**Providers:**
- **Finnhub** (free tier — 60 API calls/minute): Stocks, ETFs, Crypto
  - Stocks / ETFs → `GET /quote?symbol=AAPL`
  - Crypto → `GET /crypto/candle?symbol=BINANCE:BTCUSDT&resolution=D`
- **Yahoo Finance** (no API key, fallback): Mutual Funds, Bonds, anything Finnhub misses
  - `GET /v8/finance/chart/FXAIX?range=2d&interval=1d`
  - Used as primary for mutual_fund/bond; as fallback for stocks/ETFs that return 0 from Finnhub

**Cron Pipeline:**
```
Vercel Cron (*/15 * * * *)
  → GET /api/cron/refresh-prices (secured by CRON_SECRET)
    → DAL: getAllTrackedTickers()  (DISTINCT tickers from holdings)
    → Service: fetchBatchQuotes()  (paced at 50ms/call, pauses every 55)
    → DAL: batchUpdatePriceCache() (upsert into price_cache)
```

**Manual Refresh:**
- Users can click a "Refresh" button (rate-limited: 1x per 5 min per user)
- Server Action `refreshPrices()` fetches only that user's tickers
- After refresh, `revalidatePath()` updates Dashboard, Holdings, Accounts

**Staleness Indicator:**
- Dashboard and Holdings pages show "Prices updated X min ago"
- Color-coded: green (<20 min), yellow (20-60 min), orange (>60 min)

**Rate Limit Safety:**
- 50ms delay between individual API calls
- 5s pause every 55 calls (to never exceed 60/min window)
- Failed tickers logged but never block other refreshes

**Upgrade Path (Phase 2):**
- Finnhub WebSocket for true real-time streaming (paid tier)
- Polygon.io as a redundant secondary provider
- Upstash Redis for distributed rate limiting across instances

This prevents: API rate limit exhaustion, slow page loads, external API outages affecting user experience, and unnecessary costs.

### 5. Future-Proof for Plaid Integration
The `holdings` table has a `source` column: "manual", "plaid", or "csv_import". The `lots` table stores individual purchase lots. When Plaid is added, imported transactions create lots with `source: "plaid"` and users can still manually add lots alongside imported ones. No schema changes needed.

### 6. Future-Proof for Mobile (React Native)
By using React for the web frontend:
- Custom hooks (usePortfolio, useHoldings) transfer directly to React Native
- Zustand stores work identically in React Native
- Business logic (calculations, formatters) is plain TypeScript — no DOM dependency
- Only the UI components need to be rebuilt with React Native equivalents
- The Server Actions/API routes remain the same backend

---

## Data Flow Examples

### User Adds a New Holding
```
1. User fills form in <AddHoldingForm> (Client Component)
2. Form submits via Server Action: addHolding()
3. Server Action:
   a. auth() → verify Clerk session
   b. Zod schema → validate input
   c. DAL.createHolding() → INSERT into holdings + lots tables
   d. DAL.logAuditEvent() → INSERT into audit_logs
   e. revalidatePath() → invalidate cached dashboard data
4. Client receives success → toast notification → redirect to holdings list
```

### Dashboard Loads Net Worth
```
1. Dashboard page (Server Component) calls DAL.getPortfolioSummary(userId)
2. DAL queries:
   a. All active holdings for user (JOIN accounts WHERE deleted_at IS NULL)
   b. Latest prices from price_cache for all tickers
   c. Compute: market_value = shares × cached_price for each holding
   d. Sum all market_values + manual asset values = total net worth
3. Server renders KPI cards and chart with computed data
4. Client hydrates interactive elements (period selector, tooltips)
```

### Price Refresh (Cron)
```
1. Vercel Cron triggers GET /api/cron/refresh-prices every 15 min
2. Route handler verifies CRON_SECRET from Authorization header
3. getAllTrackedTickers() → SELECT DISTINCT ticker, asset_type
   FROM holdings WHERE ticker IS NOT NULL AND deleted_at IS NULL
4. Tickers grouped: stocks vs crypto
5. fetchBatchQuotes() iterates all tickers:
   a. Mutual funds / bonds → Yahoo Finance (Finnhub returns 0 for these)
   b. Stocks / ETFs → Finnhub /quote → Yahoo Finance fallback if 0
   c. Crypto → Finnhub /crypto/candle (resolution=D) → last close
   d. 50ms delay between calls, 5s pause every 55 calls
   e. Failed tickers → null (logged, not thrown)
6. batchUpdatePriceCache() → UPSERT into price_cache for each quote
7. Response: { refreshed: 42, failed: ["BADTKR"], durationMs: 3200 }
```

### Price Refresh (Manual / User-Triggered)
```
1. User clicks "Refresh" button on Dashboard or Holdings page
2. Client Component calls Server Action: refreshPrices()
3. Server Action:
   a. auth() → verify Clerk session
   b. In-memory rate limit check (5 min cooldown per user)
   c. getUserTrackedTickers(userId) → only that user's tickers
   d. fetchBatchQuotes() → Finnhub API calls
   e. batchUpdatePriceCache() → upsert results
   f. revalidatePath("/dashboard", "/holdings", "/accounts")
4. Client receives result → shows "42 updated" or cooldown timer
```

### Cross-Custodian Grouping
```
1. User toggles "Group by Ticker" view
2. Server Action: getGroupedHoldings(userId)
3. DAL queries all holdings WHERE ticker IS NOT NULL, grouped by ticker
4. For each ticker group:
   a. Sum total shares across all accounts
   b. Weighted avg cost = SUM(lot.cost_basis_cents) / SUM(lot.shares)
   c. Current value = total_shares × price_cache[ticker].price_cents
   d. Total gain = current_value − SUM(lot.cost_basis_cents)
5. Return sorted array to client table component
```

---

## Deployment Architecture

### Production (Vercel)
- Next.js app deployed to Vercel (auto-scaling serverless)
- Environment variables configured in Vercel dashboard
- Vercel Cron for scheduled jobs (price update, news update)
- Automatic preview deployments on PRs

### Database (Supabase)
- Production Supabase project (paid plan for connection pooling)
- Staging Supabase project for testing migrations
- Connection via Supabase connection pooler (pgBouncer) for serverless compatibility
- Direct connection for migrations only

### Monitoring (Phase 2)
- Vercel Analytics for web vitals
- Sentry for error tracking
- Supabase Dashboard for database metrics
- Upstash Dashboard for rate limiting metrics
