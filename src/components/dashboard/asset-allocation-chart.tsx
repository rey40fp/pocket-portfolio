"use client";

import { useState, useCallback } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Sector } from "recharts";
import { formatCurrency, formatPercent } from "@/lib/utils";
import type { AssetAllocationSlice } from "@/server/dal/dashboard";

// ─── Color palette ───────────────────────────────────────────────────

const SLICE_COLORS: Record<string, string> = {
  stock: "hsl(142, 76%, 36%)",       // primary green
  etf: "hsl(197, 71%, 45%)",         // sky blue
  mutual_fund: "hsl(262, 52%, 55%)", // purple
  bond: "hsl(215, 28%, 55%)",        // slate
  crypto: "hsl(38, 92%, 50%)",       // amber
  real_estate: "hsl(142, 40%, 55%)", // light green
  cash: "hsl(197, 40%, 65%)",        // light blue
  other: "hsl(215, 16%, 65%)",       // gray
};

const getSliceColor = (assetType: string): string =>
  SLICE_COLORS[assetType] ?? "hsl(215, 16%, 65%)";

// ─── Active shape (hover state) ─────────────────────────────────────

interface ActiveShapeProps {
  cx: number;
  cy: number;
  innerRadius: number;
  outerRadius: number;
  startAngle: number;
  endAngle: number;
  fill?: string;
}

function renderActiveShape(props: ActiveShapeProps) {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill = "hsl(215, 16%, 65%)" } = props;
  return (
    <g>
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius}
        outerRadius={outerRadius + 6}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
      />
    </g>
  );
}

// ─── Main Component ─────────────────────────────────────────────────

interface AssetAllocationChartProps {
  data: AssetAllocationSlice[];
}

export function AssetAllocationChart({ data }: AssetAllocationChartProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const onPieEnter = useCallback((_: unknown, index: number) => {
    setActiveIndex(index);
  }, []);

  const onPieLeave = useCallback(() => {
    setActiveIndex(null);
  }, []);

  const totalCents = data.reduce((sum, d) => sum + d.valueCents, 0);

  // Current hovered slice for center display
  const activeSlice = activeIndex !== null ? data[activeIndex] : null;

  return (
    <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
      <h2 className="text-sm font-medium text-muted-foreground">
        Asset Allocation
      </h2>

      <div className="mt-4 flex flex-col items-center gap-4 sm:flex-row">
        {/* Donut chart */}
        <div className="relative h-52 w-52 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="valueCents"
                nameKey="label"
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={85}
                paddingAngle={2}
                strokeWidth={0}
                {...({ activeIndex: activeIndex ?? undefined, activeShape: renderActiveShape } as Record<string, unknown>)}
                onMouseEnter={onPieEnter}
                onMouseLeave={onPieLeave}
                animationDuration={600}
              >
                {data.map((entry) => (
                  <Cell
                    key={entry.assetType}
                    fill={getSliceColor(entry.assetType)}
                  />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>

          {/* Center label */}
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            {activeSlice ? (
              <>
                <span className="text-xs text-muted-foreground">
                  {activeSlice.label}
                </span>
                <span className="text-sm font-semibold text-foreground">
                  {formatPercent(activeSlice.percent)}
                </span>
              </>
            ) : (
              <>
                <span className="text-xs text-muted-foreground">Total</span>
                <span className="text-sm font-semibold text-foreground">
                  {formatCurrency(totalCents, { compact: true })}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-1 flex-col gap-2">
          {data.map((slice, i) => (
            <div
              key={slice.assetType}
              className="flex items-center justify-between gap-3 rounded-md px-2 py-1 transition-colors hover:bg-muted/60"
              onMouseEnter={() => setActiveIndex(i)}
              onMouseLeave={() => setActiveIndex(null)}
            >
              <div className="flex items-center gap-2">
                <span
                  className="inline-block h-3 w-3 shrink-0 rounded-sm"
                  style={{ backgroundColor: getSliceColor(slice.assetType) }}
                />
                <span className="text-sm text-foreground">{slice.label}</span>
              </div>
              <div className="flex items-center gap-3 text-right">
                <span className="text-sm font-medium text-foreground">
                  {formatCurrency(slice.valueCents, { compact: true })}
                </span>
                <span className="w-14 text-xs text-muted-foreground">
                  {formatPercent(slice.percent)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
