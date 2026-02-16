function SkeletonPulse({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-muted ${className ?? ""}`} />;
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
        <SkeletonPulse className="h-4 w-28" />
      </td>
      <td className="px-4 py-3">
        <SkeletonPulse className="h-5 w-16 rounded-md" />
      </td>
      <td className="px-4 py-3 text-right">
        <SkeletonPulse className="ml-auto h-4 w-12" />
      </td>
      <td className="px-4 py-3 text-right">
        <SkeletonPulse className="ml-auto h-4 w-20" />
      </td>
      <td className="px-4 py-3 text-right">
        <SkeletonPulse className="ml-auto h-4 w-20" />
      </td>
      <td className="px-4 py-3 text-right">
        <SkeletonPulse className="ml-auto h-4 w-24" />
      </td>
    </tr>
  );
}

export default function AccountDetailLoading() {
  return (
    <div className="mx-auto max-w-7xl">
      {/* Back link + header */}
      <div>
        <SkeletonPulse className="mb-3 h-4 w-24" />
        <SkeletonPulse className="h-7 w-44" />
        <div className="mt-1.5 flex items-center gap-2">
          <SkeletonPulse className="h-4 w-20" />
          <SkeletonPulse className="h-4 w-28" />
        </div>
      </div>

      {/* KPI Cards */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SkeletonKPICard />
        <SkeletonKPICard />
        <SkeletonKPICard />
        <SkeletonKPICard />
      </div>

      {/* Allocation + Table */}
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        {/* Allocation skeleton */}
        <div className="rounded-lg border border-border bg-card p-6 shadow-sm lg:col-span-1">
          <SkeletonPulse className="h-4 w-32" />
          <div className="mt-4 flex flex-col items-center gap-4 sm:flex-row">
            <SkeletonPulse className="h-52 w-52 shrink-0 rounded-full" />
            <div className="flex flex-1 flex-col gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
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

        {/* Holdings table skeleton */}
        <div className="lg:col-span-2">
          <SkeletonPulse className="mb-3 h-4 w-16" />
          <div className="rounded-lg border border-border bg-card shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="px-4 py-3 text-left">
                      <SkeletonPulse className="h-4 w-12" />
                    </th>
                    <th className="px-4 py-3 text-left">
                      <SkeletonPulse className="h-4 w-10" />
                    </th>
                    <th className="px-4 py-3 text-right">
                      <SkeletonPulse className="ml-auto h-4 w-12" />
                    </th>
                    <th className="px-4 py-3 text-right">
                      <SkeletonPulse className="ml-auto h-4 w-16" />
                    </th>
                    <th className="px-4 py-3 text-right">
                      <SkeletonPulse className="ml-auto h-4 w-12" />
                    </th>
                    <th className="px-4 py-3 text-right">
                      <SkeletonPulse className="ml-auto h-4 w-16" />
                    </th>
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
        </div>
      </div>
    </div>
  );
}
