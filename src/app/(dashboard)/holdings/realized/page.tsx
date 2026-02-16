import Link from "next/link";
import {
  ArrowLeft,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Minus,
  BarChart3,
  Hash,
  Receipt,
} from "lucide-react";
import { getRealizedTransactions } from "@/server/dal/lots";
import type { RealizedTransactionRow } from "@/server/dal/lots";
import { formatCurrency, formatPercent, formatShares, cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

// ─── KPI Card ──────────────────────────────────────────────────────

interface KPICardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
  trend?: number;
}

function KPICard({ title, value, subtitle, icon: CardIcon, trend }: KPICardProps) {
  const trendColor =
    trend === undefined
      ? ""
      : trend > 0
        ? "text-gain"
        : trend < 0
          ? "text-loss"
          : "text-muted-foreground";

  return (
    <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
          <CardIcon className="h-5 w-5 text-primary" />
        </div>
      </div>
      <p
        className={cn(
          "mt-2 text-2xl font-bold tracking-tight",
          trendColor || "text-foreground",
        )}
      >
        {value}
      </p>
      {subtitle && (
        <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
      )}
    </div>
  );
}

// ─── Transaction Table ─────────────────────────────────────────────

function TransactionTable({
  transactions,
}: {
  transactions: RealizedTransactionRow[];
}) {
  return (
    <div className="rounded-lg border border-border bg-card shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                Name / Ticker
              </th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                Type
              </th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                Shares Sold
              </th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                Cost Basis
              </th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                Proceeds
              </th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                Realized G/L
              </th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                Date Sold
              </th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                Account
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {transactions.map((tx) => {
              const isGain = tx.realizedGainLossCents > 0;
              const isLoss = tx.realizedGainLossCents < 0;
              const TrendIcon = isGain
                ? TrendingUp
                : isLoss
                  ? TrendingDown
                  : Minus;
              const trendColor = isGain
                ? "text-gain"
                : isLoss
                  ? "text-loss"
                  : "text-muted-foreground";

              return (
                <tr
                  key={tx.id}
                  className="transition-colors hover:bg-muted/30"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/holdings/${tx.holdingId}`}
                      className="group block"
                    >
                      <div className="flex flex-col">
                        {tx.ticker && (
                          <span className="font-semibold text-foreground group-hover:text-primary">
                            {tx.ticker}
                          </span>
                        )}
                        <span
                          className={cn(
                            "text-muted-foreground",
                            tx.ticker
                              ? "text-xs"
                              : "font-medium text-foreground group-hover:text-primary",
                          )}
                        >
                          {tx.holdingName}
                        </span>
                      </div>
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      variant="secondary"
                      className="rounded-md font-normal"
                    >
                      {tx.assetTypeLabel}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-foreground">
                    {tx.sharesSold > 0 ? formatShares(tx.sharesSold) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-foreground">
                    {formatCurrency(tx.costBasisCents)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-medium text-foreground">
                    {formatCurrency(tx.proceedsCents)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <TrendIcon
                        className={cn("h-3.5 w-3.5", trendColor)}
                      />
                      <span
                        className={cn(
                          "tabular-nums font-medium",
                          trendColor,
                        )}
                      >
                        {formatCurrency(tx.realizedGainLossCents, {
                          showSign: true,
                        })}
                      </span>
                      <span className={cn("text-xs", trendColor)}>
                        (
                        {formatPercent(tx.realizedGainLossPercent, {
                          showSign: true,
                        })}
                        )
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-foreground">
                    {tx.soldAt.toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm text-foreground">
                      {tx.custodianLabel}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {tx.accountName}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────

export default async function RealizedTransactionsPage() {
  const transactions = await getRealizedTransactions();

  if (transactions.length === 0) {
    return (
      <div className="mx-auto max-w-7xl">
        <div>
          <Link
            href="/holdings"
            className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            All Holdings
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Realized Transactions
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Track all your sold positions and realized gains/losses.
          </p>
        </div>

        {/* Empty State */}
        <div className="mt-16 flex flex-col items-center px-4 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
            <Receipt className="h-8 w-8 text-primary" />
          </div>

          <h2 className="mt-6 text-xl font-semibold text-foreground">
            No realized transactions yet
          </h2>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            When you sell or liquidate positions, the realized gains and losses
            will appear here. Use the Liquidate button on any holding detail
            page to record a sale.
          </p>

          <Link
            href="/holdings"
            className="mt-8 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <ArrowLeft className="h-4 w-4" />
            Go to Holdings
          </Link>
        </div>
      </div>
    );
  }

  // ── Compute KPIs ──
  const totalProceedsCents = transactions.reduce(
    (sum, tx) => sum + tx.proceedsCents,
    0,
  );
  const totalCostBasisCents = transactions.reduce(
    (sum, tx) => sum + tx.costBasisCents,
    0,
  );
  const totalRealizedGainLossCents = transactions.reduce(
    (sum, tx) => sum + tx.realizedGainLossCents,
    0,
  );
  const totalRealizedPercent =
    totalCostBasisCents !== 0
      ? (totalRealizedGainLossCents / totalCostBasisCents) * 100
      : 0;

  // Gains vs losses breakdown
  const totalGains = transactions
    .filter((tx) => tx.realizedGainLossCents > 0)
    .reduce((sum, tx) => sum + tx.realizedGainLossCents, 0);
  const totalLosses = transactions
    .filter((tx) => tx.realizedGainLossCents < 0)
    .reduce((sum, tx) => sum + tx.realizedGainLossCents, 0);

  return (
    <div className="mx-auto max-w-7xl">
      {/* Header */}
      <div>
        <Link
          href="/holdings"
          className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          All Holdings
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Realized Transactions
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {transactions.length} transaction
          {transactions.length !== 1 ? "s" : ""} · Total cashed out{" "}
          {formatCurrency(totalProceedsCents)}
        </p>
      </div>

      {/* KPI Cards */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard
          title="Total Cashed Out"
          value={formatCurrency(totalProceedsCents)}
          subtitle={`from ${transactions.length} transaction${transactions.length !== 1 ? "s" : ""}`}
          icon={DollarSign}
        />
        <KPICard
          title="Total Cost Basis"
          value={formatCurrency(totalCostBasisCents)}
          icon={BarChart3}
        />
        <KPICard
          title="Net Realized G/L"
          value={formatCurrency(totalRealizedGainLossCents, { showSign: true })}
          subtitle={formatPercent(totalRealizedPercent, { showSign: true })}
          icon={totalRealizedGainLossCents >= 0 ? TrendingUp : TrendingDown}
          trend={totalRealizedGainLossCents}
        />
        <KPICard
          title="Wins / Losses"
          value={`${formatCurrency(totalGains, { showSign: true })}`}
          subtitle={
            totalLosses !== 0
              ? `${formatCurrency(totalLosses, { showSign: true })} in losses`
              : "No losses"
          }
          icon={Hash}
        />
      </div>

      {/* Transactions Table */}
      <div className="mt-6">
        <TransactionTable transactions={transactions} />
      </div>

      {/* Summary footer */}
      <div className="mt-4 text-xs text-muted-foreground">
        Showing {transactions.length} realized transaction
        {transactions.length !== 1 ? "s" : ""}
      </div>
    </div>
  );
}
