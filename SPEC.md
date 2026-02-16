# Pocket Portfolio — Product Specification (MVP)

## 1. Product Vision

Pocket Portfolio is a web-based portfolio management application that lets individuals manually track all their financial assets — stocks, ETFs, mutual funds, bonds, crypto, real estate, cash, and other holdings — across multiple custodians and accounts in a single, unified dashboard. It supports households with multiple members, role-based access for wealth managers and analysts, and provides performance analytics that separate investment returns from deposit activity.

**Target users:** Self-directed investors, families managing multi-account portfolios, and wealth advisors tracking client holdings.

**Design philosophy:** Clean, modern, professional. Predominantly white backgrounds with green accents (representing growth and money). No clutter. Information density similar to a Bloomberg terminal but with consumer-grade usability.

---

## 2. User Roles & Permissions

| Role | Description | Permissions |
|------|-------------|-------------|
| **User** | Individual investor | Full CRUD on own accounts, holdings, and portfolios. View own analytics. Manage own household. |
| **Admin** | System administrator | All User permissions + manage all users, view all data, view audit logs, system configuration. |
| **Wealth Manager** | Financial advisor | All User permissions + view/manage assigned client portfolios (read/write on client data through assignments). |
| **Analyst** | Research/read-only role | Read-only access to aggregated portfolio analytics. No access to PII or individual transaction details. |

Default role on signup: **User**. Role upgrades require Admin action.

---

## 3. MVP Features — Detailed Specifications

### 3.1 Authentication & Security
- **Sign up / Sign in** via Clerk (email + password, Google OAuth, Apple OAuth)
- **MFA required** for all users (TOTP authenticator app — not SMS)
- **Session management:** 15-minute access tokens with auto-refresh, 30-minute inactivity timeout
- **Role-based middleware:** Protect all dashboard routes; redirect unauthenticated users to sign-in
- **Password requirements:** Minimum 12 characters, complexity enforced by Clerk

### 3.2 Dashboard (Home Page after login)
- **Net Worth KPI Card:** Total value of all assets across all accounts, updated with latest cached prices
- **Day Change KPI Card:** Dollar and percentage change from previous market close
- **Total Gain/Loss KPI Card:** Unrealized gain/loss across all holdings
- **Net Worth History Chart:** Area chart showing net worth over time (1W, 1M, 3M, 6M, 1Y, ALL selectable periods). Green gradient fill. Tooltip on hover shows exact value and date.
- **Asset Allocation Donut Chart:** Breakdown by asset class (stocks, bonds, real estate, crypto, cash, other). Click a segment to drill down.
- **Top Movers Section:** Top 3 gainers and top 3 losers from user's holdings today (ticker, $ change, % change)
- **Recent Activity Feed:** Last 10 actions (added holding, updated shares, sold position, etc.)

### 3.3 Accounts Management
An "Account" represents a single brokerage/custodian account (e.g., "Schwab IRA", "Fidelity 401k", "Coinbase").

- **Create Account:** Name, custodian (dropdown: Fidelity, Schwab, Vanguard, TD Ameritrade, Robinhood, Coinbase, Kraken, E*Trade, Merrill Lynch, Other + custom text), account type (Individual Brokerage, IRA, Roth IRA, 401k, 529, Trust, Crypto Wallet, Bank Account, Real Estate, Other), optional notes
- **Edit Account:** Update any field
- **Delete Account:** Soft delete (marks deleted_at). Holdings within become hidden but preserved.
- **Account Detail View:** List all holdings within this account, total account value, account-level gain/loss, account-level asset allocation pie chart

### 3.4 Holdings Management (Core Feature)
A "Holding" represents an individual position within an account.

#### Adding a Holding
- **For Market Assets (stocks, ETFs, mutual funds, bonds, crypto):**
  - Ticker symbol (autocomplete search against cached ticker database)
  - Asset type (stock, ETF, mutual fund, bond, crypto)
  - Number of shares/units
  - Cost basis per share (user enters dollar amount, stored as cents)
  - Date acquired
  - Optional notes
- **For Real Estate:**
  - Property name/address
  - Purchase price (stored as cents)
  - Date acquired
  - Current estimated value (manual entry — Zillow integration is post-MVP)
  - Monthly mortgage payment (optional, stored as cents)
  - Monthly escrow payment (optional, stored as cents)
  - Optional notes
- **For Cash Accounts:**
  - Account name
  - Current balance (stored as cents)
  - Interest rate (APY, optional)
  - Optional notes
- **For Other Assets:**
  - Asset name
  - Estimated value (stored as cents)
  - Date acquired
  - Category (vehicle, collectible, precious metal, private equity, other)
  - Optional notes

#### Multi-Lot Support
When a user buys the same ticker at different times and prices, each purchase is a separate "lot" tracked individually. The system computes weighted average cost basis for display but preserves individual lots for tax and gain/loss calculations.

- **Add lot to existing holding:** Same ticker + same account → new lot row linked to the holding
- **Display:** Collapsed view shows aggregate (total shares, weighted avg cost); expandable to show each lot

#### Editing and Updating Holdings
- Edit any field on a holding or lot
- Quick-update shares count (for stock splits, reinvested dividends, DRIP adjustments)
- Bulk import via CSV (columns: ticker, shares, cost_basis, date, account_name, asset_type)

#### Liquidating (Selling) a Position
- Mark a holding/lot as liquidated
- Enter: sell price per share, number of shares sold, date sold, fees (stored as cents)
- System computes: realized gain/loss = (sell_price × shares_sold) − (cost_basis of sold lots) − fees
- Liquidated holdings move to a "Realized Transactions" section (separate tab/view)
- Liquidated holdings are excluded from active portfolio value but preserved in history
- **Cashed Out Tracker:** Running total of all realized gains across all accounts, displayed on dashboard

### 3.5 Portfolio Analytics
- **Performance Chart:** Portfolio value over time, with toggle to include/exclude deposits and withdrawals. When excluding deposits, show investment return only.
- **Growth Calculation Options:**
  - Simple: (Current Value − Total Cost Basis) / Total Cost Basis
  - Time-Weighted Return (TWR): Isolates investment performance from cash flow timing (Phase 2, but design schema to support from day one)
- **Cross-Custodian Grouping:** Collapse all accounts and group holdings by ticker. Show aggregate shares, weighted average cost basis, total market value, combined gain/loss. Example: NVDA in Schwab at $100 + NVDA in Fidelity at $150 → grouped NVDA row with computed average.
- **Asset Allocation Views:**
  - By asset class (stock, bond, real estate, crypto, cash, other)
  - By custodian (Schwab, Fidelity, Coinbase, etc.)
  - By account type (IRA, 401k, taxable, etc.)
- **Net Worth Toggle:** Include/exclude real estate and other illiquid assets (since they fluctuate differently and may inflate net worth perception)
- **Sector Breakdown:** For stock/ETF holdings, show allocation by sector (Technology, Healthcare, Finance, etc.) using cached sector data

### 3.6 News & Market Tab
A dedicated tab (not push notifications) showing market information:

- **Market Overview:** S&P 500, NASDAQ, Dow Jones current value and day change (cached, updated every 15 min during market hours)
- **Top Movers:** Day's biggest gainers and losers from major indices
- **Your Holdings News:** News headlines specifically about stocks/assets the user owns. Sourced from a financial news API (Finnhub or similar). Clicking a headline opens the source article in a new tab.
- **General Market News:** Top 10 financial news headlines of the day
- **Filter/Tab Toggle:** Switch between "My Holdings" news and "General Market" news

### 3.7 Household Management
A household groups multiple user accounts under one umbrella for family portfolio tracking.

- **Create Household:** Name the household (e.g., "Smith Family")
- **Add Members:** Invite by email. Invited users get a notification and must accept. Each member maintains their own login and role.
- **Household Dashboard:** Aggregated view of all members' portfolios (total household net worth, combined asset allocation, combined top movers)
- **Member Permissions within Household:**
  - **Owner:** Full access to all household members' data, can add/remove members
  - **Member:** Can view household aggregate dashboard but only edit their own accounts/holdings
  - **Child/Dependent:** Account managed by Owner. Owner has full CRUD on dependent's data.
- **Household vs Individual Toggle:** Users can switch between viewing their individual portfolio and the household aggregate

### 3.8 Settings
- **Profile:** Edit display name, email, avatar
- **Security:** MFA management, active sessions, change password
- **Preferences:** Default currency (USD initially, multi-currency post-MVP), date format, number format
- **Data Management:** Export all data as CSV, request account deletion (GDPR-aligned)
- **Notification Preferences:** (Placeholder for future push notification settings)

---

## 4. Data Model Overview

See `docs/database.md` for the complete schema. Key entities and their relationships:

```
users (synced from Clerk)
├── households (many-to-many via household_members)
│   └── household_members (user_id, household_id, role: owner/member/dependent)
├── portfolios (a user can have multiple logical portfolios)
│   └── accounts (custodian accounts within a portfolio)
│       └── holdings (individual positions within an account)
│           └── lots (individual purchase lots within a holding)
│               └── realized_transactions (when lots are sold)
├── client_assignments (links wealth_manager to client users)
├── price_cache (ticker → latest price, updated by cron)
├── news_cache (cached news articles, updated by cron)
└── audit_logs (append-only activity log)
```

---

## 5. Non-Functional Requirements

### Performance
- Dashboard initial load: < 2 seconds (server-rendered with cached data)
- Page navigations: < 500ms (client-side with prefetching)
- Market data freshness: Prices cached and updated every 15 minutes during market hours via background cron
- Support up to 10,000 holdings per user without degradation

### Security
- See `docs/security.md` for full security specification
- All data encrypted in transit (TLS 1.3) and at rest (AES-256)
- Row-Level Security on every table
- Audit logging on every financial data mutation
- Financial amounts stored as integer cents (never floating point)
- Re-authentication required for: data export, email change, account deletion

### Scalability
- Database designed for multi-tenancy with RLS (single database, user-isolated data)
- Background jobs for price/news updates independent of user requests
- Designed for horizontal scaling via Vercel serverless

### Accessibility
- WCAG 2.1 AA compliance target
- Full keyboard navigation
- Screen reader compatible (semantic HTML, ARIA labels)
- Minimum contrast ratio 4.5:1 for text

---

## 6. Post-MVP Feature Roadmap

These features are NOT in the MVP but the architecture should accommodate them:

### Phase 2 (Early Growth)
- Time-weighted and money-weighted return calculations
- Dividend tracking with calendar view and projected annual income
- Benchmark comparison (vs S&P 500, custom indices)
- Realized gains reporting with FIFO/LIFO/specific lot identification for tax purposes
- Tax impact estimation on potential sales
- Multi-currency support with exchange rates
- Document attachment per asset (e.g., property deed scan, account statements)
- Price alerts (e.g., NVDA crosses $200)

### Phase 3 (Differentiation)
- **Custodian integration** via Plaid for automatic account syncing (architecture is Plaid-ready — the lots/transactions schema supports imported data with a `source` field: "manual" vs "plaid")
- ETF/fund look-through analysis (show underlying sector/geography allocation through funds)
- Investment projections with animated visualizations ("If I invest $500/month in X...")
- Children's portfolio projections (show projected value at age 18)
- Real estate: Zillow API integration for auto-valuation, mortgage amortization tracking with total interest paid
- Push notifications (market close summary, large price movements, dividend payments)
- AI-powered portfolio insights and rebalancing suggestions
- Financial education section (Duolingo-style course for investing basics)
- Advisor portal: Wealth managers get a dedicated multi-client dashboard
- Mobile app (React Native with Expo, sharing business logic from web)

---

## 7. Design Direction

### Color System (CSS Variables)
```css
:root {
  --primary: 142 76% 36%;       /* green-600: #16a34a */
  --primary-hover: 142 72% 29%; /* green-700: #15803d */
  --background: 0 0% 100%;      /* white */
  --foreground: 215 28% 17%;    /* slate-900 */
  --card: 0 0% 100%;            /* white */
  --border: 214 32% 91%;        /* slate-200 */
  --muted: 210 40% 96%;         /* slate-100 */
  --gain: 142 71% 45%;          /* green-500 */
  --loss: 0 84% 60%;            /* red-500 */
  --warning: 38 92% 50%;        /* amber-500 */
}
```

### Key UI Principles
1. Data density: Show meaningful numbers without clutter. Use sparklines and inline indicators.
2. Progressive disclosure: Summary cards → click to expand → click to see full detail page.
3. Consistent alignment: All currency values right-aligned in tables. All labels left-aligned.
4. Responsive: Desktop-first design that gracefully collapses to single-column on mobile.
5. White space: Generous padding between sections. Content breathes.
