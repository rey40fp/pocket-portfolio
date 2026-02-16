function SkeletonPulse({ className }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-md bg-muted ${className ?? ""}`} />
  );
}

function SkeletonKPICard() {
  return (
    <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <SkeletonPulse className="h-4 w-24" />
        <SkeletonPulse className="h-9 w-9 rounded-lg" />
      </div>
      <SkeletonPulse className="mt-2 h-7 w-32" />
      <SkeletonPulse className="mt-1.5 h-3 w-16" />
    </div>
  );
}

function SkeletonTableRow() {
  return (
    <tr className="border-b border-border">
      <td className="px-4 py-3">
        <div className="flex flex-col gap-1">
          <SkeletonPulse className="h-4 w-14" />
          <SkeletonPulse className="h-3 w-28" />
        </div>
      </td>
      <td className="px-4 py-3">
        <SkeletonPulse className="h-5 w-16 rounded-full" />
      </td>
      <td className="px-4 py-3">
        <div className="flex justify-end">
          <SkeletonPulse className="h-4 w-12" />
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex justify-end">
          <SkeletonPulse className="h-4 w-20" />
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex justify-end">
          <SkeletonPulse className="h-4 w-20" />
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex justify-end">
          <SkeletonPulse className="h-4 w-24" />
        </div>
      </td>
      <td className="px-4 py-3">
        <SkeletonPulse className="h-4 w-20" />
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-col gap-1">
          <SkeletonPulse className="h-4 w-16" />
          <SkeletonPulse className="h-3 w-24" />
        </div>
      </td>
    </tr>
  );
}

export default function RealizedTransactionsLoading() {
  return (
    <div className="mx-auto max-w-7xl">
      {/* Header */}
      <div>
        <SkeletonPulse className="mb-3 h-4 w-24" />
        <SkeletonPulse className="h-7 w-56" />
        <SkeletonPulse className="mt-2 h-4 w-64" />
      </div>

      {/* KPI Cards */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SkeletonKPICard />
        <SkeletonKPICard />
        <SkeletonKPICard />
        <SkeletonKPICard />
      </div>

      {/* Table */}
      <div className="mt-6 rounded-lg border border-border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                {[
                  "Name / Ticker",
                  "Type",
                  "Shares Sold",
                  "Cost Basis",
                  "Proceeds",
                  "Realized G/L",
                  "Date Sold",
                  "Account",
                ].map((header) => (
                  <th
                    key={header}
                    className="px-4 py-3 text-left text-xs font-medium text-muted-foreground"
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <SkeletonTableRow />
              <SkeletonTableRow />
              <SkeletonTableRow />
              <SkeletonTableRow />
              <SkeletonTableRow />
            </tbody>
          </table>
        </div>
      </div>

      <SkeletonPulse className="mt-4 h-3 w-48" />
    </div>
  );
}
