"use client";

import { useEffect, useRef, useState } from "react";
import { createChart, AreaSeries, type IChartApi, type ISeriesApi, ColorType } from "lightweight-charts";

interface PriceChartProps {
  ticker: string;
  currentPriceCents: number;
  avgCostCents: number;
  /** ISO date strings from lot acquired dates for reference markers */
  lotDates: (string | null)[];
}

/**
 * Lightweight Charts area chart for market assets.
 *
 * Since we only store a single cached price snapshot (not historical OHLCV),
 * this generates a simple price line using lot acquisition dates as reference
 * points and the current cached price as the latest value.
 *
 * In the future, once a historical prices table or market data API integration
 * is added, this component will render real time-series data.
 */
export function PriceChart({
  ticker,
  currentPriceCents,
  avgCostCents,
  lotDates,
}: PriceChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Area"> | null>(null);
  const [hasData, setHasData] = useState(false);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const currentPrice = currentPriceCents / 100;
    const avgCost = avgCostCents / 100;

    // Build synthetic data points from lot dates and current price
    const validDates = lotDates
      .filter((d): d is string => d !== null)
      .map((d) => new Date(d))
      .filter((d) => !isNaN(d.getTime()))
      .sort((a, b) => a.getTime() - b.getTime());

    if (validDates.length === 0 || currentPrice === 0) {
      setHasData(false);
      return;
    }

    setHasData(true);

    // Generate synthetic price movement from avg cost to current price
    const now = new Date();
    const allDates = [...validDates, now];

    const dataPoints: { time: string; value: number }[] = [];
    const seenDates = new Set<string>();

    for (let i = 0; i < allDates.length; i++) {
      const date = allDates[i];
      const timeStr = date.toISOString().split("T")[0];

      if (seenDates.has(timeStr)) continue;
      seenDates.add(timeStr);

      // Interpolate from avg cost at first lot to current price
      const progress = allDates.length > 1 ? i / (allDates.length - 1) : 1;
      const value = avgCost + (currentPrice - avgCost) * progress;

      dataPoints.push({ time: timeStr, value: Math.round(value * 100) / 100 });
    }

    if (dataPoints.length < 2) {
      // Add a point 30 days before as the start
      const startDate = new Date(now);
      startDate.setDate(startDate.getDate() - 30);
      const startStr = startDate.toISOString().split("T")[0];
      if (!seenDates.has(startStr)) {
        dataPoints.unshift({ time: startStr, value: avgCost });
      }
    }

    const isGain = currentPrice >= avgCost;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "hsl(var(--muted-foreground))",
        fontFamily: "inherit",
      },
      grid: {
        vertLines: { color: "hsl(var(--border) / 0.5)" },
        horzLines: { color: "hsl(var(--border) / 0.5)" },
      },
      width: chartContainerRef.current.clientWidth,
      height: 300,
      rightPriceScale: {
        borderColor: "hsl(var(--border))",
      },
      timeScale: {
        borderColor: "hsl(var(--border))",
        timeVisible: false,
      },
      crosshair: {
        horzLine: { labelBackgroundColor: "hsl(var(--primary))" },
        vertLine: { labelBackgroundColor: "hsl(var(--primary))" },
      },
    });

    chartRef.current = chart;

    const areaSeries = chart.addSeries(AreaSeries, {
      topColor: isGain ? "rgba(34, 197, 94, 0.4)" : "rgba(239, 68, 68, 0.4)",
      bottomColor: isGain ? "rgba(34, 197, 94, 0.05)" : "rgba(239, 68, 68, 0.05)",
      lineColor: isGain ? "rgb(34, 197, 94)" : "rgb(239, 68, 68)",
      lineWidth: 2,
      priceFormat: {
        type: "price",
        precision: 2,
        minMove: 0.01,
      },
    });

    areaSeries.setData(dataPoints);
    seriesRef.current = areaSeries;

    // Add cost basis price line
    areaSeries.createPriceLine({
      price: avgCost,
      color: "hsl(var(--muted-foreground))",
      lineWidth: 1,
      lineStyle: 2, // Dashed
      axisLabelVisible: true,
      title: "Avg Cost",
    });

    chart.timeScale().fitContent();

    // Handle resize
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        chart.applyOptions({ width: entry.contentRect.width });
      }
    });

    resizeObserver.observe(chartContainerRef.current);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, [ticker, currentPriceCents, avgCostCents, lotDates]);

  if (!hasData && currentPriceCents === 0) {
    return (
      <div className="flex h-[300px] items-center justify-center rounded-lg border border-border bg-card">
        <div className="text-center">
          <p className="text-sm font-medium text-muted-foreground">
            No price data available
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Price data will appear once market data is synced for {ticker}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
      <div className="border-b border-border px-5 py-3">
        <h3 className="text-sm font-medium text-muted-foreground">
          Price Chart — {ticker}
        </h3>
      </div>
      <div ref={chartContainerRef} className="w-full" />
      {!hasData && (
        <div className="flex h-[300px] items-center justify-center">
          <div className="text-center">
            <p className="text-sm text-muted-foreground">
              Generating chart data...
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
