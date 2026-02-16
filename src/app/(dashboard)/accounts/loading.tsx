function SkeletonPulse({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-muted ${className ?? ""}`} />;
}

function SkeletonAccountCard() {
  return (
    <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
      {/* Top row: icon + name */}
      <div className="flex items-start gap-3">
        <SkeletonPulse className="h-10 w-10 shrink-0 rounded-lg" />
        <div className="flex-1">
          <SkeletonPulse className="h-4 w-32" />
          <SkeletonPulse className="mt-1.5 h-3 w-20" />
        </div>
      </div>

      {/* Badge */}
      <SkeletonPulse className="mt-3 h-5 w-28 rounded-md" />

      {/* Value + holdings */}
      <div className="mt-4 flex items-end justify-between">
        <div>
          <SkeletonPulse className="h-3 w-16" />
          <SkeletonPulse className="mt-1.5 h-6 w-24" />
        </div>
        <SkeletonPulse className="h-3 w-16" />
      </div>
    </div>
  );
}

export default function AccountsLoading() {
  return (
    <div className="mx-auto max-w-7xl">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <SkeletonPulse className="h-7 w-28" />
          <SkeletonPulse className="mt-2 h-4 w-56" />
        </div>
        <SkeletonPulse className="h-9 w-32 rounded-md" />
      </div>

      {/* Account Cards */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <SkeletonAccountCard />
        <SkeletonAccountCard />
        <SkeletonAccountCard />
        <SkeletonAccountCard />
        <SkeletonAccountCard />
        <SkeletonAccountCard />
      </div>
    </div>
  );
}
