import { TrendingUp, TrendingDown, Minus, DollarSign, ArrowUpDown, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency, formatPercent } from "@/lib/utils";
import type { DashboardKPIs } from "@/server/dal/dashboard";

// ─── Helpers ─────────────────────────────────────────────────────────

function getTrendInfo(value: number) {
  if (value > 0) return { Icon: TrendingUp, color: "text-gain", bgColor: "bg-gain/10" };
  if (value < 0) return { Icon: TrendingDown, color: "text-loss", bgColor: "bg-loss/10" };
  return { Icon: Minus, color: "text-muted-foreground", bgColor: "bg-muted" };
}

// ─── KPI Card ────────────────────────────────────────────────────────

interface KPICardProps {
  title: string;
  value: string;
  change?: string;
  changePercent?: string;
  changeValue?: number;
  icon: React.ComponentType<{ className?: string }>;
}

function KPICard({ title, value, change, changePercent, changeValue = 0, icon: CardIcon }: KPICardProps) {
  const trend = getTrendInfo(changeValue);

  return (
    <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
          <CardIcon className="h-5 w-5 text-primary" />
        </div>
      </div>

      <p className="mt-3 text-2xl font-bold tracking-tight text-foreground">
        {value}
      </p>

      {(change || changePercent) && (
        <div className="mt-2 flex items-center gap-1.5">
          <div className={cn("flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium", trend.bgColor, trend.color)}>
            <trend.Icon className="h-3.5 w-3.5" />
            {changePercent}
          </div>
          {change && (
            <span className={cn("text-xs font-medium", trend.color)}>
              {change}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Dashboard KPI Cards Grid ────────────────────────────────────────

interface DashboardKPICardsProps {
  kpis: DashboardKPIs;
}

export function DashboardKPICards({ kpis }: DashboardKPICardsProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {/* Net Worth */}
      <KPICard
        title="Net Worth"
        value={formatCurrency(kpis.netWorthCents)}
        change={formatCurrency(kpis.dayChangeCents, { showSign: true })}
        changePercent={formatPercent(kpis.dayChangePercent, { showSign: true })}
        changeValue={kpis.dayChangeCents}
        icon={DollarSign}
      />

      {/* Day Change */}
      <KPICard
        title="Day Change"
        value={formatCurrency(kpis.dayChangeCents, { showSign: true })}
        changePercent={formatPercent(kpis.dayChangePercent, { showSign: true })}
        changeValue={kpis.dayChangeCents}
        icon={ArrowUpDown}
      />

      {/* Total Gain/Loss (Unrealized) */}
      <KPICard
        title="Total Gain/Loss"
        value={formatCurrency(kpis.totalGainLossCents, { showSign: true })}
        change={`on ${formatCurrency(kpis.totalCostBasisCents)} invested`}
        changePercent={formatPercent(kpis.totalGainLossPercent, { showSign: true })}
        changeValue={kpis.totalGainLossCents}
        icon={BarChart3}
      />
    </div>
  );
}
