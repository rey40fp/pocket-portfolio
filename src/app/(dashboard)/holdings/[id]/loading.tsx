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

function SkeletonLotRow() {
  return (
    <tr className="border-b border-border">
      <td className="px-4 py-3">
        <SkeletonPulse className="h-4 w-20" />
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
        <SkeletonPulse className="ml-auto h-4 w-20" />
      </td>
      <td className="px-4 py-3 text-right">
        <SkeletonPulse className="ml-auto h-4 w-24" />
      </td>
    </tr>
  );
}

export default function HoldingDetailLoading() {
  return (
    <div className="mx-auto max-w-7xl">
      {/* Back link + header */}
      <div>
        <SkeletonPulse className="mb-3 h-4 w-24" />
        <div className="flex items-center gap-3">
          <SkeletonPulse className="h-8 w-48" />
          <SkeletonPulse className="h-6 w-16 rounded-md" />
        </div>
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

      {/* Chart skeleton */}
      <div className="mt-6 rounded-lg border border-border bg-card shadow-sm">
        <div className="border-b border-border px-5 py-3">
          <SkeletonPulse className="h-4 w-32" />
        </div>
        <SkeletonPulse className="h-[300px] w-full rounded-b-lg" />
      </div>

      {/* Lot table skeleton */}
      <div className="mt-6">
        <SkeletonPulse className="mb-3 h-4 w-24" />
        <div className="rounded-lg border border-border bg-card shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-4 py-3 text-left">
                    <SkeletonPulse className="h-4 w-16" />
                  </th>
                  <th className="px-4 py-3 text-right">
                    <SkeletonPulse className="ml-auto h-4 w-12" />
                  </th>
                  <th className="px-4 py-3 text-right">
                    <SkeletonPulse className="ml-auto h-4 w-16" />
                  </th>
                  <th className="px-4 py-3 text-right">
                    <SkeletonPulse className="ml-auto h-4 w-16" />
                  </th>
                  <th className="px-4 py-3 text-right">
                    <SkeletonPulse className="ml-auto h-4 w-16" />
                  </th>
                  <th className="px-4 py-3 text-right">
                    <SkeletonPulse className="ml-auto h-4 w-20" />
                  </th>
                </tr>
              </thead>
              <tbody>
                <SkeletonLotRow />
                <SkeletonLotRow />
                <SkeletonLotRow />
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
