import Link from "next/link";
import { Package, Receipt, FileSpreadsheet, Download } from "lucide-react";
import { getAllHoldingsWithDetails } from "@/server/dal/holdings";
import { getAccountsWithSummary } from "@/server/dal/accounts";
import { formatCurrency } from "@/lib/utils";
import { HoldingsDataTable } from "@/components/dashboard/holdings-data-table";
import { AddHoldingDialog } from "@/components/forms/add-holding-dialog";
import { CsvImportDialog } from "@/components/forms/csv-import-dialog";

export default async function HoldingsPage() {
  const [holdings, accountSummaries] = await Promise.all([
    getAllHoldingsWithDetails(),
    getAccountsWithSummary(),
  ]);

  const accountOptions = accountSummaries.map((a) => ({
    id: a.id,
    name: a.name,
    custodianLabel: a.custodianLabel,
  }));

  if (holdings.length === 0) {
    return (
      <div className="mx-auto max-w-7xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Holdings
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              View and manage all your positions across accounts.
            </p>
          </div>
        </div>

        {/* Empty State */}
        <div className="mt-16 flex flex-col items-center px-4 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
            <Package className="h-8 w-8 text-primary" />
          </div>

          <h2 className="mt-6 text-xl font-semibold text-foreground">
            No holdings yet
          </h2>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            Your holdings will appear here once you add positions to your
            accounts. Add them one by one or bulk-import from a CSV file.
          </p>

          {accountOptions.length > 0 && (
            <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
              <AddHoldingDialog accounts={accountOptions} />
              <CsvImportDialog accounts={accountOptions} />
            </div>
          )}

          {/* CSV template download tip */}
          <div className="mt-6 flex w-full max-w-md items-center justify-between gap-3 rounded-lg border border-dashed border-border bg-muted/30 px-4 py-3">
            <div className="flex items-center gap-3 text-left">
              <FileSpreadsheet className="h-5 w-5 shrink-0 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium text-foreground">
                  Prefer a spreadsheet?
                </p>
                <p className="text-xs text-muted-foreground">
                  Download our CSV template, fill in your positions, and
                  import them all at once.
                </p>
              </div>
            </div>
            <a
              href="/templates/holdings-import-template.csv"
              download="holdings-import-template.csv"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent"
            >
              <Download className="h-3.5 w-3.5" />
              Template
            </a>
          </div>

          <div className="mt-12 grid w-full max-w-lg gap-3 text-left sm:grid-cols-3">
            {[
              {
                step: "1",
                label: "Create an account",
                desc: "Set up a brokerage or custodian.",
              },
              {
                step: "2",
                label: "Add holdings",
                desc: "One by one or bulk CSV import.",
              },
              {
                step: "3",
                label: "Track everything",
                desc: "Monitor value, gain/loss, allocation.",
              },
            ].map((item) => (
              <div
                key={item.step}
                className="rounded-lg border border-border bg-card p-4 shadow-sm"
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                  {item.step}
                </div>
                <p className="mt-2 text-sm font-medium text-foreground">
                  {item.label}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const totalValueCents = holdings.reduce((sum, h) => sum + h.marketValueCents, 0);
  const totalGainLossCents = holdings.reduce((sum, h) => sum + h.gainLossCents, 0);
  const uniqueAccounts = new Set(holdings.map((h) => h.accountId)).size;

  return (
    <div className="mx-auto max-w-7xl">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Holdings
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {holdings.length} position{holdings.length !== 1 ? "s" : ""} across{" "}
            {uniqueAccounts} account{uniqueAccounts !== 1 ? "s" : ""} ·{" "}
            {formatCurrency(totalValueCents)} total ·{" "}
            <span
              className={
                totalGainLossCents > 0
                  ? "text-gain"
                  : totalGainLossCents < 0
                    ? "text-loss"
                    : ""
              }
            >
              {formatCurrency(totalGainLossCents, { showSign: true })} gain/loss
            </span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/holdings/realized"
            className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            <Receipt className="h-4 w-4" />
            Realized
          </Link>
          {accountOptions.length > 0 && (
            <>
              <CsvImportDialog accounts={accountOptions} />
              <AddHoldingDialog accounts={accountOptions} />
            </>
          )}
        </div>
      </div>

      {/* DataTable */}
      <div className="mt-6">
        <HoldingsDataTable data={holdings} />
      </div>
    </div>
  );
}
