'use client';

import { ArrowDownLeft, ArrowUpRight } from 'lucide-react';

interface DesktopQuickActionsProps {
  onAddExpense: () => void;
  onAddIncome: () => void;
}

export default function DesktopQuickActions({
  onAddExpense,
  onAddIncome,
}: DesktopQuickActionsProps) {
  return (
    <section className="rounded-2xl border-0 bg-white p-4">
      <div>
        <h2 className="text-[14px] font-medium text-zinc-800">Quick add</h2>
        <p className="mt-1 text-[11px] text-zinc-500">Fastest way to log a new entry.</p>
      </div>

      <div className="mt-4 grid gap-2.5">
        <button
          type="button"
          onClick={onAddExpense}
          className="inline-flex items-center justify-between rounded-2xl border-0 bg-[#FFF7F3] px-4 py-3 text-left transition-colors hover:bg-[#FDEDE7]"
        >
          <span>
            <span className="block text-sm font-medium text-zinc-900">Add expense</span>
            <span className="mt-0.5 block text-xs text-zinc-500">Log a new expense.</span>
          </span>
          <ArrowUpRight size={16} className="text-[#D85A30]" />
        </button>

        <button
          type="button"
          onClick={onAddIncome}
          className="inline-flex items-center justify-between rounded-2xl border-0 bg-[#F3FBF7] px-4 py-3 text-left transition-colors hover:bg-[#E1F5EE]"
        >
          <span>
            <span className="block text-sm font-medium text-zinc-900">Add income</span>
            <span className="mt-0.5 block text-xs text-zinc-500">Record a salary or payout.</span>
          </span>
          <ArrowDownLeft size={16} className="text-[#1D9E75]" />
        </button>
      </div>
    </section>
  );
}