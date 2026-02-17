"use client";

import { useState, useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { cn, formatCurrency } from "@/lib/utils";
import { TIME_PERIODS, type TimePeriod } from "@/lib/constants";
import type { PortfolioValueDataPoint } from "@/server/dal/analytics";

// ─── Period config ───────────────────────────────────────────────────

const PERIOD_DAYS: Record<TimePeriod, number> = {
  "1W": 7,
  "1M": 30,
  "3M": 90,
  "6M": 180,
  "1Y": 365,
  ALL: 730,
};

const PERIOD_KEYS = Object.keys(TIME_PERIODS) as TimePeriod[];

// ─── Chart colors ────────────────────────────────────────────────────

const COLORS = {
  totalValue: "hsl(142, 76%, 36%)",
  returnOnly: "hsl(221, 83%, 53%)",
} as const;

// ─── Custom Tooltip ──────────────────────────────────────────────────

interface TooltipPayloadItem {
  value: number;
  dataKey: string;
  color: string;
  payload: PortfolioValueDataPoint;
}

function ChartTooltip({
  active,
  payload,
  showDeposits,
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  showDeposits?: boolean;
}) {
  if (!active || !payload?.length) return null;

  const data = payload[0].payload;
  const dateObj = new Date(data.date + "T12:00:00");
  const formattedDate = dateObj.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const depositsCents = data.totalValueCents - data.returnOnlyCents;

  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2.5 shadow-md">
      <p className="text-xs text-muted-foreground">{formattedDate}</p>
      <div className="mt-1.5 space-y-1">
        {showDeposits ? (
          <>
            <div className="flex items-center gap-2">
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: COLORS.totalValue }}
              />
              <span className="text-xs text-muted-foreground">Total Value</span>
              <span className="ml-auto text-sm font-semibold text-foreground">
                {formatCurrency(data.totalValueCents)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: COLORS.returnOnly }}
              />
              <span className="text-xs text-muted-foreground">Return</span>
              <span className="ml-auto text-sm font-semibold text-foreground">
                {formatCurrency(data.returnOnlyCents, { showSign: true })}
              </span>
            </div>
            <div className="flex items-center gap-2 border-t border-border pt-1">
              <span className="inline-block h-2 w-2 rounded-full bg-muted" />
              <span className="text-xs text-muted-foreground">Deposits</span>
              <span className="ml-auto text-xs text-muted-foreground">
                {formatCurrency(depositsCents)}
              </span>
            </div>
          </>
        ) : (
          <div className="flex items-center gap-2">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: COLORS.returnOnly }}
            />
            <span className="text-xs text-muted-foreground">
              Investment Return
            </span>
            <span className="ml-auto text-sm font-semibold text-foreground">
              {formatCurrency(data.returnOnlyCents, { showSign: true })}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Y-axis formatter ────────────────────────────────────────────────

function formatYAxis(cents: number): string {
  const dollars = cents / 100;
  if (Math.abs(dollars) >= 1_000_000) return `$${(dollars / 1_000_000).toFixed(1)}M`;
  if (Math.abs(dollars) >= 1_000) return `$${(dollars / 1_000).toFixed(0)}K`;
  return `$${dollars.toFixed(0)}`;
}

// ─── X-axis date formatter ───────────────────────────────────────────

function formatXDate(dateStr: string, period: TimePeriod): string {
  const date = new Date(dateStr + "T12:00:00");
  if (period === "1W")
    return date.toLocaleDateString("en-US", { weekday: "short" });
  if (period === "1M" || period === "3M")
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return date.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

// ─── Main Component ─────────────────────────────────────────────────

interface PortfolioValueChartProps {
  data: PortfolioValueDataPoint[];
}

export function PortfolioValueChart({ data }: PortfolioValueChartProps) {
  const [period, setPeriod] = useState<TimePeriod>("1Y");
  const [showDeposits, setShowDeposits] = useState(true);

  const filteredData = useMemo(() => {
    const days = PERIOD_DAYS[period];
    return data.slice(-days - 1);
  }, [data, period]);

  // Compute Y-axis domain with padding
  const [yMin, yMax] = useMemo(() => {
    if (filteredData.length === 0) return [0, 0];

    const values = showDeposits
      ? filteredData.flatMap((d) => [d.totalValueCents, d.returnOnlyCents])
      : filteredData.map((d) => d.returnOnlyCents);

    const min = Math.min(...values);
    const max = Math.max(...values);
    const padding = (max - min) * 0.08 || Math.abs(max) * 0.1;
    return [Math.floor(min - padding), Math.ceil(max + padding)];
  }, [filteredData, showDeposits]);

  // Determine X-axis tick interval
  const tickInterval = useMemo(() => {
    const len = filteredData.length;
    if (period === "1W") return 0;
    if (period === "1M" || period === "3M") return Math.floor(len / 6);
    if (period === "6M" || period === "1Y") return Math.floor(len / 6);
    return Math.floor(len / 8);
  }, [filteredData.length, period]);

  // Current period values for the header
  const latestPoint = filteredData[filteredData.length - 1];
  const firstPoint = filteredData[0];
  const periodChange = latestPoint && firstPoint
    ? showDeposits
      ? latestPoint.totalValueCents - firstPoint.totalValueCents
      : latestPoint.returnOnlyCents - firstPoint.returnOnlyCents
    : 0;

  return (
    <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-sm font-medium text-muted-foreground">
            Portfolio Value Over Time
          </h2>
          {latestPoint && (
            <div className="mt-0.5 flex items-baseline gap-2">
              <p className="text-lg font-semibold text-foreground">
                {formatCurrency(
                  showDeposits
                    ? latestPoint.totalValueCents
                    : latestPoint.returnOnlyCents,
                )}
              </p>
              <span
                className={cn(
                  "text-xs font-medium",
                  periodChange >= 0
                    ? "text-emerald-600"
                    : "text-red-600",
                )}
              >
                {formatCurrency(periodChange, { showSign: true })}
              </span>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="flex flex-col items-start gap-2 sm:items-end">
          {/* Period selector */}
          <div
            className="flex items-center gap-1 rounded-lg bg-muted p-1"
            role="tablist"
            aria-label="Chart time period"
          >
            {PERIOD_KEYS.map((key) => (
              <button
                key={key}
                role="tab"
                aria-selected={period === key}
                onClick={() => setPeriod(key)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                  period === key
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {key}
              </button>
            ))}
          </div>

          {/* Deposit toggle */}
          <button
            onClick={() => setShowDeposits((prev) => !prev)}
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              "border",
              showDeposits
                ? "border-primary/30 bg-primary/10 text-primary"
                : "border-border bg-muted text-muted-foreground hover:text-foreground",
            )}
            aria-pressed={showDeposits}
            aria-label="Toggle deposit and withdrawal visibility"
          >
            <span
              className={cn(
                "flex h-4 w-7 items-center rounded-full px-0.5 transition-colors",
                showDeposits ? "bg-primary" : "bg-muted-foreground/30",
              )}
            >
              <span
                className={cn(
                  "h-3 w-3 rounded-full bg-white transition-transform",
                  showDeposits ? "translate-x-3" : "translate-x-0",
                )}
              />
            </span>
            {showDeposits ? "Showing deposits" : "Returns only"}
          </button>
        </div>
      </div>

      {/* Chart */}
      <div className="mt-4 h-80">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={filteredData}
            margin={{ top: 4, right: 4, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id="totalValueGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={COLORS.totalValue} stopOpacity={0.25} />
                <stop offset="95%" stopColor={COLORS.totalValue} stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="returnOnlyGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={COLORS.returnOnly} stopOpacity={0.25} />
                <stop offset="95%" stopColor={COLORS.returnOnly} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="hsl(214, 32%, 91%)"
              vertical={false}
            />
            <XAxis
              dataKey="date"
              tickFormatter={(val) => formatXDate(val, period)}
              interval={tickInterval}
              tick={{ fontSize: 11, fill: "hsl(215, 16%, 47%)" }}
              axisLine={{ stroke: "hsl(214, 32%, 91%)" }}
              tickLine={false}
              dy={8}
            />
            <YAxis
              tickFormatter={formatYAxis}
              domain={[yMin, yMax]}
              tick={{ fontSize: 11, fill: "hsl(215, 16%, 47%)" }}
              axisLine={false}
              tickLine={false}
              width={65}
            />
            <Tooltip
              content={<ChartTooltip showDeposits={showDeposits} />}
              cursor={{
                stroke: "hsl(215, 16%, 47%)",
                strokeWidth: 1,
                strokeDasharray: "4 4",
              }}
            />
            {showDeposits && (
              <Area
                type="monotone"
                dataKey="totalValueCents"
                name="Total Value"
                stroke={COLORS.totalValue}
                strokeWidth={2}
                fill="url(#totalValueGradient)"
                animationDuration={600}
                dot={false}
                activeDot={{
                  r: 4,
                  fill: COLORS.totalValue,
                  stroke: "#fff",
                  strokeWidth: 2,
                }}
              />
            )}
            <Area
              type="monotone"
              dataKey="returnOnlyCents"
              name="Investment Return"
              stroke={COLORS.returnOnly}
              strokeWidth={2}
              fill={showDeposits ? "none" : "url(#returnOnlyGradient)"}
              animationDuration={600}
              dot={false}
              activeDot={{
                r: 4,
                fill: COLORS.returnOnly,
                stroke: "#fff",
                strokeWidth: 2,
              }}
            />
            {showDeposits && (
              <Legend
                verticalAlign="bottom"
                height={36}
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ fontSize: "12px", color: "hsl(215, 16%, 47%)" }}
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Context note */}
      <p className="mt-3 text-[11px] text-muted-foreground/70">
        {showDeposits
          ? "Green line shows total portfolio value. Blue line shows investment return excluding deposits."
          : "Showing investment returns only — deposits and withdrawals are excluded."}
      </p>
    </div>
  );
}
