export default function DashboardPage() {
  return (
    <div className="mx-auto max-w-7xl">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        Dashboard
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Welcome to Pocket Portfolio. Your holdings overview will appear here.
      </p>

      {/* Placeholder grid — KPI cards and charts will replace this in Phase 1F */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="flex h-32 items-center justify-center rounded-lg border border-border bg-card text-sm text-muted-foreground shadow-sm"
          >
            KPI Card Placeholder
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="flex h-64 items-center justify-center rounded-lg border border-border bg-card text-sm text-muted-foreground shadow-sm">
          Net Worth Chart Placeholder
        </div>
        <div className="flex h-64 items-center justify-center rounded-lg border border-border bg-card text-sm text-muted-foreground shadow-sm">
          Asset Allocation Placeholder
        </div>
      </div>
    </div>
  );
}
