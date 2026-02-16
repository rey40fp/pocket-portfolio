-- ═══════════════════════════════════════════════════════════════
-- Post-migration: updated_at trigger, RLS policies, indexes
-- Run AFTER the Drizzle schema migration (0000_dry_shen.sql)
-- ═══════════════════════════════════════════════════════════════

-- ─── updated_at trigger function ─────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to all tables with updated_at
CREATE TRIGGER set_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON households
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON portfolios
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON holdings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON lots
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ═══════════════════════════════════════════════════════════════
-- RLS POLICIES
-- These use Supabase auth functions (auth.uid(), auth.jwt())
-- for defense-in-depth. Primary auth is Clerk via the DAL.
-- ═══════════════════════════════════════════════════════════════

-- ─── users ───────────────────────────────────────────────────
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_select_own" ON users
  FOR SELECT USING (auth.uid()::text = id);

CREATE POLICY "users_update_own" ON users
  FOR UPDATE USING (auth.uid()::text = id)
  WITH CHECK (auth.uid()::text = id);

CREATE POLICY "admin_select_all_users" ON users
  FOR SELECT USING (
    (auth.jwt() -> 'metadata' ->> 'role') = 'admin'
  );

-- ─── portfolios ──────────────────────────────────────────────
ALTER TABLE portfolios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_select_own_portfolios" ON portfolios
  FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY "users_insert_own_portfolios" ON portfolios
  FOR INSERT WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "users_update_own_portfolios" ON portfolios
  FOR UPDATE USING (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "users_delete_own_portfolios" ON portfolios
  FOR DELETE USING (auth.uid()::text = user_id);

CREATE POLICY "admin_select_all_portfolios" ON portfolios
  FOR SELECT USING (
    (auth.jwt() -> 'metadata' ->> 'role') = 'admin'
  );

-- ─── accounts ────────────────────────────────────────────────
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_select_own_accounts" ON accounts
  FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY "users_insert_own_accounts" ON accounts
  FOR INSERT WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "users_update_own_accounts" ON accounts
  FOR UPDATE USING (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "users_delete_own_accounts" ON accounts
  FOR DELETE USING (auth.uid()::text = user_id);

CREATE POLICY "wm_select_client_accounts" ON accounts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM client_assignments
      WHERE client_assignments.wealth_manager_id = auth.uid()::text
      AND client_assignments.client_id = accounts.user_id
    )
  );

CREATE POLICY "admin_select_all_accounts" ON accounts
  FOR SELECT USING (
    (auth.jwt() -> 'metadata' ->> 'role') = 'admin'
  );

-- ─── holdings ────────────────────────────────────────────────
ALTER TABLE holdings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_select_own_holdings" ON holdings
  FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY "users_insert_own_holdings" ON holdings
  FOR INSERT WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "users_update_own_holdings" ON holdings
  FOR UPDATE USING (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "users_delete_own_holdings" ON holdings
  FOR DELETE USING (auth.uid()::text = user_id);

CREATE POLICY "wm_select_client_holdings" ON holdings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM client_assignments
      WHERE client_assignments.wealth_manager_id = auth.uid()::text
      AND client_assignments.client_id = holdings.user_id
    )
  );

CREATE POLICY "admin_select_all_holdings" ON holdings
  FOR SELECT USING (
    (auth.jwt() -> 'metadata' ->> 'role') = 'admin'
  );

-- ─── lots ────────────────────────────────────────────────────
ALTER TABLE lots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_select_own_lots" ON lots
  FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY "users_insert_own_lots" ON lots
  FOR INSERT WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "users_update_own_lots" ON lots
  FOR UPDATE USING (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "users_delete_own_lots" ON lots
  FOR DELETE USING (auth.uid()::text = user_id);

CREATE POLICY "admin_select_all_lots" ON lots
  FOR SELECT USING (
    (auth.jwt() -> 'metadata' ->> 'role') = 'admin'
  );

-- ─── realized_transactions ──────────────────────────────────
ALTER TABLE realized_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_select_own_realized" ON realized_transactions
  FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY "users_insert_own_realized" ON realized_transactions
  FOR INSERT WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "admin_select_all_realized" ON realized_transactions
  FOR SELECT USING (
    (auth.jwt() -> 'metadata' ->> 'role') = 'admin'
  );

-- ─── households ──────────────────────────────────────────────
ALTER TABLE households ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members_select_household" ON households
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM household_members
      WHERE household_members.household_id = households.id
      AND household_members.user_id = auth.uid()::text
      AND household_members.status = 'active'
    )
  );

CREATE POLICY "creator_insert_household" ON households
  FOR INSERT WITH CHECK (auth.uid()::text = created_by);

CREATE POLICY "owner_update_household" ON households
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM household_members
      WHERE household_members.household_id = households.id
      AND household_members.user_id = auth.uid()::text
      AND household_members.role = 'owner'
    )
  );

CREATE POLICY "admin_select_all_households" ON households
  FOR SELECT USING (
    (auth.jwt() -> 'metadata' ->> 'role') = 'admin'
  );

-- ─── household_members ──────────────────────────────────────
ALTER TABLE household_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members_select_own_household_members" ON household_members
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM household_members hm2
      WHERE hm2.household_id = household_members.household_id
      AND hm2.user_id = auth.uid()::text
      AND hm2.status = 'active'
    )
  );

CREATE POLICY "owner_insert_household_members" ON household_members
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM household_members hm2
      WHERE hm2.household_id = household_members.household_id
      AND hm2.user_id = auth.uid()::text
      AND hm2.role = 'owner'
    )
  );

CREATE POLICY "owner_update_household_members" ON household_members
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM household_members hm2
      WHERE hm2.household_id = household_members.household_id
      AND hm2.user_id = auth.uid()::text
      AND hm2.role = 'owner'
    )
  );

CREATE POLICY "admin_select_all_household_members" ON household_members
  FOR SELECT USING (
    (auth.jwt() -> 'metadata' ->> 'role') = 'admin'
  );

-- ─── price_cache (public read, service-role write) ──────────
ALTER TABLE price_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone_select_price_cache" ON price_cache
  FOR SELECT USING (true);

-- ─── news_cache (public read, service-role write) ───────────
ALTER TABLE news_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone_select_news_cache" ON news_cache
  FOR SELECT USING (true);

-- ─── audit_logs (append-only) ───────────────────────────────
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "insert_audit" ON audit_logs
  FOR INSERT WITH CHECK (true);

CREATE POLICY "admin_read_audit" ON audit_logs
  FOR SELECT USING (
    (auth.jwt() -> 'metadata' ->> 'role') = 'admin'
  );

-- ─── client_assignments ─────────────────────────────────────
ALTER TABLE client_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wm_select_own_assignments" ON client_assignments
  FOR SELECT USING (auth.uid()::text = wealth_manager_id);

CREATE POLICY "client_select_own_assignments" ON client_assignments
  FOR SELECT USING (auth.uid()::text = client_id);

CREATE POLICY "admin_all_assignments" ON client_assignments
  FOR SELECT USING (
    (auth.jwt() -> 'metadata' ->> 'role') = 'admin'
  );

CREATE POLICY "admin_insert_assignments" ON client_assignments
  FOR INSERT WITH CHECK (
    (auth.jwt() -> 'metadata' ->> 'role') = 'admin'
  );

CREATE POLICY "admin_delete_assignments" ON client_assignments
  FOR DELETE USING (
    (auth.jwt() -> 'metadata' ->> 'role') = 'admin'
  );


-- ═══════════════════════════════════════════════════════════════
-- INDEXES (from docs/database.md)
-- ═══════════════════════════════════════════════════════════════

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
CREATE INDEX idx_portfolios_user_id ON portfolios(user_id);
