# Database Schema — Pocket Portfolio

## Entity Relationship Overview

```
users 1──M portfolios 1──M accounts 1──M holdings 1──M lots 1──M realized_transactions
users M──M households (via household_members)
users 1──M client_assignments (as wealth_manager or client)
users 1──M audit_logs (as actor)
```

---

## Table Definitions

### `users`
Synced from Clerk via webhook. This is the source of truth for user identity within the database.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | TEXT | PK | Clerk user ID (e.g., "user_2abc...") |
| email | TEXT | NOT NULL, UNIQUE | User's email |
| display_name | TEXT | | User's display name |
| role | TEXT | NOT NULL, DEFAULT 'user' | One of: user, admin, wealth_manager, analyst |
| avatar_url | TEXT | | Profile image URL |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | |

### `households`
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, DEFAULT gen_random_uuid() | |
| name | TEXT | NOT NULL | e.g., "Smith Family" |
| created_by | TEXT | NOT NULL, FK → users.id | Owner who created it |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | |

### `household_members`
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, DEFAULT gen_random_uuid() | |
| household_id | UUID | NOT NULL, FK → households.id | |
| user_id | TEXT | NOT NULL, FK → users.id | |
| role | TEXT | NOT NULL, DEFAULT 'member' | owner, member, dependent |
| status | TEXT | NOT NULL, DEFAULT 'pending' | pending, active, removed |
| invited_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | |
| accepted_at | TIMESTAMPTZ | | |
| UNIQUE | | (household_id, user_id) | No duplicate memberships |

### `portfolios`
A logical grouping. Most users will have just one (default), but advanced users may want "Retirement" and "Taxable" portfolios.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, DEFAULT gen_random_uuid() | |
| user_id | TEXT | NOT NULL, FK → users.id | |
| name | TEXT | NOT NULL | e.g., "My Portfolio", "Retirement" |
| description | TEXT | | |
| is_default | BOOLEAN | NOT NULL, DEFAULT true | First portfolio is default |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | |

### `accounts`
Represents a single custodian account.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, DEFAULT gen_random_uuid() | |
| portfolio_id | UUID | NOT NULL, FK → portfolios.id | |
| user_id | TEXT | NOT NULL, FK → users.id | Denormalized for RLS performance |
| name | TEXT | NOT NULL | e.g., "Schwab IRA" |
| custodian | TEXT | NOT NULL | e.g., "fidelity", "schwab", "coinbase" |
| account_type | TEXT | NOT NULL | individual, ira, roth_ira, 401k, 529, trust, crypto_wallet, bank, real_estate, other |
| notes | TEXT | | |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | |
| deleted_at | TIMESTAMPTZ | | Soft delete |

### `holdings`
An individual position within an account. For multi-lot holdings, this serves as the parent record.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, DEFAULT gen_random_uuid() | |
| account_id | UUID | NOT NULL, FK → accounts.id | |
| user_id | TEXT | NOT NULL, FK → users.id | Denormalized for RLS |
| ticker | TEXT | | NULL for non-market assets |
| name | TEXT | NOT NULL | Company name, property address, etc. |
| asset_type | asset_type_enum | NOT NULL | stock, etf, mutual_fund, bond, crypto, real_estate, cash, other |
| asset_category | TEXT | | Sub-category: vehicle, collectible, precious_metal, private_equity |
| sector | TEXT | | Cached sector for equities |
| is_liquidated | BOOLEAN | NOT NULL, DEFAULT false | All lots sold |
| liquidated_at | TIMESTAMPTZ | | |
| notes | TEXT | | |
| source | TEXT | NOT NULL, DEFAULT 'manual' | manual, plaid, csv_import (future-proofing) |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | |
| deleted_at | TIMESTAMPTZ | | Soft delete |

### `lots`
Individual purchase lots within a holding. Every holding has at least one lot.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, DEFAULT gen_random_uuid() | |
| holding_id | UUID | NOT NULL, FK → holdings.id | |
| user_id | TEXT | NOT NULL, FK → users.id | Denormalized for RLS |
| shares | NUMERIC(18,8) | | Number of shares/units. NULL for cash/real_estate |
| cost_basis_cents | BIGINT | NOT NULL | Total cost of this lot in cents |
| cost_per_share_cents | BIGINT | | Cost per share in cents (computed or entered) |
| acquired_at | TIMESTAMPTZ | | Date of purchase |
| current_value_cents | BIGINT | | For manually-valued assets (real estate, cash) |
| mortgage_monthly_cents | BIGINT | | Real estate: monthly mortgage |
| escrow_monthly_cents | BIGINT | | Real estate: monthly escrow |
| interest_rate_bps | INTEGER | | Cash: APY in basis points (e.g., 500 = 5.00%) |
| is_liquidated | BOOLEAN | NOT NULL, DEFAULT false | This lot has been sold |
| notes | TEXT | | |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | |

### `realized_transactions`
Created when a lot (or partial lot) is sold.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, DEFAULT gen_random_uuid() | |
| lot_id | UUID | NOT NULL, FK → lots.id | |
| holding_id | UUID | NOT NULL, FK → holdings.id | Denormalized |
| user_id | TEXT | NOT NULL, FK → users.id | Denormalized for RLS |
| shares_sold | NUMERIC(18,8) | NOT NULL | |
| sell_price_cents | BIGINT | NOT NULL | Price per share in cents |
| total_proceeds_cents | BIGINT | NOT NULL | sell_price × shares_sold |
| cost_basis_cents | BIGINT | NOT NULL | Cost basis of sold shares |
| fees_cents | BIGINT | NOT NULL, DEFAULT 0 | Trading fees |
| realized_gain_cents | BIGINT | NOT NULL | proceeds − cost_basis − fees |
| sold_at | TIMESTAMPTZ | NOT NULL | |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | |

### `price_cache`
Market prices cached from external API. Updated by background cron job.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| ticker | TEXT | PK | Stock/crypto ticker |
| price_cents | BIGINT | NOT NULL | Current/last price in cents |
| previous_close_cents | BIGINT | | Previous day close in cents |
| change_cents | BIGINT | | Day change in cents |
| change_percent | NUMERIC(8,4) | | Day change percentage |
| volume | BIGINT | | Trading volume |
| market_cap_cents | BIGINT | | Market cap in cents |
| name | TEXT | | Company/asset name |
| sector | TEXT | | Sector classification |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Last cache refresh |

### `news_cache`
News articles cached from financial news API.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, DEFAULT gen_random_uuid() | |
| title | TEXT | NOT NULL | Headline |
| summary | TEXT | | Article summary |
| source | TEXT | NOT NULL | Publisher name |
| url | TEXT | NOT NULL, UNIQUE | Link to full article |
| image_url | TEXT | | Thumbnail |
| related_tickers | TEXT[] | | Array of related ticker symbols |
| category | TEXT | | general, earnings, merger, etc. |
| published_at | TIMESTAMPTZ | NOT NULL | |
| cached_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | |

### `client_assignments`
Links wealth managers to their client users.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, DEFAULT gen_random_uuid() | |
| wealth_manager_id | TEXT | NOT NULL, FK → users.id | |
| client_id | TEXT | NOT NULL, FK → users.id | |
| assigned_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | |
| UNIQUE | | (wealth_manager_id, client_id) | |

### `audit_logs`
Append-only audit trail. See database.mdc for RLS policy.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, DEFAULT gen_random_uuid() | |
| actor_id | TEXT | NOT NULL | Clerk user ID who performed action |
| action | TEXT | NOT NULL | CREATE, UPDATE, DELETE, LOGIN, EXPORT, ROLE_CHANGE |
| resource_type | TEXT | NOT NULL | account, holding, lot, transaction, household, etc. |
| resource_id | UUID | | ID of affected resource |
| metadata | JSONB | DEFAULT '{}' | Additional context (old/new values, ticker, etc.) |
| ip_address | INET | | Request IP |
| success | BOOLEAN | DEFAULT true | Whether action succeeded |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | |

---

## Indexes

```sql
-- Performance-critical indexes
CREATE INDEX idx_accounts_user_id ON accounts(user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_holdings_user_id ON holdings(user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_holdings_account_id ON holdings(account_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_holdings_ticker ON holdings(ticker) WHERE deleted_at IS NULL AND ticker IS NOT NULL;
CREATE INDEX idx_holdings_user_ticker ON holdings(user_id, ticker) WHERE deleted_at IS NULL;
CREATE INDEX idx_lots_holding_id ON lots(holding_id);
CREATE INDEX idx_lots_user_id ON lots(user_id);
CREATE INDEX idx_realized_user_id ON realized_transactions(user_id);
CREATE INDEX idx_household_members_user ON household_members(user_id);
CREATE INDEX idx_household_members_household ON household_members(household_id);
CREATE INDEX idx_client_assignments_wm ON client_assignments(wealth_manager_id);
CREATE INDEX idx_client_assignments_client ON client_assignments(client_id);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at);
CREATE INDEX idx_audit_logs_actor ON audit_logs(actor_id);
CREATE INDEX idx_news_cache_tickers ON news_cache USING GIN(related_tickers);
CREATE INDEX idx_news_cache_published ON news_cache(published_at DESC);
```
