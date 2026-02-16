import Link from "next/link";
import { Building2, Landmark, Briefcase, FileSpreadsheet, Download } from "lucide-react";
import { getAccountsWithSummary } from "@/server/dal/accounts";
import { getPortfolios, createPortfolio } from "@/server/dal/portfolios";
import { formatCurrency } from "@/lib/utils";
import { AddAccountDialog } from "@/components/forms/add-account-dialog";

// Map custodian keys to brand-style colors for card accents
const CUSTODIAN_COLORS: Record<string, string> = {
  fidelity: "bg-emerald-500/10 text-emerald-600",
  schwab: "bg-blue-500/10 text-blue-600",
  vanguard: "bg-red-500/10 text-red-600",
  td_ameritrade: "bg-green-500/10 text-green-600",
  robinhood: "bg-lime-500/10 text-lime-600",
  coinbase: "bg-indigo-500/10 text-indigo-600",
  kraken: "bg-purple-500/10 text-purple-600",
  etrade: "bg-violet-500/10 text-violet-600",
  merrill_lynch: "bg-sky-500/10 text-sky-600",
  other: "bg-gray-500/10 text-gray-600",
};

function getCustodianColor(custodian: string) {
  return CUSTODIAN_COLORS[custodian] ?? CUSTODIAN_COLORS.other;
}

export default async function AccountsPage() {
  const [accounts, portfolios] = await Promise.all([
    getAccountsWithSummary(),
    getPortfolios(),
  ]);

  // Auto-provision a default portfolio for new users so the Add Account
  // button is always available on first visit.
  let defaultPortfolio = portfolios.find((p) => p.isDefault) ?? portfolios[0];
  if (!defaultPortfolio) {
    defaultPortfolio = await createPortfolio({
      name: "My Portfolio",
      isDefault: true,
    });
  }

  if (accounts.length === 0) {
    return (
      <div className="mx-auto max-w-7xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Accounts
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Manage your brokerage and custodian accounts.
            </p>
          </div>
        </div>

        {/* Empty State */}
        <div className="mt-16 flex flex-col items-center px-4 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
            <Landmark className="h-8 w-8 text-primary" />
          </div>

          <h2 className="mt-6 text-xl font-semibold text-foreground">
            No accounts yet
          </h2>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            Add your first brokerage, bank, or crypto account to start tracking
            your holdings and portfolio performance.
          </p>

          <div className="mt-8">
            <AddAccountDialog portfolioId={defaultPortfolio.id} />
          </div>

          {/* CSV template tip */}
          <div className="mt-6 flex w-full max-w-md items-center justify-between gap-3 rounded-lg border border-dashed border-border bg-muted/30 px-4 py-3">
            <div className="flex items-center gap-3 text-left">
              <FileSpreadsheet className="h-5 w-5 shrink-0 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium text-foreground">
                  Bulk import via CSV
                </p>
                <p className="text-xs text-muted-foreground">
                  Download our template, fill it out with your holdings, then
                  import them all at once from the Holdings page.
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
                desc: "Choose a custodian and account type.",
              },
              {
                step: "2",
                label: "Add holdings",
                desc: "One by one or bulk CSV import.",
              },
              {
                step: "3",
                label: "Track performance",
                desc: "See value, gains, and allocation.",
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

  const totalValueCents = accounts.reduce((sum, a) => sum + a.totalValueCents, 0);
  const totalHoldings = accounts.reduce((sum, a) => sum + a.holdingsCount, 0);

  return (
    <div className="mx-auto max-w-7xl">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Accounts
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {accounts.length} account{accounts.length !== 1 ? "s" : ""} · {totalHoldings} holding{totalHoldings !== 1 ? "s" : ""} · {formatCurrency(totalValueCents)} total
          </p>
        </div>

        <AddAccountDialog portfolioId={defaultPortfolio.id} />
      </div>

      {/* Account Cards Grid */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {accounts.map((account) => (
          <Link
            key={account.id}
            href={`/accounts/${account.id}`}
            className="group rounded-lg border border-border bg-card p-5 shadow-sm transition-all hover:border-primary/30 hover:shadow-md"
          >
            {/* Top row: icon + account name */}
            <div className="flex items-start gap-3">
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${getCustodianColor(account.custodian)}`}
              >
                <Building2 className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-sm font-semibold text-foreground group-hover:text-primary">
                  {account.name}
                </h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {account.custodianLabel}
                </p>
              </div>
            </div>

            {/* Account type badge */}
            <div className="mt-3">
              <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                <Briefcase className="h-3 w-3" />
                {account.accountTypeLabel}
              </span>
            </div>

            {/* Value + holdings count */}
            <div className="mt-4 flex items-end justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Total Value
                </p>
                <p className="mt-0.5 text-lg font-semibold text-foreground">
                  {formatCurrency(account.totalValueCents)}
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                {account.holdingsCount} holding{account.holdingsCount !== 1 ? "s" : ""}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
