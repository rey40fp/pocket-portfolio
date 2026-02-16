# Security Specification — Pocket Portfolio

## Threat Model Summary

This application handles sensitive financial data (portfolio values, account balances, investment positions). The primary threats are:

1. **Unauthorized data access** — User A sees User B's portfolio data
2. **Privilege escalation** — A User role gains Admin or Wealth Manager capabilities
3. **Data tampering** — Unauthorized modification of holdings, transactions, or financial amounts
4. **Session hijacking** — Stolen tokens used to access accounts
5. **API abuse** — Automated attacks against endpoints

---

## Authentication (Clerk)

### Configuration Requirements
- **Providers:** Email/password + Google OAuth + Apple OAuth
- **MFA:** Mandatory TOTP (authenticator app). Do NOT offer SMS-based MFA (SIM swap vulnerability).
- **Password policy:** Minimum 12 characters, enforced by Clerk
- **Session tokens:** 15-minute access token lifetime with automatic refresh via Clerk SDK
- **Inactivity timeout:** 30 minutes — session invalidated after 30 min of no API activity
- **Account lockout:** 5 failed login attempts → 15-minute lockout (Clerk default)

### Clerk Webhook → User Sync
On `user.created` and `user.updated` Clerk webhook events, sync user data to the `users` table in Supabase. This is the ONLY way user records are created in the database.

```
POST /api/webhooks/clerk → validate webhook signature → upsert users table
```

### Custom JWT Claims
Configure Clerk to inject the user's role into the JWT access token:

```json
{
  "metadata": {
    "role": "user"
  }
}
```

Supabase RLS policies read this claim via `auth.jwt() -> 'metadata' ->> 'role'`.

---

## Authorization — Dual-Layer RBAC

### Layer 1: Next.js Middleware + Server Actions
- `middleware.ts`: Clerk's `clerkMiddleware()` protects all `/dashboard/*` routes
- Every Server Action calls `requireRole()` before any data operation
- `requireRole()` extracts role from Clerk session claims and rejects unauthorized access

### Layer 2: Supabase Row-Level Security
- RLS is enabled on EVERY table (no exceptions)
- Policies are per-operation (SELECT, INSERT, UPDATE, DELETE — never FOR ALL)
- User isolation: `auth.uid() = user_id` on all user-facing tables
- Wealth Manager access: JOIN through `client_assignments` table
- Analyst access: SELECT only on aggregated views (no direct table access to holdings)
- Admin access: Full SELECT on all tables, restricted mutations

### RLS Testing Protocol
Before deploying any RLS change:
1. Test as User A that you CANNOT see User B's data
2. Test as Wealth Manager that you CAN see assigned client data but NOT unassigned users
3. Test as Analyst that you get aggregated data but no PII
4. Test as Admin that you can see all data
5. Test that the Supabase SQL Editor (which bypasses RLS) is not accessible from the application

---

## Data Encryption

| Layer | Standard | Implementation |
|-------|----------|----------------|
| In transit | TLS 1.3 | Supabase default, Vercel default |
| At rest (database) | AES-256 | Supabase managed encryption |
| At rest (backups) | AES-256 | Supabase managed |
| Sensitive fields (app-level) | AES-256-GCM | Encrypt `total_net_worth` snapshots before storage. Key in env var. |
| Password hashing | bcrypt | Clerk managed |

---

## Financial Data Integrity

### Integer Arithmetic Only
- ALL monetary values stored as `BIGINT` representing cents (or the smallest currency unit)
- Never use FLOAT, DOUBLE, REAL, or NUMERIC with decimal places for stored amounts
- Conversion: user enters "$150.50" → stored as `15050` → displayed as "$150.50"
- All calculations (gain/loss, weighted average, totals) performed on integer cents
- Percentage calculations: compute on cents, round to 2 decimal places at display time only

### Audit Trail
- Every CREATE, UPDATE, DELETE on financial tables writes to `audit_logs`
- Audit log is append-only: RLS allows INSERT only, no UPDATE or DELETE
- Admins can SELECT audit logs; no other role can read them
- Log fields: actor_id, action, resource_type, resource_id, metadata (JSONB with old/new values), ip_address, timestamp
- Retention: 12 months minimum

---

## API Security

### Rate Limiting
Implement via middleware (e.g., `upstash/ratelimit` with Redis):

| Endpoint Category | Limit | Window |
|---|---|---|
| Auth (sign-in, sign-up) | 5 requests | 1 minute |
| Data mutations (create, update, delete) | 30 requests | 1 minute |
| Data reads (list, get) | 100 requests | 1 minute |
| Market data proxy | 60 requests | 1 minute |
| CSV import | 5 requests | 10 minutes |
| Data export | 3 requests | 1 hour |

### Input Validation
- Every endpoint validates input with Zod schemas BEFORE any database operation
- Reject unexpected fields (Zod `.strict()` mode)
- Sanitize text inputs for XSS (DOMPurify on display, not on storage)
- File uploads (CSV): validate MIME type, max 5MB, parse and validate each row

### Sensitive Operations Requiring Re-Authentication
These operations trigger a Clerk `verifySession()` or re-auth prompt:
- Full data export (CSV download of all holdings)
- Email address change
- Account deletion
- Role change (Admin only)
- Household ownership transfer

---

## Security Headers

Configure in `next.config.ts` headers section:

```
Content-Security-Policy: default-src 'self'; script-src 'self' 'nonce-{random}' https://clerk.com; style-src 'self' 'unsafe-inline'; img-src 'self' https: data:; connect-src 'self' https://api.clerk.com https://*.supabase.co; frame-ancestors 'none';
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 0
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

Target: A+ rating on securityheaders.com

---

## Environment Variables

NEVER commit these to version control. Store in Vercel project settings.

```
# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...
CLERK_WEBHOOK_SECRET=whsec_...

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...  (safe for client — RLS enforces access)
SUPABASE_SERVICE_ROLE_KEY=eyJ...      (server-only, bypasses RLS — NEVER expose)

# Market Data
FINNHUB_API_KEY=...                   (server-only)

# Encryption
ENCRYPTION_KEY=...                    (server-only, 256-bit key for AES-256-GCM)

# Rate Limiting
UPSTASH_REDIS_URL=...                 (server-only)
UPSTASH_REDIS_TOKEN=...               (server-only)
```

Variables prefixed with `NEXT_PUBLIC_` are bundled into client code. ONLY Clerk publishable key and Supabase anon key should have this prefix. All others MUST be server-only.
