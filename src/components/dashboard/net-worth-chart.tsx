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
} from "recharts";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils";
import { TIME_PERIODS, type TimePeriod } from "@/lib/constants";
import type { NetWorthDataPoint } from "@/server/dal/dashboard";

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

// ─── Custom Tooltip ──────────────────────────────────────────────────

interface TooltipPayloadItem {
  value: number;
  payload: { date: string; valueCents: number };
}

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
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

  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-md">
      <p className="text-xs text-muted-foreground">{formattedDate}</p>
      <p className="text-sm font-semibold text-foreground">
        {formatCurrency(data.valueCents)}
      </p>
    </div>
  );
}

// ─── Y-axis formatter ────────────────────────────────────────────────

function formatYAxis(cents: number): string {
  const dollars = cents / 100;
  if (dollars >= 1_000_000) return `$${(dollars / 1_000_000).toFixed(1)}M`;
  if (dollars >= 1_000) return `$${(dollars / 1_000).toFixed(0)}K`;
  return `$${dollars.toFixed(0)}`;
}

// ─── X-axis date formatter ───────────────────────────────────────────

function formatXDate(dateStr: string, period: TimePeriod): string {
  const date = new Date(dateStr + "T12:00:00");
  if (period === "1W") {
    return date.toLocaleDateString("en-US", { weekday: "short" });
  }
  if (period === "1M" || period === "3M") {
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
  return date.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

// ─── Main Component ─────────────────────────────────────────────────

interface NetWorthChartProps {
  data: NetWorthDataPoint[];
}

export function NetWorthChart({ data }: NetWorthChartProps) {
  const [period, setPeriod] = useState<TimePeriod>("1Y");

  const filteredData = useMemo(() => {
    const days = PERIOD_DAYS[period];
    return data.slice(-days - 1);
  }, [data, period]);

  // Compute domain with padding for visual breathing room
  const [yMin, yMax] = useMemo(() => {
    if (filteredData.length === 0) return [0, 0];
    const values = filteredData.map((d) => d.valueCents);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const padding = (max - min) * 0.08;
    return [Math.floor(min - padding), Math.ceil(max + padding)];
  }, [filteredData]);

  // Determine how many X-axis ticks to show based on period
  const tickInterval = useMemo(() => {
    const len = filteredData.length;
    if (period === "1W") return 0; // every day
    if (period === "1M") return Math.floor(len / 6);
    if (period === "3M") return Math.floor(len / 6);
    if (period === "6M") return Math.floor(len / 6);
    if (period === "1Y") return Math.floor(len / 6);
    return Math.floor(len / 8);
  }, [filteredData.length, period]);

  return (
    <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
      {/* Header row */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-medium text-muted-foreground">
            Net Worth History
          </h2>
          {filteredData.length > 0 && (
            <p className="mt-0.5 text-lg font-semibold text-foreground">
              {formatCurrency(filteredData[filteredData.length - 1].valueCents)}
            </p>
          )}
        </div>

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
      </div>

      {/* Chart */}
      <div className="mt-4 h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={filteredData}
            margin={{ top: 4, right: 4, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id="netWorthGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0.02} />
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
              width={60}
            />
            <Tooltip
              content={<ChartTooltip />}
              cursor={{
                stroke: "hsl(142, 76%, 36%)",
                strokeWidth: 1,
                strokeDasharray: "4 4",
              }}
            />
            <Area
              type="monotone"
              dataKey="valueCents"
              stroke="hsl(142, 76%, 36%)"
              strokeWidth={2}
              fill="url(#netWorthGradient)"
              animationDuration={600}
              dot={false}
              activeDot={{
                r: 5,
                fill: "hsl(142, 76%, 36%)",
                stroke: "#fff",
                strokeWidth: 2,
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
