function SkeletonPulse({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-muted ${className ?? ""}`} />;
}

function SkeletonKPICard() {
  return (
    <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <SkeletonPulse className="h-4 w-28" />
        <SkeletonPulse className="h-9 w-9 rounded-lg" />
      </div>
      <SkeletonPulse className="mt-3 h-8 w-36" />
      <div className="mt-2 flex items-center gap-1.5">
        <SkeletonPulse className="h-5 w-16 rounded-md" />
        <SkeletonPulse className="h-4 w-20" />
      </div>
    </div>
  );
}

function SkeletonChart() {
  return (
    <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <SkeletonPulse className="h-4 w-32" />
          <SkeletonPulse className="mt-2 h-6 w-24" />
        </div>
        <SkeletonPulse className="h-8 w-48 rounded-lg" />
      </div>
      <SkeletonPulse className="mt-4 h-64 w-full rounded-md" />
    </div>
  );
}

function SkeletonAllocation() {
  return (
    <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
      <SkeletonPulse className="h-4 w-32" />
      <div className="mt-4 flex flex-col items-center gap-4 sm:flex-row">
        <SkeletonPulse className="h-52 w-52 shrink-0 rounded-full" />
        <div className="flex flex-1 flex-col gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <SkeletonPulse className="h-3 w-3 rounded-sm" />
                <SkeletonPulse className="h-4 w-20" />
              </div>
              <SkeletonPulse className="h-4 w-16" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SkeletonMovers() {
  return (
    <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
      <SkeletonPulse className="h-4 w-32" />
      <div className="mt-4 grid gap-6 sm:grid-cols-2">
        {[0, 1].map((col) => (
          <div key={col}>
            <SkeletonPulse className="mb-2 h-4 w-16" />
            <div className="space-y-1">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between rounded-lg px-3 py-2.5">
                  <div className="flex items-center gap-3">
                    <SkeletonPulse className="h-8 w-8 rounded-lg" />
                    <div>
                      <SkeletonPulse className="h-4 w-12" />
                      <SkeletonPulse className="mt-1 h-3 w-24" />
                    </div>
                  </div>
                  <div className="text-right">
                    <SkeletonPulse className="h-4 w-14" />
                    <SkeletonPulse className="mt-1 h-3 w-10 ml-auto" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SkeletonActivity() {
  return (
    <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
      <SkeletonPulse className="h-4 w-28" />
      <div className="mt-3 divide-y divide-border">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-start gap-3 py-2.5 px-1">
            <SkeletonPulse className="mt-0.5 h-7 w-7 shrink-0 rounded-full" />
            <div className="flex-1">
              <SkeletonPulse className="h-4 w-48" />
              <SkeletonPulse className="mt-1 h-3 w-20" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function DashboardLoading() {
  return (
    <div className="mx-auto max-w-7xl">
      {/* Title */}
      <SkeletonPulse className="h-7 w-32" />
      <SkeletonPulse className="mt-2 h-4 w-48" />

      {/* KPI Cards */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <SkeletonKPICard />
        <SkeletonKPICard />
        <SkeletonKPICard />
      </div>

      {/* Charts */}
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <SkeletonChart />
        <SkeletonAllocation />
      </div>

      {/* Top Movers + Activity */}
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <SkeletonMovers />
        <SkeletonActivity />
      </div>
    </div>
  );
}
