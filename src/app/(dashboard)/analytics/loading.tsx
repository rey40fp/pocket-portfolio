function SkeletonPulse({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-muted ${className ?? ""}`} />;
}

function SkeletonValueChart() {
  return (
    <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <SkeletonPulse className="h-4 w-44" />
          <div className="mt-2 flex items-baseline gap-2">
            <SkeletonPulse className="h-6 w-28" />
            <SkeletonPulse className="h-4 w-16" />
          </div>
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <SkeletonPulse className="h-8 w-56 rounded-lg" />
          <SkeletonPulse className="h-8 w-36 rounded-md" />
        </div>
      </div>
      {/* Chart area */}
      <SkeletonPulse className="mt-4 h-80 w-full rounded-md" />
      {/* Footer note */}
      <SkeletonPulse className="mt-3 h-3 w-96 max-w-full" />
    </div>
  );
}

export default function AnalyticsLoading() {
  return (
    <div className="mx-auto max-w-7xl">
      {/* Title */}
      <SkeletonPulse className="h-7 w-28" />
      <SkeletonPulse className="mt-2 h-4 w-72" />

      {/* Portfolio Value Chart */}
      <div className="mt-6">
        <SkeletonValueChart />
      </div>
    </div>
  );
}
