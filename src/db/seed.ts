/* eslint-disable no-console */
/**
 * Seed script — populates the database with sample data.
 * Creates 2 users, 3 accounts each, 10-15 holdings, and some realized transactions.
 *
 * Usage: npx tsx src/db/seed.ts
 */
import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env.local" });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL is not set in .env.local");
  process.exit(1);
}

const sql = postgres(DATABASE_URL, { max: 1 });

// ─── Sample Data ─────────────────────────────────────────────

const USER_1 = "user_seed_alice_001";
const USER_2 = "user_seed_bob_002";

async function seed() {
  console.log("🌱 Seeding database...\n");

  // ── Users ────────────────────────────────────────────────
  console.log("  Creating users...");
  await sql`
    INSERT INTO users (id, email, display_name, role) VALUES
      (${USER_1}, 'alice@example.com', 'Alice Johnson', 'user'),
      (${USER_2}, 'bob@example.com', 'Bob Smith', 'user')
    ON CONFLICT (id) DO NOTHING
  `;

  // ── Portfolios ───────────────────────────────────────────
  console.log("  Creating portfolios...");

  const [alicePortfolio] = await sql`
    INSERT INTO portfolios (user_id, name, description, is_default)
    VALUES (${USER_1}, 'Alice''s Portfolio', 'Main investment portfolio', true)
    ON CONFLICT DO NOTHING
    RETURNING id
  `;
  const [bobPortfolio] = await sql`
    INSERT INTO portfolios (user_id, name, description, is_default)
    VALUES (${USER_2}, 'Bob''s Portfolio', 'Primary holdings', true)
    ON CONFLICT DO NOTHING
    RETURNING id
  `;

  const alicePid = alicePortfolio?.id;
  const bobPid = bobPortfolio?.id;

  if (!alicePid || !bobPid) {
    console.log("  ⏭ Portfolios already exist, fetching IDs...");
    const existing = await sql`SELECT id, user_id FROM portfolios WHERE user_id IN (${USER_1}, ${USER_2})`;
    const map = Object.fromEntries(existing.map((r) => [r.user_id, r.id]));
    if (!map[USER_1] || !map[USER_2]) {
      console.error("❌ Could not find or create portfolios");
      process.exit(1);
    }
    return seedAccounts(map[USER_1], map[USER_2]);
  }

  return seedAccounts(alicePid, bobPid);
}

async function seedAccounts(alicePid: string, bobPid: string) {
  // ── Accounts (3 per user) ────────────────────────────────
  console.log("  Creating accounts...");

  const aliceAccounts = await sql`
    INSERT INTO accounts (portfolio_id, user_id, name, custodian, account_type) VALUES
      (${alicePid}, ${USER_1}, 'Schwab Brokerage', 'schwab', 'individual'),
      (${alicePid}, ${USER_1}, 'Vanguard Roth IRA', 'vanguard', 'roth_ira'),
      (${alicePid}, ${USER_1}, 'Coinbase Crypto', 'coinbase', 'crypto_wallet')
    RETURNING id, name
  `;

  const bobAccounts = await sql`
    INSERT INTO accounts (portfolio_id, user_id, name, custodian, account_type) VALUES
      (${bobPid}, ${USER_2}, 'Fidelity 401k', 'fidelity', '401k'),
      (${bobPid}, ${USER_2}, 'Robinhood Brokerage', 'robinhood', 'individual'),
      (${bobPid}, ${USER_2}, 'Chase Savings', 'other', 'bank')
    RETURNING id, name
  `;

  console.log(`    Alice: ${aliceAccounts.map((a) => a.name).join(", ")}`);
  console.log(`    Bob:   ${bobAccounts.map((a) => a.name).join(", ")}`);

  // ── Holdings + Lots (Alice) ──────────────────────────────
  console.log("  Creating holdings and lots...");

  const schwabId = aliceAccounts[0].id;
  const vanguardId = aliceAccounts[1].id;
  const coinbaseId = aliceAccounts[2].id;

  // Alice — Schwab Brokerage (stocks)
  const aliceHoldings = await sql`
    INSERT INTO holdings (account_id, user_id, ticker, name, asset_type, sector) VALUES
      (${schwabId}, ${USER_1}, 'AAPL', 'Apple Inc.', 'stock', 'technology'),
      (${schwabId}, ${USER_1}, 'NVDA', 'NVIDIA Corp.', 'stock', 'technology'),
      (${schwabId}, ${USER_1}, 'MSFT', 'Microsoft Corp.', 'stock', 'technology'),
      (${schwabId}, ${USER_1}, 'JNJ', 'Johnson & Johnson', 'stock', 'healthcare'),
      (${vanguardId}, ${USER_1}, 'VTI', 'Vanguard Total Stock Market ETF', 'etf', 'financials'),
      (${vanguardId}, ${USER_1}, 'VXUS', 'Vanguard Total International ETF', 'etf', 'financials'),
      (${vanguardId}, ${USER_1}, 'BND', 'Vanguard Total Bond ETF', 'bond', 'financials'),
      (${coinbaseId}, ${USER_1}, 'BTC', 'Bitcoin', 'crypto', NULL),
      (${coinbaseId}, ${USER_1}, 'ETH', 'Ethereum', 'crypto', NULL)
    RETURNING id, ticker
  `;

  // Alice lots
  const aliceLotValues = [
    // AAPL: 2 lots
    { holdingIdx: 0, shares: "50.00000000", costBasis: 875000, costPerShare: 17500, acquired: "2023-03-15" },
    { holdingIdx: 0, shares: "25.00000000", costBasis: 487500, costPerShare: 19500, acquired: "2024-01-10" },
    // NVDA: 1 lot
    { holdingIdx: 1, shares: "30.00000000", costBasis: 1200000, costPerShare: 40000, acquired: "2023-06-01" },
    // MSFT: 1 lot
    { holdingIdx: 2, shares: "20.00000000", costBasis: 680000, costPerShare: 34000, acquired: "2023-08-20" },
    // JNJ: 1 lot
    { holdingIdx: 3, shares: "40.00000000", costBasis: 640000, costPerShare: 16000, acquired: "2022-11-05" },
    // VTI: 1 lot
    { holdingIdx: 4, shares: "100.00000000", costBasis: 2200000, costPerShare: 22000, acquired: "2022-01-15" },
    // VXUS: 1 lot
    { holdingIdx: 5, shares: "150.00000000", costBasis: 825000, costPerShare: 5500, acquired: "2022-01-15" },
    // BND: 1 lot
    { holdingIdx: 6, shares: "80.00000000", costBasis: 600000, costPerShare: 7500, acquired: "2023-02-01" },
    // BTC: 1 lot
    { holdingIdx: 7, shares: "0.50000000", costBasis: 1500000, costPerShare: 3000000, acquired: "2023-04-01" },
    // ETH: 1 lot
    { holdingIdx: 8, shares: "3.00000000", costBasis: 540000, costPerShare: 180000, acquired: "2023-07-15" },
  ];

  for (const lot of aliceLotValues) {
    const holdingId = aliceHoldings[lot.holdingIdx].id;
    await sql`
      INSERT INTO lots (holding_id, user_id, shares, cost_basis_cents, cost_per_share_cents, acquired_at)
      VALUES (${holdingId}, ${USER_1}, ${lot.shares}, ${lot.costBasis}, ${lot.costPerShare}, ${lot.acquired})
    `;
  }

  // ── Holdings + Lots (Bob) ────────────────────────────────
  const fidelityId = bobAccounts[0].id;
  const robinhoodId = bobAccounts[1].id;
  const chaseId = bobAccounts[2].id;

  // Bob — Fidelity 401k (index funds)
  const bobHoldings = await sql`
    INSERT INTO holdings (account_id, user_id, ticker, name, asset_type, sector) VALUES
      (${fidelityId}, ${USER_2}, 'SPY', 'SPDR S&P 500 ETF', 'etf', 'financials'),
      (${fidelityId}, ${USER_2}, 'QQQ', 'Invesco QQQ Trust', 'etf', 'technology'),
      (${robinhoodId}, ${USER_2}, 'TSLA', 'Tesla Inc.', 'stock', 'consumer_discretionary'),
      (${robinhoodId}, ${USER_2}, 'AMZN', 'Amazon.com Inc.', 'stock', 'consumer_discretionary'),
      (${robinhoodId}, ${USER_2}, 'GOOGL', 'Alphabet Inc.', 'stock', 'communication_services')
    RETURNING id, ticker
  `;

  // Bob — Chase Savings (cash)
  const [chaseCashHolding] = await sql`
    INSERT INTO holdings (account_id, user_id, name, asset_type)
    VALUES (${chaseId}, ${USER_2}, 'Chase High-Yield Savings', 'cash')
    RETURNING id
  `;

  const bobLotValues = [
    // SPY
    { holdingIdx: 0, shares: "50.00000000", costBasis: 2200000, costPerShare: 44000, acquired: "2022-06-01" },
    // QQQ
    { holdingIdx: 1, shares: "30.00000000", costBasis: 1050000, costPerShare: 35000, acquired: "2022-09-15" },
    // TSLA: 2 lots
    { holdingIdx: 2, shares: "15.00000000", costBasis: 375000, costPerShare: 25000, acquired: "2023-01-20" },
    { holdingIdx: 2, shares: "10.00000000", costBasis: 180000, costPerShare: 18000, acquired: "2024-03-01" },
    // AMZN
    { holdingIdx: 3, shares: "20.00000000", costBasis: 2600000, costPerShare: 130000, acquired: "2023-05-10" },
    // GOOGL
    { holdingIdx: 4, shares: "25.00000000", costBasis: 2750000, costPerShare: 110000, acquired: "2023-07-01" },
  ];

  for (const lot of bobLotValues) {
    const holdingId = bobHoldings[lot.holdingIdx].id;
    await sql`
      INSERT INTO lots (holding_id, user_id, shares, cost_basis_cents, cost_per_share_cents, acquired_at)
      VALUES (${holdingId}, ${USER_2}, ${lot.shares}, ${lot.costBasis}, ${lot.costPerShare}, ${lot.acquired})
    `;
  }

  // Bob — Cash lot (no shares, just current value)
  await sql`
    INSERT INTO lots (holding_id, user_id, cost_basis_cents, current_value_cents, interest_rate_bps)
    VALUES (${chaseCashHolding.id}, ${USER_2}, 5000000, 5000000, 450)
  `;

  // ── Realized Transactions ────────────────────────────────
  console.log("  Creating realized transactions...");

  // Alice sold 10 shares of AAPL from her first lot
  const aaplHoldingId = aliceHoldings[0].id;
  const [aaplLot] = await sql`
    SELECT id FROM lots WHERE holding_id = ${aaplHoldingId} ORDER BY acquired_at ASC LIMIT 1
  `;

  await sql`
    INSERT INTO realized_transactions
      (lot_id, holding_id, user_id, shares_sold, sell_price_cents, total_proceeds_cents, cost_basis_cents, fees_cents, realized_gain_cents, sold_at)
    VALUES
      (${aaplLot.id}, ${aaplHoldingId}, ${USER_1}, '10.00000000', 22000, 220000, 175000, 499, 44501, '2024-06-15')
  `;

  // Bob sold 5 shares of TSLA from his first lot
  const tslaHoldingId = bobHoldings[2].id;
  const [tslaLot] = await sql`
    SELECT id FROM lots WHERE holding_id = ${tslaHoldingId} ORDER BY acquired_at ASC LIMIT 1
  `;

  await sql`
    INSERT INTO realized_transactions
      (lot_id, holding_id, user_id, shares_sold, sell_price_cents, total_proceeds_cents, cost_basis_cents, fees_cents, realized_gain_cents, sold_at)
    VALUES
      (${tslaLot.id}, ${tslaHoldingId}, ${USER_2}, '5.00000000', 28000, 140000, 125000, 0, 15000, '2024-09-01')
  `;

  // ── Household ────────────────────────────────────────────
  console.log("  Creating sample household...");

  const [household] = await sql`
    INSERT INTO households (name, created_by)
    VALUES ('Johnson-Smith Family', ${USER_1})
    RETURNING id
  `;

  await sql`
    INSERT INTO household_members (household_id, user_id, role, status, accepted_at) VALUES
      (${household.id}, ${USER_1}, 'owner', 'active', NOW()),
      (${household.id}, ${USER_2}, 'member', 'active', NOW())
  `;

  // ── Summary ──────────────────────────────────────────────
  const holdingCount = await sql`SELECT COUNT(*) as count FROM holdings`;
  const lotCount = await sql`SELECT COUNT(*) as count FROM lots`;
  const txCount = await sql`SELECT COUNT(*) as count FROM realized_transactions`;

  console.log(`\n🎉 Seed complete!`);
  console.log(`   Users: 2`);
  console.log(`   Accounts: 6`);
  console.log(`   Holdings: ${holdingCount[0].count}`);
  console.log(`   Lots: ${lotCount[0].count}`);
  console.log(`   Realized transactions: ${txCount[0].count}`);
  console.log(`   Household: 1 (2 members)`);
}

async function main() {
  try {
    await seed();
  } catch (error) {
    console.error("\n💥 Seed failed:", error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

main();
