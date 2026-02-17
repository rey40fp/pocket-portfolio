"use client";

import { useState, useCallback, useEffect, useTransition } from "react";
import { RefreshCw, Clock } from "lucide-react";
import { refreshPrices } from "@/server/actions/prices";
import { cn } from "@/lib/utils";

interface PriceRefreshIndicatorProps {
  /** ISO string of the latest price update, or null if no prices exist. */
  lastUpdated: string | null;
  /** Optional extra class names. */
  className?: string;
}

function formatTimeAgo(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const seconds = Math.floor(diff / 1000);

  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function getStalenessLevel(isoDate: string): "fresh" | "stale" | "very-stale" {
  const diff = Date.now() - new Date(isoDate).getTime();
  const minutes = diff / 1000 / 60;

  if (minutes < 20) return "fresh";
  if (minutes < 60) return "stale";
  return "very-stale";
}

export function PriceRefreshIndicator({
  lastUpdated,
  className,
}: PriceRefreshIndicatorProps) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{
    refreshed: number;
    skipped: number;
    failed: string[];
    error?: string;
    rateLimited?: boolean;
    retryAfterMs?: number;
  } | null>(null);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [displayTime, setDisplayTime] = useState(
    lastUpdated ? formatTimeAgo(lastUpdated) : null,
  );

  // Update the relative time display every 30 seconds
  useEffect(() => {
    if (!lastUpdated) return;

    const update = () => setDisplayTime(formatTimeAgo(lastUpdated));
    update();

    const interval = setInterval(update, 30_000);
    return () => clearInterval(interval);
  }, [lastUpdated]);

  // Cooldown timer
  useEffect(() => {
    if (cooldownSeconds <= 0) return;

    const interval = setInterval(() => {
      setCooldownSeconds((prev) => Math.max(0, prev - 1));
    }, 1_000);

    return () => clearInterval(interval);
  }, [cooldownSeconds]);

  const handleRefresh = useCallback(() => {
    if (isPending || cooldownSeconds > 0) return;

    setResult(null);
    startTransition(async () => {
      const res = await refreshPrices();

      if (res.rateLimited && res.retryAfterMs) {
        setCooldownSeconds(Math.ceil(res.retryAfterMs / 1000));
      }

      setResult({
        refreshed: res.refreshed,
        skipped: res.skipped,
        failed: res.failed,
        error: res.error,
        rateLimited: res.rateLimited,
        retryAfterMs: res.retryAfterMs,
      });

      if (res.success && res.lastUpdated) {
        setDisplayTime(formatTimeAgo(res.lastUpdated));
      }
    });
  }, [isPending, cooldownSeconds, startTransition]);

  const staleness = lastUpdated ? getStalenessLevel(lastUpdated) : null;
  const isDisabled = isPending || cooldownSeconds > 0;

  return (
    <div
      className={cn(
        "flex items-center gap-2 text-xs text-muted-foreground",
        className,
      )}
    >
      <Clock className="h-3.5 w-3.5" />

      {displayTime ? (
        <span
          className={cn(
            staleness === "fresh" && "text-muted-foreground",
            staleness === "stale" && "text-yellow-600 dark:text-yellow-400",
            staleness === "very-stale" && "text-orange-600 dark:text-orange-400",
          )}
        >
          Prices updated {displayTime}
        </span>
      ) : (
        <span className="text-muted-foreground">No price data yet</span>
      )}

      <button
        onClick={handleRefresh}
        disabled={isDisabled}
        title={
          cooldownSeconds > 0
            ? `Wait ${cooldownSeconds}s`
            : isPending
              ? "Refreshing..."
              : "Refresh prices"
        }
        className={cn(
          "inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors",
          "hover:bg-accent hover:text-accent-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          isDisabled && "cursor-not-allowed opacity-50",
        )}
      >
        <RefreshCw
          className={cn("h-3.5 w-3.5", isPending && "animate-spin")}
        />
        {cooldownSeconds > 0
          ? `${cooldownSeconds}s`
          : isPending
            ? "Refreshing"
            : "Refresh"}
      </button>

      {/* Inline feedback after refresh */}
      {result && !isPending && !result.rateLimited && (
        <span
          className={cn(
            "text-xs",
            result.error ? "text-loss" : "text-gain",
          )}
        >
          {result.error
            ? "Failed"
            : `${result.refreshed} updated${result.skipped > 0 ? `, ${result.skipped} skipped` : ""}${result.failed.length > 0 ? `, ${result.failed.length} failed` : ""}`}
        </span>
      )}

      {result?.rateLimited && !isPending && (
        <span className="text-xs text-yellow-600 dark:text-yellow-400">
          Rate limited
        </span>
      )}
    </div>
  );
}
