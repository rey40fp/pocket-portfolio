import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Minus,
  BarChart3,
  Hash,
  Building2,
  Briefcase,
} from "lucide-react";
import { getAccountDetailData } from "@/server/dal/accounts";
import type { AccountHoldingRow } from "@/server/dal/accounts";
import { MARKET_ASSET_TYPES, type AssetType } from "@/lib/constants";
import { formatCurrency, formatPercent, formatShares, cn } from "@/lib/utils";
import { AssetAllocationChart } from "@/components/dashboard/asset-allocation-chart";
import { EditAccountDialog } from "@/components/forms/edit-account-dialog";
import { DeleteAccountDialog } from "@/components/forms/delete-account-dialog";
import { AddHoldingDialog } from "@/components/forms/add-holding-dialog";
import { HoldingRowActions } from "@/components/shared/holding-row-actions";

// ─── KPI Card (reused pattern) ──────────────────────────────────────

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
      <p className={cn("mt-2 text-2xl font-bold tracking-tight", trendColor || "text-foreground")}>
        {value}
      </p>
      {subtitle && (
        <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
      )}
    </div>
  );
}

// ─── Holdings Table ─────────────────────────────────────────────────

function isMarketAsset(assetType: string): boolean {
  return MARKET_ASSET_TYPES.includes(assetType as AssetType);
}

function HoldingsTable({ holdings }: { holdings: AccountHoldingRow[] }) {
  if (holdings.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center shadow-sm">
        <p className="text-sm text-muted-foreground">
          No holdings in this account yet.
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Add your first holding to start tracking this account.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                Name
              </th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                Type
              </th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                Shares
              </th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                Cost Basis
              </th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                Value
              </th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                Gain/Loss
              </th>
              <th className="w-10 px-2 py-3">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {holdings.map((h) => {
              const isGain = h.gainLossCents > 0;
              const isLoss = h.gainLossCents < 0;
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
                  key={h.id}
                  className="group transition-colors hover:bg-muted/30"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/holdings/${h.id}`}
                      className="flex items-center gap-2 hover:underline"
                    >
                      <div>
                        <p className="font-medium text-foreground">
                          {h.ticker ? (
                            <span className="mr-1.5 font-semibold">
                              {h.ticker}
                            </span>
                          ) : null}
                          {h.name}
                        </p>
                      </div>
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                      {h.assetTypeLabel}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-foreground">
                    {h.shares > 0 ? formatShares(h.shares) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-foreground">
                    {formatCurrency(h.costBasisCents)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-medium text-foreground">
                    {formatCurrency(h.currentValueCents)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <TrendIcon className={cn("h-3.5 w-3.5", trendColor)} />
                      <span className={cn("tabular-nums font-medium", trendColor)}>
                        {formatCurrency(h.gainLossCents, { showSign: true })}
                      </span>
                      <span className={cn("text-xs", trendColor)}>
                        ({formatPercent(h.gainLossPercent, { showSign: true })})
                      </span>
                    </div>
                  </td>
                  <td className="px-2 py-3">
                    <HoldingRowActions
                      holdingId={h.id}
                      holdingName={h.name}
                      assetType={h.assetType}
                      ticker={h.ticker}
                      sector={h.sector}
                      notes={h.notes}
                    />
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

// ─── Page ───────────────────────────────────────────────────────────

interface AccountDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function AccountDetailPage({ params }: AccountDetailPageProps) {
  const { id } = await params;
  const data = await getAccountDetailData(id);

  if (!data) notFound();

  const { account, kpis, allocation, holdings } = data;

  return (
    <div className="mx-auto max-w-7xl">
      {/* Back link + header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link
            href="/accounts"
            className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            All Accounts
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {account.name}
          </h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
              <Building2 className="h-3.5 w-3.5" />
              {account.custodianLabel}
            </span>
            <span className="text-muted-foreground/40">·</span>
            <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
              <Briefcase className="h-3.5 w-3.5" />
              {account.accountTypeLabel}
            </span>
          </div>
        </div>

        {/* Edit / Delete actions */}
        <div className="flex items-center gap-2">
          <EditAccountDialog
            accountId={account.id}
            currentValues={{
              name: account.name,
              custodian: account.custodian,
              accountType: account.accountType,
              notes: account.notes,
            }}
          />
          <DeleteAccountDialog
            accountId={account.id}
            accountName={account.name}
          />
        </div>
      </div>

      {/* KPI Cards */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard
          title="Total Value"
          value={formatCurrency(kpis.totalValueCents)}
          icon={DollarSign}
        />
        <KPICard
          title="Cost Basis"
          value={formatCurrency(kpis.totalCostBasisCents)}
          icon={BarChart3}
        />
        <KPICard
          title="Gain/Loss"
          value={formatCurrency(kpis.gainLossCents, { showSign: true })}
          subtitle={formatPercent(kpis.gainLossPercent, { showSign: true })}
          icon={kpis.gainLossCents >= 0 ? TrendingUp : TrendingDown}
          trend={kpis.gainLossCents}
        />
        <KPICard
          title="Holdings"
          value={String(kpis.holdingsCount)}
          subtitle={`active position${kpis.holdingsCount !== 1 ? "s" : ""}`}
          icon={Hash}
        />
      </div>

      {/* Allocation Chart + Holdings Table */}
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        {/* Allocation — reuse the dashboard component */}
        {allocation.length > 0 && (
          <div className="lg:col-span-1">
            <AssetAllocationChart data={allocation} />
          </div>
        )}

        {/* Holdings Table */}
        <div className={allocation.length > 0 ? "lg:col-span-2" : "lg:col-span-3"}>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-medium text-muted-foreground">
              Holdings
            </h2>
            <AddHoldingDialog accountId={account.id} />
          </div>
          <HoldingsTable holdings={holdings} />
        </div>
      </div>
    </div>
  );
}
