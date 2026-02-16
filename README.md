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
