/* eslint-disable no-console */
/**
 * Database setup script.
 * Runs the Drizzle migration then applies RLS policies, indexes, and triggers.
 *
 * Usage: npx tsx src/db/setup.ts
 */
import { config } from "dotenv";
import { readFileSync } from "fs";
import { join } from "path";
import postgres from "postgres";

config({ path: ".env.local" });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL is not set in .env.local");
  process.exit(1);
}

const sql = postgres(DATABASE_URL, { max: 1 });

function splitSql(content: string): string[] {
  const statements: string[] = [];
  let current = "";
  let inDollarQuote = false;

  for (const line of content.split("\n")) {
    const trimmed = line.trim();

    // Skip pure comment lines outside of dollar-quoted blocks
    if (!inDollarQuote && (trimmed.startsWith("--") || trimmed.length === 0)) {
      // Keep the line if we're building a statement (could be inside a CREATE)
      if (current.trim().length > 0) current += "\n" + line;
      continue;
    }

    // Track $$ dollar-quoting (used in PL/pgSQL function bodies)
    const dollarMatches = line.match(/\$\$/g);
    if (dollarMatches) {
      for (const _ of dollarMatches) inDollarQuote = !inDollarQuote;
    }

    current += (current ? "\n" : "") + line;

    // Statement ends at semicolon ONLY when not inside $$ block
    if (!inDollarQuote && trimmed.endsWith(";")) {
      const stmt = current.trim().replace(/--> statement-breakpoint/g, "").trim();
      if (stmt.length > 1) statements.push(stmt);
      current = "";
    }
  }

  // Handle any remaining content
  const remaining = current.trim().replace(/--> statement-breakpoint/g, "").trim();
  if (remaining.length > 1) statements.push(remaining);

  return statements;
}

async function runSqlFile(filename: string, label: string) {
  const filePath = join(process.cwd(), "src/db/migrations", filename);
  const content = readFileSync(filePath, "utf-8");

  const statements = splitSql(content);

  console.log(`\n📄 Running ${label} (${statements.length} statements)...`);

  for (const statement of statements) {
    try {
      await sql.unsafe(statement);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      // Skip "already exists" errors for idempotency
      if (
        msg.includes("already exists") ||
        msg.includes("duplicate key") ||
        msg.includes("does not exist")
      ) {
        const preview = statement.slice(0, 60).replace(/\n/g, " ");
        console.log(`  ⏭ Skipped (already exists): ${preview}...`);
      } else {
        console.error(`  ❌ Error on statement:`);
        console.error(`     ${statement.slice(0, 100)}...`);
        console.error(`     ${msg}`);
        throw error;
      }
    }
  }

  console.log(`✅ ${label} complete`);
}

async function main() {
  console.log("🚀 Pocket Portfolio — Database Setup");
  console.log("=====================================");

  try {
    // Drop any leftover test table from initial scaffolding
    await sql`DROP TABLE IF EXISTS pocket_portfolio CASCADE`;

    // Run Drizzle schema migration
    await runSqlFile("0000_dry_shen.sql", "Schema migration");

    // Run RLS policies, indexes, and triggers
    await runSqlFile("0001_rls_indexes_triggers.sql", "RLS + Indexes + Triggers");

    console.log("\n🎉 Database setup complete!");
  } catch (error) {
    console.error("\n💥 Setup failed:", error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

main();
