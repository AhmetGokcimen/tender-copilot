/** Placeholder with the same layout as a tender card, shown while the feed loads. */
export function TenderCardSkeleton() {
  return (
    <div
      aria-hidden
      className="animate-pulse rounded-xl border border-outline-variant bg-surface-container-lowest p-space-lg shadow-sm"
    >
      <div className="flex flex-col gap-space-md lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 flex-1 flex-col gap-space-sm">
          <div className="flex items-center gap-space-xs">
            <div className="h-6 w-12 rounded-pill bg-surface-container-high" />
            <div className="h-6 w-24 rounded-pill bg-surface-container-high" />
            <div className="h-4 w-20 rounded bg-surface-container" />
          </div>
          <div className="h-5 w-4/5 rounded bg-surface-container-high" />
          <div className="h-4 w-3/5 rounded bg-surface-container" />
          <div className="flex flex-wrap gap-space-md pt-1">
            <div className="h-4 w-40 rounded bg-surface-container" />
            <div className="h-4 w-24 rounded bg-surface-container" />
            <div className="h-4 w-28 rounded bg-surface-container" />
          </div>
        </div>
        <div className="flex gap-space-xs lg:flex-col">
          <div className="h-9 w-28 rounded-pill bg-surface-container-high" />
          <div className="h-9 w-28 rounded-pill bg-surface-container" />
        </div>
      </div>
    </div>
  );
}
