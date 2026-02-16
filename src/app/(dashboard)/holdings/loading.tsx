function SkeletonPulse({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-muted ${className ?? ""}`} />;
}

function SkeletonTableRow() {
  return (
    <tr className="border-b border-border">
      {/* Name / Ticker */}
      <td className="px-4 py-3">
        <div className="flex flex-col gap-1">
          <SkeletonPulse className="h-4 w-14" />
          <SkeletonPulse className="h-3 w-28" />
        </div>
      </td>
      {/* Asset Type */}
      <td className="px-4 py-3">
        <SkeletonPulse className="h-5 w-16 rounded-full" />
      </td>
      {/* Shares */}
      <td className="px-4 py-3">
        <div className="flex justify-end">
          <SkeletonPulse className="h-4 w-12" />
        </div>
      </td>
      {/* Avg Cost */}
      <td className="px-4 py-3">
        <div className="flex justify-end">
          <SkeletonPulse className="h-4 w-16" />
        </div>
      </td>
      {/* Current Price */}
      <td className="px-4 py-3">
        <div className="flex justify-end">
          <SkeletonPulse className="h-4 w-16" />
        </div>
      </td>
      {/* Market Value */}
      <td className="px-4 py-3">
        <div className="flex justify-end">
          <SkeletonPulse className="h-4 w-20" />
        </div>
      </td>
      {/* Gain/Loss ($) */}
      <td className="px-4 py-3">
        <div className="flex justify-end">
          <SkeletonPulse className="h-4 w-18" />
        </div>
      </td>
      {/* Gain/Loss (%) */}
      <td className="px-4 py-3">
        <div className="flex justify-end">
          <SkeletonPulse className="h-4 w-14" />
        </div>
      </td>
      {/* Custodian */}
      <td className="px-4 py-3">
        <div className="flex flex-col gap-1">
          <SkeletonPulse className="h-4 w-16" />
          <SkeletonPulse className="h-3 w-24" />
        </div>
      </td>
    </tr>
  );
}

export default function HoldingsLoading() {
  return (
    <div className="mx-auto max-w-7xl">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <SkeletonPulse className="h-7 w-28" />
          <SkeletonPulse className="mt-2 h-4 w-72" />
        </div>
      </div>

      {/* Toolbar */}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SkeletonPulse className="h-9 w-64 rounded-md" />
        <SkeletonPulse className="h-9 w-28 rounded-md" />
      </div>

      {/* Table */}
      <div className="mt-4 rounded-lg border border-border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                {[
                  "Name / Ticker",
                  "Asset Type",
                  "Shares",
                  "Avg Cost",
                  "Current Price",
                  "Market Value",
                  "Gain/Loss ($)",
                  "Gain/Loss (%)",
                  "Custodian",
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
              <SkeletonTableRow />
              <SkeletonTableRow />
              <SkeletonTableRow />
            </tbody>
          </table>
        </div>
      </div>

      {/* Results summary */}
      <SkeletonPulse className="mt-4 h-3 w-40" />
    </div>
  );
}
