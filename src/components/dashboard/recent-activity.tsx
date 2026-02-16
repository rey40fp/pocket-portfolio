import {
  Plus,
  Pencil,
  Trash2,
  LogIn,
  Download,
  ShieldCheck,
  Activity,
} from "lucide-react";
import { formatRelativeTime } from "@/lib/utils";
import type { ActivityEntry } from "@/server/dal/dashboard";

// ─── Action display config ───────────────────────────────────────────

const ACTION_CONFIG: Record<string, { icon: React.ComponentType<{ className?: string }>; label: string; color: string; bg: string }> = {
  CREATE:      { icon: Plus,        label: "Created",  color: "text-gain",             bg: "bg-gain/10" },
  UPDATE:      { icon: Pencil,      label: "Updated",  color: "text-primary",          bg: "bg-primary/10" },
  DELETE:      { icon: Trash2,      label: "Deleted",  color: "text-loss",             bg: "bg-loss/10" },
  LOGIN:       { icon: LogIn,       label: "Signed in", color: "text-muted-foreground", bg: "bg-muted" },
  EXPORT:      { icon: Download,    label: "Exported", color: "text-muted-foreground", bg: "bg-muted" },
  ROLE_CHANGE: { icon: ShieldCheck, label: "Role changed", color: "text-warning",      bg: "bg-warning/10" },
};

const RESOURCE_LABELS: Record<string, string> = {
  account: "account",
  holding: "holding",
  lot: "lot",
  transaction: "transaction",
  household: "household",
  portfolio: "portfolio",
  user: "user",
};

// ─── Detail extractor ────────────────────────────────────────────────

function getDetail(entry: ActivityEntry): string {
  const m = entry.metadata;
  const resource = RESOURCE_LABELS[entry.resourceType] ?? entry.resourceType;

  if (m.name && typeof m.name === "string") return `${resource} "${m.name}"`;
  if (m.ticker && typeof m.ticker === "string") return `${resource} ${m.ticker}`;
  if (m.changes && Array.isArray(m.changes)) return `${resource} fields: ${(m.changes as string[]).join(", ")}`;

  return resource;
}

// ─── Single row ──────────────────────────────────────────────────────

function ActivityRow({ entry }: { entry: ActivityEntry }) {
  const config = ACTION_CONFIG[entry.action] ?? {
    icon: Activity,
    label: entry.action,
    color: "text-muted-foreground",
    bg: "bg-muted",
  };
  const Icon = config.icon;
  const detail = getDetail(entry);

  return (
    <div className="flex items-start gap-3 px-1 py-2.5">
      <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${config.bg}`}>
        <Icon className={`h-3.5 w-3.5 ${config.color}`} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-foreground">
          <span className="font-medium">{config.label}</span>{" "}
          <span className="text-muted-foreground">{detail}</span>
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {formatRelativeTime(entry.createdAt)}
        </p>
      </div>
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────

interface RecentActivityProps {
  entries: ActivityEntry[];
}

export function RecentActivity({ entries }: RecentActivityProps) {
  return (
    <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
      <h2 className="text-sm font-medium text-muted-foreground">
        Recent Activity
      </h2>

      {entries.length > 0 ? (
        <div className="mt-3 divide-y divide-border">
          {entries.map((entry) => (
            <ActivityRow key={entry.id} entry={entry} />
          ))}
        </div>
      ) : (
        <div className="mt-6 flex flex-col items-center py-8">
          <Activity className="h-8 w-8 text-muted-foreground/40" />
          <p className="mt-2 text-sm text-muted-foreground">
            No activity yet. Start by adding an account.
          </p>
        </div>
      )}
    </div>
  );
}
