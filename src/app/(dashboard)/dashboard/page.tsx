import Link from "next/link";
import { Wallet, PlusCircle, FileSpreadsheet, Download, Upload } from "lucide-react";
import { getDashboardKPIs, getNetWorthHistory, getAssetAllocation, getTopMovers, getRecentActivity } from "@/server/dal/dashboard";
import { ensureUserSynced } from "@/server/dal/users";
import { DashboardKPICards } from "@/components/dashboard/kpi-cards";
import { NetWorthChart } from "@/components/dashboard/net-worth-chart";
import { AssetAllocationChart } from "@/components/dashboard/asset-allocation-chart";
import { TopMovers } from "@/components/dashboard/top-movers";
import { RecentActivity } from "@/components/dashboard/recent-activity";
import { CsvImportDialog } from "@/components/forms/csv-import-dialog";

export default async function DashboardPage() {
  // Ensure the Clerk user exists in the DB before any queries
  await ensureUserSynced();

  const [kpis, allocation, topMovers, recentActivity] = await Promise.all([
    getDashboardKPIs(),
    getAssetAllocation(),
    getTopMovers(),
    getRecentActivity(),
  ]);

  const isEmpty =
    kpis.netWorthCents === 0 &&
    kpis.totalCostBasisCents === 0 &&
    allocation.length === 0;

  if (isEmpty) {
    return (
      <div className="mx-auto max-w-7xl">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Dashboard
        </h1>

        <div className="mt-16 flex flex-col items-center px-4 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
            <Wallet className="h-8 w-8 text-primary" />
          </div>

          <h2 className="mt-6 text-xl font-semibold text-foreground">
            Welcome to Pocket Portfolio
          </h2>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            Track all your investments in one place — stocks, crypto, real estate,
            and more. Get started by adding your first brokerage account.
          </p>

          <Link
            href="/accounts"
            className="mt-8 inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <PlusCircle className="h-4 w-4" />
            Add your first account
          </Link>

          {/* CSV import section */}
          <div className="mt-6 flex w-full max-w-md flex-col gap-3 rounded-lg border border-dashed border-border bg-muted/30 px-4 py-3">
            <div className="flex items-center gap-3 text-left">
              <FileSpreadsheet className="h-5 w-5 shrink-0 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium text-foreground">
                  Have a spreadsheet?
                </p>
                <p className="text-xs text-muted-foreground">
                  Download our CSV template, fill it out, then import
                  everything at once. Accounts are created automatically.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <a
                href="/templates/holdings-import-template.csv"
                download="holdings-import-template.csv"
                className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent"
              >
                <Download className="h-3.5 w-3.5" />
                Download Template
              </a>
              <CsvImportDialog
                trigger={
                  <button className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90">
                    <Upload className="h-3.5 w-3.5" />
                    Import CSV
                  </button>
                }
              />
            </div>
          </div>

          <div className="mt-12 grid w-full max-w-lg gap-3 text-left sm:grid-cols-3">
            {[
              { step: "1", label: "Add an account", desc: "Schwab, Fidelity, Coinbase, etc." },
              { step: "2", label: "Add holdings", desc: "One by one or bulk CSV import." },
              { step: "3", label: "Track growth", desc: "See net worth, gains, and allocation." },
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

  const netWorthHistory = await getNetWorthHistory(
    kpis.netWorthCents,
    kpis.totalCostBasisCents,
  );

  return (
    <div className="mx-auto max-w-7xl">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        Dashboard
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Your portfolio at a glance.
      </p>

      {/* KPI Cards */}
      <section className="mt-6" aria-label="Key portfolio metrics">
        <DashboardKPICards kpis={kpis} />
      </section>

      {/* Charts */}
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {/* Net Worth History */}
        <section className="lg:col-span-1" aria-label="Net worth history chart">
          <NetWorthChart data={netWorthHistory} />
        </section>

        {/* Asset Allocation */}
        <section className="lg:col-span-1" aria-label="Asset allocation breakdown">
          <AssetAllocationChart data={allocation} />
        </section>
      </div>

      {/* Top Movers + Recent Activity */}
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <section aria-label="Top movers today">
          <TopMovers data={topMovers} />
        </section>
        <section aria-label="Recent activity">
          <RecentActivity entries={recentActivity} />
        </section>
      </div>
    </div>
  );
}
