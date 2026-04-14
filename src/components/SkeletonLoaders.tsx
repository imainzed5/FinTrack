/**
 * Skeleton loading components for improved perceived performance.
 * These replace spinner/loading circles to give users better visual feedback.
 */

export function DashboardSkeleton() {
  return (
    <div className="dashboard-home min-h-screen">
      <div className="w-full px-4 py-5 sm:px-6 md:py-6 xl:px-8">
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

          <section className="mt-4 md:flex md:items-start md:gap-6">
            <div className="min-w-0 flex-1 space-y-4">
              <div className="grid grid-cols-1 gap-4 min-[1180px]:grid-cols-2 min-[1180px]:items-stretch">
                <article className="flex min-h-[220px] flex-col rounded-2xl border-[0.5px] border-[color:var(--color-border-tertiary,#d9d7cf)] bg-white p-4 md:min-h-[280px]">
                  <div className="flex items-center justify-between">
                    <div className="space-y-2">
                      <div className="h-4 w-24 animate-pulse rounded bg-zinc-200" />
                      <div className="h-3 w-44 animate-pulse rounded bg-zinc-200" />
                    </div>
                    <div className="h-3 w-14 animate-pulse rounded bg-zinc-200" />
                  </div>

                  <div className="mt-5 flex flex-1 flex-col justify-end">
                    <div className="flex h-[104px] flex-1 items-end gap-2 md:min-h-[180px]">
                      {Array.from({ length: 7 }).map((_, index) => (
                        <div key={index} className="flex h-full flex-1 items-end">
                          <div
                            className="w-full animate-pulse rounded-t-[10px] rounded-b-md bg-zinc-200"
                            style={{ height: `${[10, 0, 0, 0, 10, 76, 0][index]}%` }}
                          />
                        </div>
                      ))}
                    </div>

                    <div className="mt-3 flex gap-2">
                      {Array.from({ length: 7 }).map((_, index) => (
                        <div key={index} className="h-3 flex-1 animate-pulse rounded bg-zinc-200" />
                      ))}
                    </div>
                  </div>
                </article>

                <article className="flex h-full min-h-[220px] flex-col rounded-2xl border-[0.5px] border-[color:var(--color-border-tertiary,#d9d7cf)] bg-white p-4 md:min-h-[280px]">
                  <div className="flex items-center justify-between">
                    <div className="h-4 w-24 animate-pulse rounded bg-zinc-200" />
                    <div className="h-3 w-14 animate-pulse rounded bg-zinc-200" />
                  </div>

                  <div className="mt-3 flex flex-1 items-center justify-center">
                    <div className="flex w-full max-w-[240px] flex-col items-center gap-3 py-4 text-center">
                      <div className="h-10 w-10 animate-pulse rounded-xl bg-zinc-200" />
                      <div className="h-4 w-40 animate-pulse rounded bg-zinc-200" />
                      <div className="h-3 w-28 animate-pulse rounded bg-zinc-200" />
                    </div>
                  </div>
                </article>
              </div>

              <article className="hidden rounded-2xl border-[0.5px] border-[color:var(--color-border-tertiary,#d9d7cf)] bg-white p-4 md:block md:px-5 md:py-4">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="h-7 w-24 animate-pulse rounded-full bg-[#E1F5EE]" />
                    <div className="mt-2 h-7 w-44 animate-pulse rounded bg-zinc-200" />
                    <div className="mt-2 h-4 w-full max-w-xl animate-pulse rounded bg-zinc-200" />
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row xl:justify-end">
                    <div className="rounded-2xl bg-[#F7F5EE] px-4 py-3 sm:min-w-[170px]">
                      <div className="h-3 w-24 animate-pulse rounded bg-zinc-200" />
                      <div className="mt-2 h-5 w-28 animate-pulse rounded bg-zinc-200" />
                    </div>
                    <div className="rounded-2xl bg-[#F7F5EE] px-4 py-3 sm:min-w-[220px]">
                      <div className="h-3 w-16 animate-pulse rounded bg-zinc-200" />
                      <div className="mt-2 h-5 w-36 animate-pulse rounded bg-zinc-200" />
                    </div>
                  </div>
                </div>

                <div className="mt-3 flex flex-col gap-3 border-t border-[color:var(--color-border-tertiary,#e8dfd0)] pt-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="h-4 w-72 max-w-full animate-pulse rounded bg-zinc-200" />
                  <div className="h-4 w-20 animate-pulse rounded bg-zinc-200" />
                </div>
              </article>

              <article className="md:hidden rounded-2xl border-[0.5px] border-[color:var(--color-border-tertiary,#d9d7cf)] bg-white p-4">
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
            </div>

            <aside className="hidden md:block md:w-[300px] md:flex-shrink-0">
              <div className="md:sticky md:top-6 md:flex md:flex-col md:gap-3">
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
                            <div className="h-3.5 w-28 animate-pulse rounded bg-zinc-200" />
                            <div className="h-3 w-24 animate-pulse rounded bg-zinc-200" />
                          </div>
                        </div>
                        <div className="h-4 w-14 animate-pulse rounded bg-zinc-200" />
                      </div>
                    ))}
                  </div>
                </article>

                <article className="rounded-2xl border-[0.5px] border-[color:var(--color-border-tertiary,#d9d7cf)] bg-white p-4">
                  <div className="h-4 w-24 animate-pulse rounded bg-zinc-200" />
                  <div className="mt-2 h-3 w-36 animate-pulse rounded bg-zinc-200" />
                  <div className="mt-4 grid gap-2.5">
                    {Array.from({ length: 2 }).map((_, index) => (
                      <div key={index} className="rounded-2xl border border-zinc-200 p-4">
                        <div className="h-4 w-24 animate-pulse rounded bg-zinc-200" />
                        <div className="mt-2 h-3 w-28 animate-pulse rounded bg-zinc-200" />
                      </div>
                    ))}
                  </div>
                </article>

                <article className="rounded-2xl border-[0.5px] border-[color:var(--color-border-tertiary,#d9d7cf)] bg-white p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="h-4 w-24 animate-pulse rounded bg-zinc-200" />
                      <div className="mt-2 h-3 w-20 animate-pulse rounded bg-zinc-200" />
                    </div>
                    <div className="h-3 w-12 animate-pulse rounded bg-zinc-200" />
                  </div>
                  <div className="mt-4 space-y-3">
                    {Array.from({ length: 2 }).map((_, index) => (
                      <div key={index} className="rounded-2xl border border-zinc-200 p-3">
                        <div className="h-4 w-32 animate-pulse rounded bg-zinc-200" />
                        <div className="mt-3 h-2 rounded-full bg-zinc-100">
                          <div className="h-full w-1/2 animate-pulse rounded-full bg-zinc-200" />
                        </div>
                        <div className="mt-2 h-3 w-24 animate-pulse rounded bg-zinc-200" />
                      </div>
                    ))}
                  </div>
                </article>
              </div>
            </aside>
          </section>
        </section>
      </div>
    </div>
  );
}

export function InsightsSkeleton() {
  return (
    <div className="space-y-7 lg:space-y-5">
      <section>
        <div className="mb-3 h-3 w-36 rounded bg-zinc-200 dark:bg-zinc-700 animate-pulse" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 2 }).map((_, index) => (
            <article
              key={`alert-${index}`}
              className="rounded-[14px] border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3.5"
            >
              <div className="mb-3 h-[3px] w-full rounded-full bg-zinc-200 dark:bg-zinc-700 animate-pulse" />
              <div className="h-3 w-24 rounded bg-zinc-200 dark:bg-zinc-700 animate-pulse" />
              <div className="mt-2 h-9 w-28 rounded bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
              <div className="mt-2 h-3 w-10/12 rounded bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
              <div className="mt-3 space-y-2">
                <div className="h-9 rounded-lg bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
                <div className="h-9 rounded-lg bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
              </div>
            </article>
          ))}
        </div>
      </section>

      <div className="h-px bg-zinc-100 dark:bg-zinc-800" />

      <section>
        <div className="mb-3 h-3 w-44 rounded bg-zinc-200 dark:bg-zinc-700 animate-pulse" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1.45fr_1fr]">
          <article className="sm:col-span-2 lg:col-span-1 rounded-[12px] border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
            <div className="h-4 w-52 rounded bg-zinc-200 dark:bg-zinc-700 animate-pulse" />
            <div className="mt-4 grid grid-cols-7 gap-2">
              {Array.from({ length: 7 }).map((_, i) => (
                <div key={`day-${i}`} className="flex flex-col items-center gap-1.5">
                  <div className="h-24 w-full max-w-[44px] rounded-md bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
                  <div className="h-2.5 w-7 rounded bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
                  <div className="h-2.5 w-10 rounded bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-[12px] border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
            <div className="h-4 w-24 rounded bg-zinc-200 dark:bg-zinc-700 animate-pulse" />
            <div className="mt-2 h-3 w-28 rounded bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
            <div className="mt-2 h-8 w-32 rounded bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
            <div className="mt-2 h-3 w-36 rounded bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
            <div className="mt-2 h-3 w-40 rounded bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
          </article>

          <article className="sm:col-span-2 lg:col-span-1 lg:col-start-2 rounded-[12px] border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
            <div className="h-4 w-36 rounded bg-zinc-200 dark:bg-zinc-700 animate-pulse" />
            <div className="mt-3 flex items-center gap-4">
              <div className="h-24 w-24 rounded-full bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="h-4 w-24 rounded bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
                <div className="h-3 w-full rounded bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
                <div className="h-3 w-11/12 rounded bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
              </div>
            </div>
          </article>
        </div>
      </section>

      <div className="h-px bg-zinc-100 dark:bg-zinc-800" />

      <section>
        <div className="mb-3 h-3 w-32 rounded bg-zinc-200 dark:bg-zinc-700 animate-pulse" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <article
              key={`info-${index}`}
              className="rounded-[14px] border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3.5"
            >
              <div className="mb-3 h-[3px] w-full rounded-full bg-zinc-200 dark:bg-zinc-700 animate-pulse" />
              <div className="h-3 w-20 rounded bg-zinc-200 dark:bg-zinc-700 animate-pulse" />
              <div className="mt-2 h-8 w-24 rounded bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
              <div className="mt-2 h-3 w-9/12 rounded bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
              <div className="mt-3 h-9 rounded-lg bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
            </article>
          ))}
        </div>
      </section>
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
    <div className="space-y-3">
      {Array.from({ length: 2 }).map((_, sectionIndex) => (
        <section key={`group-${sectionIndex}`} className="space-y-2">
          <div className="h-4 w-20 rounded bg-zinc-100 dark:bg-zinc-800 animate-pulse" />

          {Array.from({ length: 3 }).map((__, rowIndex) => (
            <article
              key={`row-${sectionIndex}-${rowIndex}`}
              className="rounded-2xl border border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4"
            >
              <div className="h-6 w-28 rounded bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
              <div className="mt-2 h-4 w-44 rounded bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
              <div className="mt-2 h-3 w-28 rounded bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
              <div className="mt-3 flex items-center gap-2">
                <div className="h-6 w-20 rounded-full bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
                <div className="h-6 w-20 rounded-full bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
              </div>
            </article>
          ))}
        </section>
      ))}

      <div className="mt-6 space-y-3 border-t border-zinc-100 pt-4 dark:border-zinc-800">
        <div className="flex items-center justify-between gap-3">
          <div className="h-3 w-20 rounded bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
          <div className="h-12 w-24 rounded-xl bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
        </div>

        <div className="flex items-center justify-between gap-2">
          <div className="h-12 w-24 rounded-xl bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
          <div className="h-4 w-16 rounded bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
          <div className="h-12 w-24 rounded-xl bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
        </div>
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
