import Link from "next/link";
import { BarChart3, PlusCircle } from "lucide-react";
import { ensureUserSynced } from "@/server/dal/users";
import { getDashboardKPIs } from "@/server/dal/dashboard";
import { getPortfolioValueHistory } from "@/server/dal/analytics";
import { PortfolioValueChart } from "@/components/dashboard/portfolio-value-chart";

export default async function AnalyticsPage() {
  await ensureUserSynced();

  const [kpis, valueHistory] = await Promise.all([
    getDashboardKPIs(),
    getPortfolioValueHistory(),
  ]);

  const isEmpty =
    kpis.netWorthCents === 0 &&
    kpis.totalCostBasisCents === 0;

  if (isEmpty) {
    return (
      <div className="mx-auto max-w-7xl">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Analytics
        </h1>

        <div className="mt-16 flex flex-col items-center px-4 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
            <BarChart3 className="h-8 w-8 text-primary" />
          </div>

          <h2 className="mt-6 text-xl font-semibold text-foreground">
            No data to analyze yet
          </h2>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            Add some holdings to your portfolio and analytics will appear here
            — track your portfolio value, returns, and performance over time.
          </p>

          <Link
            href="/accounts"
            className="mt-8 inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <PlusCircle className="h-4 w-4" />
            Add your first account
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Analytics
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Analyze your portfolio performance and investment returns.
        </p>
      </div>

      {/* Portfolio Value Over Time */}
      <section className="mt-6" aria-label="Portfolio value over time">
        <PortfolioValueChart data={valueHistory} />
      </section>
    </div>
  );
}
