# API & Server Actions — Pocket Portfolio

## Server Actions (Primary Mutation Interface)

Server Actions are the preferred way to handle data mutations. They provide type-safe, validated, server-only execution with automatic CSRF protection.

---

### Accounts

| Action | File | Input | Output | Auth |
|--------|------|-------|--------|------|
| `createAccount` | `server/actions/accounts.ts` | `{ portfolioId, name, custodian, accountType, notes? }` | `{ success, accountId }` | User (own portfolio) |
| `updateAccount` | `server/actions/accounts.ts` | `{ accountId, name?, custodian?, accountType?, notes? }` | `{ success }` | User (own account) |
| `deleteAccount` | `server/actions/accounts.ts` | `{ accountId }` | `{ success }` | User (own account) — soft delete |

### Holdings

| Action | File | Input | Output | Auth |
|--------|------|-------|--------|------|
| `addHolding` | `server/actions/holdings.ts` | `{ accountId, ticker?, name, assetType, shares?, costBasisCents, acquiredAt?, notes? }` | `{ success, holdingId }` | User (own account) |
| `updateHolding` | `server/actions/holdings.ts` | `{ holdingId, name?, notes?, currentValueCents? }` | `{ success }` | User (own holding) |
| `addLotToHolding` | `server/actions/holdings.ts` | `{ holdingId, shares, costBasisCents, costPerShareCents?, acquiredAt? }` | `{ success, lotId }` | User (own holding) |
| `updateLot` | `server/actions/holdings.ts` | `{ lotId, shares?, costBasisCents?, acquiredAt? }` | `{ success }` | User (own lot) |
| `importHoldingsFromCSV` | `server/actions/holdings.ts` | `{ portfolioId, csvData: string }` | `{ success, imported: number, errors: string[] }` | User (own portfolio) |

### Transactions

| Action | File | Input | Output | Auth |
|--------|------|-------|--------|------|
| `liquidatePosition` | `server/actions/transactions.ts` | `{ lotId, sharesSold, sellPriceCents, feesCents?, soldAt }` | `{ success, realizedGainCents }` | User (own lot) |
| `undoLiquidation` | `server/actions/transactions.ts` | `{ transactionId }` | `{ success }` | User (own transaction) — within 24 hours |

### Portfolios

| Action | File | Input | Output | Auth |
|--------|------|-------|--------|------|
| `createPortfolio` | `server/actions/portfolios.ts` | `{ name, description? }` | `{ success, portfolioId }` | User |
| `updatePortfolio` | `server/actions/portfolios.ts` | `{ portfolioId, name?, description? }` | `{ success }` | User (own) |
| `deletePortfolio` | `server/actions/portfolios.ts` | `{ portfolioId }` | `{ success }` | User (own, non-default only) |

### Households

| Action | File | Input | Output | Auth |
|--------|------|-------|--------|------|
| `createHousehold` | `server/actions/households.ts` | `{ name }` | `{ success, householdId }` | User |
| `inviteMember` | `server/actions/households.ts` | `{ householdId, email, role }` | `{ success }` | Household Owner |
| `acceptInvitation` | `server/actions/households.ts` | `{ memberId }` | `{ success }` | Invited User |
| `removeMember` | `server/actions/households.ts` | `{ memberId }` | `{ success }` | Household Owner |
| `leaveHousehold` | `server/actions/households.ts` | `{ householdId }` | `{ success }` | Member (not Owner) |

### Data Export

| Action | File | Input | Output | Auth |
|--------|------|-------|--------|------|
| `exportPortfolioCSV` | `server/actions/export.ts` | `{ portfolioId }` | `{ success, csvUrl }` | User (own) — requires re-auth |

---

## API Routes (External Data Proxy & Webhooks)

API routes are used ONLY for external service integration. All internal data operations use Server Actions.

### Market Data Proxy

**`GET /api/market/quote?symbol=AAPL`**
- Auth: Required (Clerk)
- Rate limit: 60/min
- Response: `{ ticker, priceCents, previousCloseCents, changeCents, changePercent, volume, updatedAt }`
- Source: Reads from `price_cache` table (NOT external API directly)

**`GET /api/market/search?q=appl`**
- Auth: Required
- Rate limit: 60/min
- Response: `{ results: [{ ticker, name, exchange, type }] }`
- Source: Cached ticker database or external API with caching

**`GET /api/market/overview`**
- Auth: Required
- Rate limit: 100/min
- Response: `{ indices: [{ name, valueCents, changeCents, changePercent }], topGainers: [...], topLosers: [...] }`
- Source: `price_cache` for indices

### News Proxy

**`GET /api/news?tickers=AAPL,MSFT&category=general&limit=20`**
- Auth: Required
- Rate limit: 60/min
- Response: `{ articles: [{ title, summary, source, url, imageUrl, relatedTickers, publishedAt }] }`
- Source: `news_cache` table

### Webhooks

**`POST /api/webhooks/clerk`**
- Auth: Clerk webhook signature verification (CLERK_WEBHOOK_SECRET)
- Events handled: `user.created`, `user.updated`, `user.deleted`
- Action: Sync user data to `users` table in Supabase

---

## Background Jobs (Cron)

### Price Update Job
- **Schedule:** Every 15 minutes, Mon-Fri 9:15 AM – 4:30 PM ET
- **Logic:**
  1. Query distinct tickers from all active holdings
  2. Batch fetch prices from Finnhub/Twelve Data API
  3. Upsert into `price_cache` table
  4. Log job execution to `audit_logs` with actor_id = "system"
- **Implementation:** Vercel Cron → calls internal API route `/api/cron/update-prices` with a secret token

### News Update Job
- **Schedule:** Every 30 minutes during market hours, every 2 hours off-hours
- **Logic:**
  1. Fetch general financial news from API
  2. Fetch news for top 50 most-held tickers across all users
  3. Upsert into `news_cache` table (deduplicate by URL)
  4. Delete cached articles older than 7 days
- **Implementation:** Vercel Cron → calls `/api/cron/update-news`

### Mutual Fund Price Update Job
- **Schedule:** Daily at 7:00 PM ET (after mutual fund NAVs are published)
- **Logic:** Fetch updated NAV for all mutual fund tickers in holdings, update `price_cache`
- **Implementation:** Vercel Cron → calls `/api/cron/update-mutual-funds`
