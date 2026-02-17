# Pocket Portfolio — Implementation Tasks

> **Instructions for AI Agent:** Work through tasks sequentially. Check off each `[ ]` as you complete it. Do not skip ahead. Each task should be tested before moving to the next. Start each new session by reading this file to find where you left off.

---

## Phase 1A: Project Scaffolding & Configuration

- [x] **1A.1** Initialize Next.js 15 project with TypeScript, Tailwind CSS v4, App Router, src/ directory
- [x] **1A.2** Install and configure shadcn/ui (init with green theme CSS variables from SPEC.md Section 7)
- [x] **1A.3** Install Tremor for dashboard components
- [x] **1A.4** Configure path aliases (`@/` → `src/`), ESLint, Prettier
- [x] **1A.5** Set up project directory structure matching the structure in `.cursor/rules/general.mdc`
- [x] **1A.6** Create `lib/utils.ts` with `cn()` helper and `formatCurrency()` (converts integer cents to formatted string)
- [x] **1A.7** Create `lib/constants.ts` with enums for asset types, account types, custodians, user roles
- [x] **1A.8** Install and configure Vitest for unit testing with a sample test that passes

## Phase 1B: Authentication & Authorization

- [x] **1B.1** Install Clerk, configure environment variables, create Clerk middleware for protected routes
- [x] **1B.2** Create sign-in and sign-up pages at `(auth)/sign-in` and `(auth)/sign-up` using Clerk components, styled to match green theme
- [x] **1B.3** Create authenticated layout at `(dashboard)/layout.tsx` with Clerk `UserButton` in header
- [x] **1B.4** Configure Clerk roles: user, admin, wealth_manager, analyst. Create `requireRole()` helper in `server/dal/auth.ts`
- [x] **1B.5** Create middleware that redirects unauthenticated users to sign-in and authenticated users away from auth pages

## Phase 1C: Database Schema & Setup

- [x] **1C.1** Set up Supabase project, install Drizzle ORM, configure connection (server-side only)
- [x] **1C.2** Create Drizzle schema: `users` table (synced from Clerk: id, email, display_name, role, created_at, updated_at)
- [x] **1C.3** Create Drizzle schema: `households` table and `household_members` junction table (see docs/database.md)
- [x] **1C.4** Create Drizzle schema: `portfolios` table (user_id, name, description, is_default, timestamps)
- [x] **1C.5** Create Drizzle schema: `accounts` table (portfolio_id, user_id, name, custodian, account_type, notes, timestamps, deleted_at)
- [x] **1C.6** Create Drizzle schema: `holdings` table with full field set per SPEC.md Section 3.4
- [x] **1C.7** Create Drizzle schema: `lots` table (holding_id, shares, cost_basis_cents, acquired_at, timestamps)
- [x] **1C.8** Create Drizzle schema: `realized_transactions` table (lot_id, holding_id, shares_sold, sell_price_cents, fees_cents, realized_gain_cents, sold_at, timestamps)
- [x] **1C.9** Create Drizzle schema: `price_cache` table (ticker, price_cents, previous_close_cents, change_percent, volume, updated_at)
- [x] **1C.10** Create Drizzle schema: `news_cache` table (title, summary, source, url, image_url, related_tickers, published_at, cached_at)
- [x] **1C.11** Create Drizzle schema: `audit_logs` table (see database.mdc rules)
- [x] **1C.12** Create Drizzle schema: `client_assignments` table (wealth_manager_id, client_id, assigned_at)
- [x] **1C.13** Push all schemas to Supabase with `drizzle-kit push`
- [x] **1C.14** Write and enable RLS policies for ALL tables (follow patterns in database.mdc rules)
- [x] **1C.15** Create indexes on user_id, account_id, ticker, and all FK columns
- [x] **1C.16** Create seed script (`db/seed.ts`) with sample data: 2 users, 3 accounts each, 10-15 holdings across asset types, some realized transactions

## Phase 1D: Core Data Access Layer

- [x] **1D.1** Create DAL: `server/dal/users.ts` — syncUserFromClerk, getUserById, getUserRole
- [x] **1D.2** Create DAL: `server/dal/portfolios.ts` — getPortfolios, createPortfolio, updatePortfolio, deletePortfolio
- [x] **1D.3** Create DAL: `server/dal/accounts.ts` — getAccounts, getAccountById, createAccount, updateAccount, softDeleteAccount
- [x] **1D.4** Create DAL: `server/dal/holdings.ts` — getHoldings, getHoldingById, getHoldingsByTicker (cross-custodian), createHolding, updateHolding
- [x] **1D.5** Create DAL: `server/dal/lots.ts` — getLotsByHolding, addLot, updateLot
- [x] **1D.6** Create DAL: `server/dal/transactions.ts` — liquidatePosition (creates realized_transaction, marks lot liquidated), getRealizedTransactions, getCashedOutTotal
- [x] **1D.7** Create DAL: `server/dal/prices.ts` — getCachedPrice, batchGetPrices, updatePriceCache
- [x] **1D.8** Create DAL: `server/dal/audit.ts` — logAuditEvent (used by all other DAL functions on mutations)
- [x] **1D.9** Create Zod validators: `server/validators/` — one file per entity (accounts.ts, holdings.ts, lots.ts, transactions.ts)

## Phase 1E: Server Actions

- [x] **1E.1** Create Server Actions: `server/actions/accounts.ts` — createAccount, updateAccount, deleteAccount
- [x] **1E.2** Create Server Actions: `server/actions/holdings.ts` — addHolding, updateHolding, addLotToHolding, importHoldingsFromCSV
- [x] **1E.3** Create Server Actions: `server/actions/transactions.ts` — liquidatePosition, undoLiquidation
- [x] **1E.4** Create Server Actions: `server/actions/households.ts` — createHousehold, inviteMember, removeMember, acceptInvitation
- [x] **1E.5** Create Server Actions: `server/actions/portfolios.ts` — createPortfolio, updatePortfolio, deletePortfolio

## Phase 1F: Dashboard UI

- [x] **1F.1** Create sidebar navigation component: logo, nav links (Dashboard, Accounts, Holdings, Analytics, News, Household, Settings), collapse on mobile
- [x] **1F.2** Create dashboard layout with sidebar + header (UserButton, household selector dropdown) + main content area
- [x] **1F.3** Build Dashboard home page: Net Worth KPI card, Day Change KPI card, Total Gain/Loss KPI card (use Tremor KPI components)
- [x] **1F.4** Build Net Worth History area chart (Tremor AreaChart, green gradient, period selector: 1W/1M/3M/6M/1Y/ALL)
- [x] **1F.5** Build Asset Allocation donut chart (Tremor DonutChart, by asset class)
- [x] **1F.6** Build Top Movers section (top 3 gainers, top 3 losers from user's holdings)
- [x] **1F.7** Build Recent Activity feed (last 10 actions from audit_logs)
- [x] **1F.8** Add loading.tsx skeletons and error.tsx for dashboard route
- [x] **1F.9** Add empty state for new users with no holdings (welcome message + "Add your first account" CTA)

## Phase 1G: Accounts UI

- [x] **1G.1** Build Accounts list page: cards showing each account (name, custodian, total value, number of holdings)
- [x] **1G.2** Build Add Account dialog/modal: form with fields from SPEC.md 3.3, custodian dropdown with search
- [x] **1G.3** Build Account detail page: holdings table, account-level KPI cards, account-level allocation chart
- [x] **1G.4** Build Edit Account dialog and Delete Account confirmation
- [x] **1G.5** Add loading and empty states for accounts pages

## Phase 1H: Holdings UI

- [x] **1H.1** Build All Holdings page: sortable/filterable table (DataTable) with columns from frontend.mdc Table Patterns
- [x] **1H.2** Build Add Holding form: dynamic form that changes fields based on asset type selection
- [x] **1H.3** Build Holding detail page: price chart (Lightweight Charts for market assets), lot breakdown table, edit/liquidate actions
- [x] **1H.4** Build Multi-Lot view: expandable rows showing individual lots under a grouped holding
- [x] **1H.5** Build Liquidate Position dialog: sell price, shares sold, date, fees → shows calculated realized gain/loss before confirming
- [x] **1H.6** Build Realized Transactions page: table of all sold positions with gain/loss, date sold, and cumulative cashed-out total
- [x] **1H.7** Build Cross-Custodian Grouped view: toggle between "by account" and "grouped by ticker" views with weighted avg cost basis
- [x] **1H.8** Build CSV Import: upload dialog, column mapping preview, validation, bulk insert

## Phase 1H.a: Market Price Refresh Pipeline

> **Goal:** Automatically fetch and cache market prices for all tracked tickers so that dashboard values, gain/loss calculations, and analytics always reflect current (or near-current) market data. Start with delayed/periodic refresh and lay the groundwork for increasing frequency later.

### Provider: Finnhub (free tier)
- **API:** `https://finnhub.io/api/v1/quote?symbol=AAPL&token=KEY`
- **Free tier:** 60 calls/minute (shared across all endpoints)
- **Coverage:** US stocks, ETFs, mutual funds, crypto (via exchange-prefixed symbols like `BINANCE:BTCUSDT`), some international
- **Response:** `{ c: current, d: change, dp: changePercent, h: high, l: low, o: open, pc: previousClose, t: timestamp }`
- **Env var:** `FINNHUB_API_KEY` (already in `.env.example`)

### Refresh Strategy
| Window | Schedule | Rationale |
|---|---|---|
| US Market hours (Mon–Fri 9:30 AM – 4:00 PM ET) | Every 15 min | Active trading, prices change frequently |
| Extended hours (Mon–Fri 4:00 PM – 8:00 PM ET) | Every 30 min | Lower volume, less urgency |
| Off-hours / Weekends (stocks) | Every 4 hours | Prices don't change, but crypto does |
| Crypto (24/7) | Every 15 min always | Crypto trades around the clock |

> **Phase 2 upgrade path:** Switch to Finnhub WebSocket for true real-time streaming on paid tier, or add Polygon.io as a second provider for redundancy.

### Tasks

- [x] **1H.a.1** Create market data service (`src/server/services/market-data.ts`)
  - `fetchQuote(ticker: string)` — calls Finnhub `/quote`, returns normalized `{ priceCents, previousCloseCents, changeCents, changePercent, volume }`
  - `fetchCryptoQuote(ticker: string)` — handles crypto symbol mapping (e.g., `BTC` → `BINANCE:BTCUSDT`)
  - `fetchBatchQuotes(tickers: string[])` — iterates with 50ms delay between calls to stay under 60/min rate limit
  - Handles API errors gracefully: returns `null` for failed tickers, logs warnings, never throws
  - Includes crypto symbol mapping table (`CRYPTO_SYMBOL_MAP`)

- [x] **1H.a.2** Create DAL function to collect all tracked tickers (`src/server/dal/holdings.ts`)
  - `getAllTrackedTickers()` — `SELECT DISTINCT ticker FROM holdings WHERE ticker IS NOT NULL AND deleted_at IS NULL`
  - No auth required (called from cron context, not user context)
  - Returns `{ ticker: string; assetType: string }[]` so the service knows which are crypto vs stock

- [x] **1H.a.3** Create cron API route (`src/app/api/cron/refresh-prices/route.ts`)
  - `GET` handler secured by `CRON_SECRET` header (matches `vercel.json` cron config)
  - Calls `getAllTrackedTickers()` → groups by asset type → calls `fetchBatchQuotes()`
  - Upserts results via `batchUpdatePriceCache()`
  - Returns JSON summary: `{ refreshed: number, failed: string[], durationMs: number }`
  - Logs results for monitoring

- [x] **1H.a.4** Add Vercel cron configuration (`vercel.json`)
  - Schedule: `*/15 * * * *` (every 15 minutes) as a starting point
  - Path: `/api/cron/refresh-prices`
  - Header: `Authorization: Bearer ${CRON_SECRET}`
  - Add `CRON_SECRET` to `.env.example` (already present) and `.env.local`

- [x] **1H.a.5** Create a dev-friendly manual refresh script and Server Action
  - npm script `"prices:refresh"` in `package.json` — runs a standalone script that calls the same service
  - Server Action `refreshPrices()` in `src/server/actions/prices.ts` — rate-limited (max 1 call per 5 min per user), calls the service for that user's tickers only
  - Returns `{ refreshed: number, failed: string[], lastUpdated: Date }`

- [x] **1H.a.6** Add "Last Updated" indicator and manual refresh button to the UI
  - Show "Prices as of X minutes ago" badge on Dashboard KPI section and Holdings table header
  - Add a refresh icon button next to it — calls `refreshPrices()` Server Action
  - Disable button + show spinner while refreshing, show cooldown timer if rate-limited
  - After refresh, `revalidatePath` to reflect new prices everywhere

- [x] **1H.a.7** Update `.env.example` and `docs/architecture.md`
  - Add any new env vars
  - Update architecture diagram to show the cron → Finnhub → price_cache flow
  - Document the refresh strategy and rate limit considerations

## Phase 1I: Analytics UI

- [x] **1I.1** Build Analytics page: portfolio value over time chart with deposit/withdrawal toggle
- [ ] **1I.2** Build Asset Allocation breakdown views: by class, by custodian, by account type (tab selector)
- [ ] **1I.3** Build Performance summary: total return ($), total return (%), best performer, worst performer
- [ ] **1I.4** Build Net Worth toggle: include/exclude real estate and illiquid assets
- [ ] **1I.5** Build Sector breakdown chart for equity holdings

## Phase 1J: News & Market Tab

- [ ] **1J.1** Set up market data API proxy: API route at `/api/market/quote` that reads from price_cache
- [ ] **1J.2** Set up background cron job (Vercel Cron or Railway) to update price_cache every 15 minutes during market hours
- [ ] **1J.3** Build Market Overview section: S&P 500, NASDAQ, Dow with day change
- [ ] **1J.4** Build Top Movers section: day's biggest gainers/losers
- [ ] **1J.5** Set up news API proxy and cron job to cache news articles
- [ ] **1J.6** Build My Holdings News feed: filtered by user's tickers
- [ ] **1J.7** Build General Market News feed
- [ ] **1J.8** Build tab toggle between "My Holdings" and "General Market" news

## Phase 1K: Household UI

- [ ] **1K.1** Build Household management page: create household, view members, pending invitations
- [ ] **1K.2** Build Invite Member flow: email input → sends invitation → shows pending status
- [ ] **1K.3** Build Household Dashboard: aggregated net worth, combined allocation, member cards with individual totals
- [ ] **1K.4** Build Household/Individual toggle in the header for switching views
- [ ] **1K.5** Build Dependent (child) account creation managed by household owner

## Phase 1L: Settings & Data Management

- [ ] **1L.1** Build Settings page: profile section (display name, avatar via Clerk)
- [ ] **1L.2** Build Security section: MFA management, active sessions (Clerk components)
- [ ] **1L.3** Build Preferences section: placeholder for currency, date format
- [ ] **1L.4** Build Data Export: download all holdings and transactions as CSV (requires re-authentication)
- [ ] **1L.5** Build Account Deletion flow: confirmation dialog, soft delete, data anonymization

## Phase 1M: Final Polish & Testing

- [ ] **1M.1** Write unit tests for financial calculations (cost basis, realized gains, weighted average)
- [ ] **1M.2** Write unit tests for all Zod validators
- [ ] **1M.3** Write E2E test: full flow from sign-up → add account → add holding → view dashboard
- [ ] **1M.4** Responsive design audit: test all pages on mobile (375px), tablet (768px), desktop (1280px)
- [ ] **1M.5** Accessibility audit: keyboard navigation, screen reader, contrast ratios
- [ ] **1M.6** Performance audit: Lighthouse score > 90 on all pages
- [ ] **1M.7** Security audit: verify RLS policies work correctly, test cross-user data isolation
- [ ] **1M.8** Configure security headers (CSP, HSTS, X-Frame-Options) in next.config.ts
- [ ] **1M.9** Deploy to Vercel, configure environment variables, verify production build
