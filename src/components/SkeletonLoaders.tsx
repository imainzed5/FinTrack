/**
 * Skeleton loading components for improved perceived performance.
 * These replace spinner/loading circles to give users better visual feedback.
 */

export function DashboardSkeleton() {
  return (
    <div className="dashboard-home min-h-screen">
      <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6 md:py-6">
        <section>
          <header className="mb-6">
            <div className="mb-3 flex items-center gap-2 md:hidden">
              <div className="h-8 w-24 animate-pulse rounded-full border border-[color:var(--color-border-tertiary,#d9d7cf)] bg-white" />
              <div className="h-8 w-24 animate-pulse rounded-full border border-[color:var(--color-border-tertiary,#d9d7cf)] bg-white" />
            </div>

            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-2">
                <div className="h-3 w-32 animate-pulse rounded bg-zinc-200" />
                <div className="h-9 w-56 max-w-full animate-pulse rounded bg-zinc-200 md:w-72" />
                <div className="h-3 w-28 animate-pulse rounded bg-zinc-200" />
              </div>

              <div className="mt-1 hidden shrink-0 items-center gap-2 md:flex">
                <div className="h-8 w-24 animate-pulse rounded-full border border-[color:var(--color-border-tertiary,#d9d7cf)] bg-white" />
                <div className="h-8 w-24 animate-pulse rounded-full border border-[color:var(--color-border-tertiary,#d9d7cf)] bg-white" />
              </div>
            </div>
          </header>

          <section className="mt-4 rounded-[20px] border border-[#0b5b47] bg-[#0F6E56] px-4 py-4 text-left md:rounded-2xl md:px-5">
            <div className="flex items-center gap-3 md:gap-4">
              <div className="h-[72px] w-[72px] shrink-0 animate-pulse rounded-2xl bg-[#E1F5EE]/60" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="h-3 w-24 animate-pulse rounded bg-emerald-100/55" />
                <div className="h-4 w-full animate-pulse rounded bg-white/30" />
                <div className="h-4 w-10/12 animate-pulse rounded bg-white/20" />
                <div className="h-3 w-40 animate-pulse rounded bg-white/20" />
              </div>
            </div>
          </section>

          <section className="mt-4 grid grid-cols-2 gap-[10px] md:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <article
                key={index}
                className="rounded-2xl border-[0.5px] border-[color:var(--color-border-tertiary,#d9d7cf)] bg-white p-3.5 md:p-3"
              >
                <div className="mb-2 flex items-center justify-between">
                  <div className="h-3 w-24 animate-pulse rounded bg-zinc-200" />
                  <div className="h-4 w-4 animate-pulse rounded-full bg-zinc-200" />
                </div>
                <div className="h-7 w-24 animate-pulse rounded bg-zinc-200" />
                <div className="mt-2 h-3 w-28 animate-pulse rounded bg-zinc-200" />
              </article>
            ))}
          </section>

          <section className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-4">
              <article className="rounded-2xl border-[0.5px] border-[color:var(--color-border-tertiary,#d9d7cf)] bg-white p-4">
                <div className="flex items-center justify-between">
                  <div className="h-4 w-24 animate-pulse rounded bg-zinc-200" />
                  <div className="h-3 w-14 animate-pulse rounded bg-zinc-200" />
                </div>
                <div className="mt-4 flex h-[60px] items-end gap-1.5 md:h-[52px]">
                  {Array.from({ length: 7 }).map((_, index) => (
                    <div key={index} className="flex flex-1 items-end">
                      <div
                        className="w-full animate-pulse rounded-md bg-zinc-200"
                        style={{ height: `${[42, 56, 34, 60, 48, 26, 52][index]}%` }}
                      />
                    </div>
                  ))}
                </div>
                <div className="mt-2 flex gap-1.5">
                  {Array.from({ length: 7 }).map((_, index) => (
                    <div key={index} className="h-3 flex-1 animate-pulse rounded bg-zinc-200" />
                  ))}
                </div>
              </article>

              <article className="rounded-2xl border-[0.5px] border-[color:var(--color-border-tertiary,#d9d7cf)] bg-white p-4">
                <div className="flex items-center justify-between">
                  <div className="h-4 w-20 animate-pulse rounded bg-zinc-200" />
                  <div className="h-3 w-14 animate-pulse rounded bg-zinc-200" />
                </div>
                <div className="mt-3 space-y-3">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <div key={index} className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 flex-1 items-start gap-2.5">
                        <div className="h-8 w-8 shrink-0 animate-pulse rounded-full bg-zinc-200" />
                        <div className="min-w-0 flex-1 space-y-1.5">
                          <div className="h-3.5 w-28 animate-pulse rounded bg-zinc-200" />
                          <div className="h-3 w-20 animate-pulse rounded bg-zinc-200" />
                        </div>
                      </div>
                      <div className="h-4 w-14 animate-pulse rounded bg-zinc-200" />
                    </div>
                  ))}
                </div>
              </article>
            </div>

            <article className="rounded-2xl border-[0.5px] border-[color:var(--color-border-tertiary,#d9d7cf)] bg-white p-4">
              <div className="flex items-center justify-between">
                <div className="h-4 w-36 animate-pulse rounded bg-zinc-200" />
                <div className="h-3 w-14 animate-pulse rounded bg-zinc-200" />
              </div>
              <div className="mt-3 space-y-3">
                {Array.from({ length: 5 }).map((_, index) => (
                  <div key={index} className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-1 items-start gap-2.5">
                      <div className="h-8 w-8 shrink-0 animate-pulse rounded-full bg-zinc-200" />
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <div className="h-3.5 w-32 animate-pulse rounded bg-zinc-200" />
                        <div className="h-3 w-28 animate-pulse rounded bg-zinc-200" />
                      </div>
                    </div>
                    <div className="h-4 w-16 animate-pulse rounded bg-zinc-200" />
                  </div>
                ))}
              </div>
            </article>
          </section>
        </section>
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
