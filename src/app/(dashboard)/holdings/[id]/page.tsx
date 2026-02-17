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
  Layers,
  Building2,
  Briefcase,
  CalendarDays,
  Home,
  Banknote,
} from "lucide-react";
import { getHoldingDetailData } from "@/server/dal/holdings";
import type { LotRow } from "@/server/dal/holdings";
import { getCachedPrice } from "@/server/dal/prices";
import { formatCurrency, formatPercent, formatShares, cn } from "@/lib/utils";
import { ASSET_TYPES, MARKET_ASSET_TYPES, SECTORS, type AssetType } from "@/lib/constants";
import { PriceChart } from "@/components/dashboard/price-chart";
import { EditHoldingDialog } from "@/components/forms/edit-holding-dialog";
import { LiquidatePositionDialog } from "@/components/forms/liquidate-position-dialog";
import { LotRowActions } from "@/components/shared/lot-row-actions";
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
      <p className={cn("mt-2 text-2xl font-bold tracking-tight", trendColor || "text-foreground")}>
        {value}
      </p>
      {subtitle && (
        <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
      )}
    </div>
  );
}

// ─── Value Summary for Manual Assets ───────────────────────────────

interface ValueSummaryProps {
  assetType: string;
  kpis: {
    totalCostBasisCents: number;
    marketValueCents: number;
    gainLossCents: number;
    gainLossPercent: number;
  };
  lots: LotRow[];
}

function ValueSummary({ assetType, kpis, lots }: ValueSummaryProps) {
  const isRealEstate = assetType === "real_estate";
  const isCash = assetType === "cash";

  // For real estate, show monthly expenses
  const totalMortgage = lots.reduce((sum, l) => sum + (l.mortgageMonthlyCents ?? 0), 0);
  const totalEscrow = lots.reduce((sum, l) => sum + (l.escrowMonthlyCents ?? 0), 0);

  // For cash, show APY
  const avgApy = lots.length > 0
    ? lots.reduce((sum, l) => sum + (l.interestRateBps ?? 0), 0) / lots.length
    : 0;

  return (
    <div className="rounded-lg border border-border bg-card shadow-sm">
      <div className="border-b border-border px-5 py-3">
        <h3 className="text-sm font-medium text-muted-foreground">
          Value Summary
        </h3>
      </div>
      <div className="grid gap-4 p-5 sm:grid-cols-2">
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Cost Basis</p>
          <p className="text-lg font-semibold text-foreground">
            {formatCurrency(kpis.totalCostBasisCents)}
          </p>
        </div>
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Current Value</p>
          <p className="text-lg font-semibold text-foreground">
            {formatCurrency(kpis.marketValueCents)}
          </p>
        </div>
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Gain / Loss</p>
          <p
            className={cn(
              "text-lg font-semibold",
              kpis.gainLossCents > 0
                ? "text-gain"
                : kpis.gainLossCents < 0
                  ? "text-loss"
                  : "text-foreground",
            )}
          >
            {formatCurrency(kpis.gainLossCents, { showSign: true })}{" "}
            <span className="text-sm font-normal">
              ({formatPercent(kpis.gainLossPercent, { showSign: true })})
            </span>
          </p>
        </div>

        {isRealEstate && (totalMortgage > 0 || totalEscrow > 0) && (
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Monthly Expenses</p>
            <p className="text-lg font-semibold text-foreground">
              {formatCurrency(totalMortgage + totalEscrow)}
            </p>
            {totalMortgage > 0 && (
              <p className="text-xs text-muted-foreground">
                Mortgage: {formatCurrency(totalMortgage)}
              </p>
            )}
            {totalEscrow > 0 && (
              <p className="text-xs text-muted-foreground">
                Escrow: {formatCurrency(totalEscrow)}
              </p>
            )}
          </div>
        )}

        {isCash && avgApy > 0 && (
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">APY</p>
            <p className="text-lg font-semibold text-foreground">
              {(avgApy / 100).toFixed(2)}%
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Lot Breakdown Table ───────────────────────────────────────────

interface LotTableProps {
  lots: LotRow[];
  isMarket: boolean;
  assetType: string;
  holdingId: string;
  holdingName: string;
}

function LotBreakdownTable({ lots, isMarket, assetType, holdingId, holdingName }: LotTableProps) {
  if (lots.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center shadow-sm">
        <p className="text-sm text-muted-foreground">
          No lots recorded for this holding.
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Each purchase creates a separate lot for tracking cost basis and performance.
        </p>
      </div>
    );
  }

  const isRealEstate = assetType === "real_estate";
  const isCash = assetType === "cash";

  return (
    <div className="rounded-lg border border-border bg-card shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                #
              </th>
              {isMarket && (
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                  Shares
                </th>
              )}
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                Cost Basis
              </th>
              {isMarket && (
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                  Cost/Share
                </th>
              )}
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                Current Value
              </th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                Gain/Loss
              </th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                Acquired
              </th>
              {isRealEstate && (
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                  Monthly
                </th>
              )}
              {isCash && (
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                  APY
                </th>
              )}
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                Status
              </th>
              <th className="w-10 px-2 py-3">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {lots.map((lot, index) => {
              const isGain = lot.gainLossCents > 0;
              const isLoss = lot.gainLossCents < 0;
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

              const monthly =
                (lot.mortgageMonthlyCents ?? 0) +
                (lot.escrowMonthlyCents ?? 0);

              return (
                <tr
                  key={lot.id}
                  className={cn(
                    "group transition-colors hover:bg-muted/30",
                    lot.isLiquidated && "opacity-50",
                  )}
                >
                  <td className="px-4 py-3 tabular-nums text-muted-foreground">
                    {index + 1}
                  </td>
                  {isMarket && (
                    <td className="px-4 py-3 text-right tabular-nums text-foreground">
                      {lot.shares > 0 ? formatShares(lot.shares) : "—"}
                    </td>
                  )}
                  <td className="px-4 py-3 text-right tabular-nums text-foreground">
                    {formatCurrency(lot.costBasisCents)}
                  </td>
                  {isMarket && (
                    <td className="px-4 py-3 text-right tabular-nums text-foreground">
                      {lot.costPerShareCents > 0
                        ? formatCurrency(lot.costPerShareCents)
                        : "—"}
                    </td>
                  )}
                  <td className="px-4 py-3 text-right tabular-nums font-medium text-foreground">
                    {formatCurrency(lot.currentValueCents)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <TrendIcon className={cn("h-3.5 w-3.5", trendColor)} />
                      <span className={cn("tabular-nums font-medium", trendColor)}>
                        {formatCurrency(lot.gainLossCents, { showSign: true })}
                      </span>
                      <span className={cn("text-xs", trendColor)}>
                        ({formatPercent(lot.gainLossPercent, { showSign: true })})
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-foreground">
                    {lot.acquiredAt
                      ? new Date(lot.acquiredAt).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })
                      : "—"}
                  </td>
                  {isRealEstate && (
                    <td className="px-4 py-3 text-right tabular-nums text-foreground">
                      {monthly > 0 ? formatCurrency(monthly) : "—"}
                    </td>
                  )}
                  {isCash && (
                    <td className="px-4 py-3 text-right tabular-nums text-foreground">
                      {lot.interestRateBps
                        ? `${(lot.interestRateBps / 100).toFixed(2)}%`
                        : "—"}
                    </td>
                  )}
                  <td className="px-4 py-3">
                    {lot.isLiquidated ? (
                      <Badge variant="secondary" className="text-xs">
                        Sold
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs border-gain/30 text-gain">
                        Active
                      </Badge>
                    )}
                  </td>
                  <td className="px-2 py-3">
                    {!lot.isLiquidated && (
                      <LotRowActions
                        lotId={lot.id}
                        holdingId={holdingId}
                        holdingName={holdingName}
                        lotNumber={index + 1}
                        isMarketAsset={isMarket}
                        assetType={assetType}
                        totalLotCount={lots.filter((l) => !l.isLiquidated).length}
                        currentValues={{
                          shares: lot.shares,
                          costBasisCents: lot.costBasisCents,
                          costPerShareCents: lot.costPerShareCents,
                          acquiredAt: lot.acquiredAt
                            ? new Date(lot.acquiredAt).toISOString()
                            : null,
                          currentValueCents: lot.currentValueCents,
                          mortgageMonthlyCents: lot.mortgageMonthlyCents,
                          escrowMonthlyCents: lot.escrowMonthlyCents,
                          interestRateBps: lot.interestRateBps,
                          notes: lot.notes,
                        }}
                      />
                    )}
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

// ─── Asset Type Icon ───────────────────────────────────────────────

function assetTypeIcon(assetType: string) {
  switch (assetType) {
    case "real_estate":
      return Home;
    case "cash":
      return Banknote;
    default:
      return Briefcase;
  }
}

// ─── Page ──────────────────────────────────────────────────────────

interface HoldingDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function HoldingDetailPage({ params }: HoldingDetailPageProps) {
  const { id } = await params;
  const data = await getHoldingDetailData(id);

  if (!data) notFound();

  const { holding, account, kpis, lots, isMarket } = data;

  // Fetch price info for manual override support
  const priceInfo = holding.ticker && isMarket
    ? await getCachedPrice(holding.ticker)
    : null;

  const priceInfoForDialog = priceInfo
    ? {
        priceCents: priceInfo.priceCents,
        priceDollars: priceInfo.priceDollars,
        isManualOverride: priceInfo.isManualOverride,
      }
    : null;

  const lotDates = lots.map((l) =>
    l.acquiredAt ? new Date(l.acquiredAt).toISOString() : null,
  );

  const AssetIcon = assetTypeIcon(holding.assetType);
  const sectorLabel = holding.sector
    ? SECTORS[holding.sector as keyof typeof SECTORS] ?? holding.sector
    : null;

  return (
    <div className="mx-auto max-w-7xl">
      {/* Back link + header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link
            href="/holdings"
            className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            All Holdings
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              {holding.ticker && (
                <span className="mr-2 text-primary">{holding.ticker}</span>
              )}
              {holding.name}
            </h1>
            <Badge variant="secondary">
              {ASSET_TYPES[holding.assetType as AssetType] ?? holding.assetType}
            </Badge>
            {priceInfoForDialog?.isManualOverride && (
              <Badge variant="outline" className="border-amber-500/30 text-amber-600 dark:text-amber-400">
                Manual Price
              </Badge>
            )}
            {holding.isLiquidated && (
              <Badge variant="destructive">Liquidated</Badge>
            )}
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
              <Building2 className="h-3.5 w-3.5" />
              {account.custodianLabel}
            </span>
            <span className="text-muted-foreground/40">·</span>
            <Link
              href={`/accounts/${account.id}`}
              className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <AssetIcon className="h-3.5 w-3.5" />
              {account.name}
            </Link>
            {sectorLabel && (
              <>
                <span className="text-muted-foreground/40">·</span>
                <span className="text-sm text-muted-foreground">
                  {sectorLabel}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Edit / Liquidate actions */}
        <div className="flex items-center gap-2">
          <EditHoldingDialog
            holdingId={holding.id}
            currentValues={{
              name: holding.name,
              assetType: holding.assetType,
              ticker: holding.ticker,
              sector: holding.sector,
              notes: holding.notes,
            }}
            priceInfo={priceInfoForDialog}
          />
          {!holding.isLiquidated && (
            <LiquidatePositionDialog
              holdingId={holding.id}
              holdingName={holding.name}
              ticker={holding.ticker}
              lots={lots.map((l) => ({
                id: l.id,
                shares: l.shares,
                costBasisCents: l.costBasisCents,
                costPerShareCents: l.costPerShareCents,
                acquiredAt: l.acquiredAt ? new Date(l.acquiredAt).toISOString() : null,
                isLiquidated: l.isLiquidated,
              }))}
            />
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard
          title="Market Value"
          value={formatCurrency(kpis.marketValueCents)}
          icon={DollarSign}
        />
        <KPICard
          title="Cost Basis"
          value={formatCurrency(kpis.totalCostBasisCents)}
          subtitle={
            isMarket && kpis.avgCostPerShareCents > 0
              ? `Avg ${formatCurrency(kpis.avgCostPerShareCents)}/share`
              : undefined
          }
          icon={BarChart3}
        />
        <KPICard
          title="Total Gain/Loss"
          value={formatCurrency(kpis.gainLossCents, { showSign: true })}
          subtitle={formatPercent(kpis.gainLossPercent, { showSign: true })}
          icon={kpis.gainLossCents >= 0 ? TrendingUp : TrendingDown}
          trend={kpis.gainLossCents}
        />
        {isMarket ? (
          <KPICard
            title="Current Price"
            value={
              kpis.currentPriceCents > 0
                ? formatCurrency(kpis.currentPriceCents)
                : "N/A"
            }
            subtitle={
              kpis.totalShares > 0
                ? `${formatShares(kpis.totalShares)} shares`
                : undefined
            }
            icon={Hash}
          />
        ) : (
          <KPICard
            title="Lots"
            value={String(kpis.lotCount)}
            subtitle={`active lot${kpis.lotCount !== 1 ? "s" : ""}`}
            icon={Layers}
          />
        )}
      </div>

      {/* Chart or Value Summary */}
      <div className="mt-6">
        {isMarket && holding.ticker ? (
          <PriceChart
            ticker={holding.ticker}
            currentPriceCents={kpis.currentPriceCents}
            avgCostCents={kpis.avgCostPerShareCents}
            lotDates={lotDates}
          />
        ) : (
          <ValueSummary
            assetType={holding.assetType}
            kpis={kpis}
            lots={lots}
          />
        )}
      </div>

      {/* Lot Breakdown */}
      <div className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Layers className="h-4 w-4" />
            Lot Breakdown
            <span className="text-xs">({lots.length})</span>
          </h2>
        </div>
        <LotBreakdownTable
          lots={lots}
          isMarket={isMarket}
          assetType={holding.assetType}
          holdingId={holding.id}
          holdingName={holding.name}
        />
      </div>

      {/* Notes section */}
      {holding.notes && (
        <div className="mt-6 rounded-lg border border-border bg-card p-5 shadow-sm">
          <h3 className="text-sm font-medium text-muted-foreground">Notes</h3>
          <p className="mt-2 text-sm text-foreground whitespace-pre-wrap">
            {holding.notes}
          </p>
        </div>
      )}

      {/* Metadata footer */}
      <div className="mt-6 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <CalendarDays className="h-3 w-3" />
          Added {holding.createdAt.toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
          })}
        </span>
        <span>
          Source: {holding.source.charAt(0).toUpperCase() + holding.source.slice(1)}
        </span>
      </div>
    </div>
  );
}
