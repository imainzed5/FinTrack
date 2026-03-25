'use client';

import DebtsPanel from '@/components/DebtsPanel';

export default function DebtsPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 pb-6 pt-4 sm:px-6">
      <div className="rounded-2xl border border-zinc-200 bg-white/95 p-4 dark:border-zinc-800 dark:bg-zinc-900/95">
        <DebtsPanel />
      </div>
    </div>
  );
}
