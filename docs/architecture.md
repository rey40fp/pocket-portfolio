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
│   - All tables         │  │  Finnhub/Twelve Data (prices) │
│   - audit_logs         │  │  Upstash Redis (rate limits)  │
│   - price_cache        │  │  Vercel Cron (scheduled jobs) │
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

### 4. Background Price Caching
Market prices are NEVER fetched in real-time during user requests. A background cron job:
1. Runs every 15 minutes during US market hours (9:30 AM – 4:00 PM ET, weekdays)
2. Fetches prices for all unique tickers across all users' holdings
3. Updates the `price_cache` table
4. Dashboard reads from `price_cache` only

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
