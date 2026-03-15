/**
 * Skeleton loading components for improved perceived performance.
 * These replace spinner/loading circles to give users better visual feedback.
 */

export function DashboardSkeleton() {
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
      {/* Header */}
      <div className="mb-6">
        <div className="h-8 w-32 bg-zinc-200 dark:bg-zinc-700 rounded-lg animate-pulse mb-2" />
        <div className="h-4 w-48 bg-zinc-100 dark:bg-zinc-800 rounded-lg animate-pulse" />
      </div>

      {/* Stats Cards - 4 columns */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white dark:bg-zinc-900 rounded-2xl p-5 border border-zinc-100 dark:border-zinc-800">
            <div className="h-4 w-24 bg-zinc-100 dark:bg-zinc-800 rounded animate-pulse mb-3" />
            <div className="h-8 w-32 bg-zinc-100 dark:bg-zinc-800 rounded animate-pulse mb-2" />
            <div className="h-3 w-40 bg-zinc-100 dark:bg-zinc-800 rounded animate-pulse" />
          </div>
        ))}
      </div>

      {/* Charts Row - 2 columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="bg-white dark:bg-zinc-900 rounded-2xl p-5 border border-zinc-100 dark:border-zinc-800">
            <div className="h-5 w-40 bg-zinc-100 dark:bg-zinc-800 rounded animate-pulse mb-4" />
            <div className="h-64 bg-zinc-100 dark:bg-zinc-800 rounded animate-pulse" />
          </div>
        ))}
      </div>

      {/* Budget Progress + Last 7 Days */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="bg-white dark:bg-zinc-900 rounded-2xl p-5 border border-zinc-100 dark:border-zinc-800">
            <div className="h-5 w-32 bg-zinc-100 dark:bg-zinc-800 rounded animate-pulse mb-4" />
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, j) => (
                <div key={j} className="h-12 bg-zinc-100 dark:bg-zinc-800 rounded animate-pulse" />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Monthly Savings History */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 border border-zinc-100 dark:border-zinc-800">
        <div className="h-5 w-48 bg-zinc-100 dark:bg-zinc-800 rounded animate-pulse mb-4" />
        <div className="h-64 bg-zinc-100 dark:bg-zinc-800 rounded animate-pulse" />
      </div>
    </div>
  );
}

export function InsightsSkeleton() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
      {/* Header */}
      <div className="mb-6">
        <div className="h-8 w-32 bg-zinc-200 dark:bg-zinc-700 rounded-lg animate-pulse mb-2" />
        <div className="h-4 w-48 bg-zinc-100 dark:bg-zinc-800 rounded-lg animate-pulse" />
      </div>

      {/* Filter buttons */}
      <div className="flex gap-2 pb-4 mb-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-10 w-24 bg-zinc-100 dark:bg-zinc-800 rounded-lg animate-pulse" />
        ))}
      </div>

      {/* Insight cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white dark:bg-zinc-900 rounded-2xl p-5 border border-zinc-100 dark:border-zinc-800">
            <div className="h-5 w-32 bg-zinc-100 dark:bg-zinc-800 rounded animate-pulse mb-3" />
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, j) => (
                <div key={j} className="h-4 bg-zinc-100 dark:bg-zinc-800 rounded animate-pulse" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SettingsSkeleton() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
      {/* Header */}
      <div className="mb-6">
        <div className="h-8 w-32 bg-zinc-200 dark:bg-zinc-700 rounded-lg animate-pulse mb-2" />
        <div className="h-4 w-48 bg-zinc-100 dark:bg-zinc-800 rounded-lg animate-pulse" />
      </div>

      {/* Add Budget Form Skeleton */}
      <div className="mb-4 p-4 bg-zinc-50 dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700">
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-10 bg-zinc-100 dark:bg-zinc-700 rounded animate-pulse" />
          ))}
          <div className="flex gap-2">
            <div className="h-10 bg-zinc-100 dark:bg-zinc-700 rounded animate-pulse w-20" />
            <div className="h-10 bg-zinc-100 dark:bg-zinc-700 rounded animate-pulse w-20" />
          </div>
        </div>
      </div>

      {/* Budget Items List */}
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="p-3 bg-zinc-50 dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700">
            <div className="h-5 w-40 bg-zinc-100 dark:bg-zinc-700 rounded animate-pulse mb-2" />
            <div className="h-8 w-32 bg-zinc-100 dark:bg-zinc-700 rounded animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function TransactionsSkeleton() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-4 pb-6">
      <div className="mb-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
        <div className="h-7 w-40 bg-zinc-200 dark:bg-zinc-700 rounded-lg animate-pulse mb-2" />
        <div className="h-5 w-28 bg-zinc-100 dark:bg-zinc-800 rounded-lg animate-pulse mb-3" />
        <div className="h-4 w-48 bg-zinc-100 dark:bg-zinc-800 rounded-lg animate-pulse" />
      </div>

      <div className="space-y-3 mb-5">
        <div className="flex gap-2">
          <div className="h-12 flex-1 bg-zinc-100 dark:bg-zinc-800 rounded-xl animate-pulse" />
          <div className="h-12 w-28 bg-zinc-100 dark:bg-zinc-800 rounded-xl animate-pulse" />
        </div>
        <div className="h-3 w-56 bg-zinc-100 dark:bg-zinc-800 rounded animate-pulse" />
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-700 p-3">
          <div className="h-3 w-24 bg-zinc-100 dark:bg-zinc-800 rounded animate-pulse mb-2" />
          <div className="flex gap-2 overflow-hidden">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-10 w-24 bg-zinc-100 dark:bg-zinc-800 rounded-lg animate-pulse" />
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {Array.from({ length: 2 }).map((_, sectionIndex) => (
          <div key={sectionIndex} className="space-y-2">
            <div className="h-4 w-16 bg-zinc-100 dark:bg-zinc-800 rounded animate-pulse" />
            {Array.from({ length: 3 }).map((__, rowIndex) => (
              <div
                key={`${sectionIndex}-${rowIndex}`}
                className="p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800"
              >
                <div className="h-8 w-32 bg-zinc-100 dark:bg-zinc-800 rounded animate-pulse mb-3" />
                <div className="h-5 w-40 bg-zinc-100 dark:bg-zinc-800 rounded animate-pulse mb-2" />
                <div className="h-4 w-28 bg-zinc-100 dark:bg-zinc-800 rounded animate-pulse mb-2" />
                <div className="h-3 w-20 bg-zinc-100 dark:bg-zinc-800 rounded animate-pulse" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="space-y-4 p-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-12 bg-zinc-100 dark:bg-zinc-800 rounded-lg animate-pulse" />
      ))}
    </div>
  );
}
