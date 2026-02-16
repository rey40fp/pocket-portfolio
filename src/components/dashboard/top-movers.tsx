import { TrendingUp, TrendingDown } from "lucide-react";
import { formatCurrency, formatPercent } from "@/lib/utils";
import type { TopMoversData, TopMover } from "@/server/dal/dashboard";

// ─── Single mover row ────────────────────────────────────────────────

function MoverRow({ mover, type }: { mover: TopMover; type: "gainer" | "loser" }) {
  const isGain = type === "gainer";
  const Icon = isGain ? TrendingUp : TrendingDown;
  const colorText = isGain ? "text-gain" : "text-loss";
  const colorBg = isGain ? "bg-gain/10" : "bg-loss/10";

  return (
    <div className="flex items-center justify-between rounded-lg px-3 py-2.5 transition-colors hover:bg-muted/60">
      <div className="flex items-center gap-3">
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${colorBg}`}>
          <Icon className={`h-4 w-4 ${colorText}`} />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">{mover.ticker}</p>
          <p className="max-w-[140px] truncate text-xs text-muted-foreground">
            {mover.name}
          </p>
        </div>
      </div>
      <div className="text-right">
        <p className={`text-sm font-medium ${colorText}`}>
          {formatCurrency(mover.changeCents, { showSign: true })}
        </p>
        <p className={`text-xs ${colorText}`}>
          {formatPercent(mover.changePercent, { showSign: true })}
        </p>
      </div>
    </div>
  );
}

// ─── Empty state ─────────────────────────────────────────────────────

function EmptyColumn({ label }: { label: string }) {
  return (
    <div className="flex h-24 items-center justify-center rounded-lg border border-dashed border-border">
      <p className="text-xs text-muted-foreground">No {label} today</p>
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────

interface TopMoversProps {
  data: TopMoversData;
}

export function TopMovers({ data }: TopMoversProps) {
  return (
    <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
      <h2 className="text-sm font-medium text-muted-foreground">
        Top Movers Today
      </h2>

      <div className="mt-4 grid gap-6 sm:grid-cols-2">
        {/* Gainers */}
        <div>
          <div className="mb-2 flex items-center gap-1.5">
            <TrendingUp className="h-3.5 w-3.5 text-gain" />
            <span className="text-xs font-medium text-gain">Gainers</span>
          </div>
          {data.gainers.length > 0 ? (
            <div className="space-y-1">
              {data.gainers.map((m) => (
                <MoverRow key={m.ticker} mover={m} type="gainer" />
              ))}
            </div>
          ) : (
            <EmptyColumn label="gainers" />
          )}
        </div>

        {/* Losers */}
        <div>
          <div className="mb-2 flex items-center gap-1.5">
            <TrendingDown className="h-3.5 w-3.5 text-loss" />
            <span className="text-xs font-medium text-loss">Losers</span>
          </div>
          {data.losers.length > 0 ? (
            <div className="space-y-1">
              {data.losers.map((m) => (
                <MoverRow key={m.ticker} mover={m} type="loser" />
              ))}
            </div>
          ) : (
            <EmptyColumn label="losers" />
          )}
        </div>
      </div>
    </div>
  );
}
