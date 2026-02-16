# Pocket Portfolio

A modern, secure portfolio management web application for tracking stocks, real estate, crypto, and all asset classes across multiple custodians and accounts.

## Quick Start

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Fill in Clerk, Supabase, and Finnhub keys

# Push database schema to Supabase
npx drizzle-kit push

# Seed sample data
npm run seed

# Start development server
npm run dev
```

## Tech Stack

- **Framework:** Next.js 15 (App Router, TypeScript)
- **UI:** shadcn/ui + Tremor + Tailwind CSS v4
- **Database:** Supabase (PostgreSQL) + Drizzle ORM
- **Auth:** Clerk (MFA, RBAC)
- **State:** Zustand + TanStack Query
- **Charts:** Recharts + Tremor + Lightweight Charts

## Project Structure

```
src/
├── app/              # Pages and layouts (App Router)
├── components/       # UI components (ui/, dashboard/, forms/, layout/, shared/)
├── lib/              # Utilities, clients, constants
├── server/           # Server Actions, DAL, services, validators
├── db/               # Drizzle schema, migrations, seed
├── hooks/            # Custom React hooks
├── stores/           # Zustand stores
└── types/            # Shared TypeScript types
```

## Documentation

- [Product Specification](./SPEC.md) — Full feature spec and requirements
- [Implementation Tasks](./tasks.md) — Phased task checklist
- [Architecture](./docs/architecture.md) — System design and data flow
- [Database Schema](./docs/database.md) — Complete table definitions
- [API Reference](./docs/api.md) — Server Actions and API routes
- [Security](./docs/security.md) — Auth, encryption, RLS, audit logging

## CSV Import

You can bulk-import holdings into any account using a CSV file. A downloadable template is provided within the app.

### Getting the Template

1. Go to the **Holdings** page
2. Click **Import CSV**
3. Click **Download** to get the pre-formatted template

Or download directly from: `/templates/holdings-import-template.csv`

### Template Columns

| Column | Required | Description |
|---|---|---|
| `ticker` | For market assets | Ticker symbol (e.g. `AAPL`, `BTC`). Max 10 chars, alphanumeric. |
| `name` | Always | Holding name (e.g. `Apple Inc.`). Max 200 characters. |
| `asset_type` | Always | Must be one of: `stock`, `etf`, `mutual_fund`, `bond`, `crypto`, `real_estate`, `cash`, `other` |
| `shares` | For market assets | Number of shares/units. Must be a positive number. |
| `cost_per_share` | Optional | Cost per share in dollars (e.g. `195.50`). |
| `total_cost` | Always | Total cost basis in dollars (e.g. `1955.00`). Must be non-negative. |
| `date_acquired` | Optional | Date in `YYYY-MM-DD` format. Cannot be in the future. |

### Validation Rules

- **Market assets** (`stock`, `etf`, `mutual_fund`, `bond`, `crypto`) require `ticker` and `shares`
- **All rows** require `name`, `asset_type`, and `total_cost`
- Dollar amounts should be plain numbers (e.g. `1955.00`), not formatted (no `$` or commas)
- If a holding with the same ticker already exists in the target account, a new lot is added to the existing holding
- Max 500 rows per import, max 5MB file size

### Example CSV

```csv
ticker,name,asset_type,shares,cost_per_share,total_cost,date_acquired
AAPL,Apple Inc.,stock,10,195.50,1955.00,2024-06-15
VOO,Vanguard S&P 500 ETF,etf,15,510.75,7661.25,2023-11-01
,Primary Residence,real_estate,,,450000.00,2020-08-01
,High Yield Savings,cash,,,25000.00,2024-01-01
```

## Key Principles

1. **Money as integer cents** — No floating-point for financial amounts
2. **RLS on every table** — Database-level data isolation
3. **Audit everything** — Append-only log of all financial data changes
4. **Server-first** — Server Components by default, client only for interactivity
5. **Manual-first, automation-ready** — Schema supports Plaid integration later

## Environment Variables

See `docs/security.md` for the complete list. Key variables:

```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
FINNHUB_API_KEY=
```
