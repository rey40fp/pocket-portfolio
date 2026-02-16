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

const USER_1 = "user_39l7CWO6FAzLaIfp0UooopxaSHL"; // Real Clerk user (Alice's data)
const USER_2 = "user_seed_bob_002";

const OLD_USER_1 = "user_seed_alice_001"; // Previous fake ID to clean up

async function seed() {
  console.log("🌱 Seeding database...\n");

  // ── Cleanup old seed data ─────────────────────────────────
  console.log("  Cleaning up old seed data...");
  for (const uid of [OLD_USER_1, USER_1, USER_2]) {
    await sql`DELETE FROM audit_logs WHERE actor_id = ${uid}`;
    await sql`DELETE FROM household_members WHERE user_id = ${uid}`;
    await sql`DELETE FROM realized_transactions WHERE user_id = ${uid}`;
    await sql`DELETE FROM lots WHERE user_id = ${uid}`;
    await sql`DELETE FROM holdings WHERE user_id = ${uid}`;
    await sql`DELETE FROM accounts WHERE user_id = ${uid}`;
    await sql`DELETE FROM portfolios WHERE user_id = ${uid}`;
  }
  await sql`DELETE FROM households WHERE created_by IN (${OLD_USER_1}, ${USER_1})`;
  await sql`DELETE FROM users WHERE id IN (${OLD_USER_1}, ${USER_2})`;
  console.log("  ✓ Old data cleaned\n");

  // ── Users ────────────────────────────────────────────────
  console.log("  Creating users...");
  await sql`
    INSERT INTO users (id, email, display_name, role) VALUES
      (${USER_1}, 'alice@example.com', 'Alice Johnson', 'user'),
      (${USER_2}, 'bob@example.com', 'Bob Smith', 'user')
    ON CONFLICT (id) DO UPDATE SET display_name = EXCLUDED.display_name
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

  // ── Price Cache ─────────────────────────────────────────
  console.log("  Seeding price cache...");

  const priceSeedData = [
    { ticker: "AAPL",  price: 23500, prevClose: 23350, name: "Apple Inc." },
    { ticker: "NVDA",  price: 13800, prevClose: 13650, name: "NVIDIA Corp." },
    { ticker: "MSFT",  price: 42500, prevClose: 42200, name: "Microsoft Corp." },
    { ticker: "JNJ",   price: 15500, prevClose: 15600, name: "Johnson & Johnson" },
    { ticker: "VTI",   price: 27500, prevClose: 27400, name: "Vanguard Total Stock Market ETF" },
    { ticker: "VXUS",  price: 6200,  prevClose: 6180,  name: "Vanguard Total International ETF" },
    { ticker: "BND",   price: 7200,  prevClose: 7210,  name: "Vanguard Total Bond ETF" },
    { ticker: "BTC",   price: 9750000, prevClose: 9680000, name: "Bitcoin" },
    { ticker: "ETH",   price: 380000,  prevClose: 375000,  name: "Ethereum" },
    { ticker: "SPY",   price: 57000, prevClose: 56800, name: "SPDR S&P 500 ETF" },
    { ticker: "QQQ",   price: 52000, prevClose: 51700, name: "Invesco QQQ Trust" },
    { ticker: "TSLA",  price: 35000, prevClose: 34500, name: "Tesla Inc." },
    { ticker: "AMZN",  price: 19500, prevClose: 19350, name: "Amazon.com Inc." },
    { ticker: "GOOGL", price: 17800, prevClose: 17650, name: "Alphabet Inc." },
  ];

  for (const p of priceSeedData) {
    const changeCents = p.price - p.prevClose;
    const changePercent = ((changeCents / p.prevClose) * 100).toFixed(4);
    await sql`
      INSERT INTO price_cache (ticker, price_cents, previous_close_cents, change_cents, change_percent, name, updated_at)
      VALUES (${p.ticker}, ${p.price}, ${p.prevClose}, ${changeCents}, ${changePercent}, ${p.name}, NOW())
      ON CONFLICT (ticker) DO UPDATE SET
        price_cents = EXCLUDED.price_cents,
        previous_close_cents = EXCLUDED.previous_close_cents,
        change_cents = EXCLUDED.change_cents,
        change_percent = EXCLUDED.change_percent,
        name = EXCLUDED.name,
        updated_at = NOW()
    `;
  }

  // ── Audit Logs ──────────────────────────────────────────
  console.log("  Creating audit log entries...");

  const auditEntries = [
    { actor: USER_1, action: "CREATE", resource: "portfolio", rid: alicePid,  meta: { name: "Alice's Portfolio" },                            ago: "10 days" },
    { actor: USER_1, action: "CREATE", resource: "account",   rid: schwabId,  meta: { name: "Schwab Brokerage", custodian: "schwab" },        ago: "10 days" },
    { actor: USER_1, action: "CREATE", resource: "account",   rid: vanguardId, meta: { name: "Vanguard Roth IRA", custodian: "vanguard" },   ago: "9 days" },
    { actor: USER_1, action: "CREATE", resource: "account",   rid: coinbaseId, meta: { name: "Coinbase Crypto", custodian: "coinbase" },     ago: "9 days" },
    { actor: USER_1, action: "CREATE", resource: "holding",   rid: aliceHoldings[0].id, meta: { ticker: "AAPL", name: "Apple Inc." },        ago: "8 days" },
    { actor: USER_1, action: "CREATE", resource: "holding",   rid: aliceHoldings[1].id, meta: { ticker: "NVDA", name: "NVIDIA Corp." },      ago: "8 days" },
    { actor: USER_1, action: "CREATE", resource: "holding",   rid: aliceHoldings[4].id, meta: { ticker: "VTI", name: "Vanguard Total Stock Market ETF" }, ago: "7 days" },
    { actor: USER_1, action: "CREATE", resource: "holding",   rid: aliceHoldings[7].id, meta: { ticker: "BTC", name: "Bitcoin" },            ago: "6 days" },
    { actor: USER_1, action: "UPDATE", resource: "holding",   rid: aliceHoldings[0].id, meta: { changes: ["shares"], ticker: "AAPL" },       ago: "3 days" },
    { actor: USER_1, action: "CREATE", resource: "household", rid: household.id, meta: { name: "Johnson-Smith Family" },                     ago: "2 days" },
    { actor: USER_1, action: "DELETE", resource: "lot",       rid: aaplLot.id, meta: { ticker: "AAPL", sharesSold: "10" },                   ago: "1 day" },
    { actor: USER_1, action: "UPDATE", resource: "account",   rid: schwabId,  meta: { changes: ["notes"], name: "Schwab Brokerage" },        ago: "5 hours" },
  ];

  for (const e of auditEntries) {
    await sql`
      INSERT INTO audit_logs (actor_id, action, resource_type, resource_id, metadata, created_at)
      VALUES (
        ${e.actor},
        ${e.action},
        ${e.resource},
        ${e.rid},
        ${JSON.stringify(e.meta)}::jsonb,
        NOW() - ${e.ago}::interval
      )
    `;
  }

  // ── Summary ──────────────────────────────────────────────
  const holdingCount = await sql`SELECT COUNT(*) as count FROM holdings`;
  const lotCount = await sql`SELECT COUNT(*) as count FROM lots`;
  const txCount = await sql`SELECT COUNT(*) as count FROM realized_transactions`;

  const priceCount = await sql`SELECT COUNT(*) as count FROM price_cache`;
  const auditCount = await sql`SELECT COUNT(*) as count FROM audit_logs`;

  console.log(`\n🎉 Seed complete!`);
  console.log(`   Users: 2 (Alice = ${USER_1})`);
  console.log(`   Accounts: 6`);
  console.log(`   Holdings: ${holdingCount[0].count}`);
  console.log(`   Lots: ${lotCount[0].count}`);
  console.log(`   Realized transactions: ${txCount[0].count}`);
  console.log(`   Price cache: ${priceCount[0].count} tickers`);
  console.log(`   Audit logs: ${auditCount[0].count}`);
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
