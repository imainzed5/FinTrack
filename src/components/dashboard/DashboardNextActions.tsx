'use client';

import Link from 'next/link';
import { ChevronRight, PiggyBank, Receipt, Target } from 'lucide-react';

interface DashboardNextActionsProps {
  needsFirstTransaction: boolean;
  needsBudget: boolean;
  needsSavingsGoal: boolean;
  onAddExpense: () => void;
}

type ActionItem = {
  id: string;
  title: string;
  description: string;
  ctaLabel: string;
  href?: string;
  onClick?: () => void;
  icon: typeof Receipt;
  accentClass: string;
};

export default function DashboardNextActions({
  needsFirstTransaction,
  needsBudget,
  needsSavingsGoal,
  onAddExpense,
}: DashboardNextActionsProps) {
  const actions: ActionItem[] = [];

  if (needsFirstTransaction) {
    actions.push({
      id: 'transaction',
      title: 'Add your first transaction',
      description: 'Once spending is logged, the dashboard starts becoming personal.',
      ctaLabel: 'Log expense',
      onClick: onAddExpense,
      icon: Receipt,
      accentClass: 'bg-[#FFF7F3] text-[#D85A30]',
    });
  }

  if (needsBudget) {
    actions.push({
      id: 'budget',
      title: 'Set a monthly budget',
      description: 'This unlocks a more meaningful remaining-budget and payday pace.',
      ctaLabel: 'Open budgets',
      href: '/settings?section=budgets',
      icon: Target,
      accentClass: 'bg-[#EEF5FF] text-[#185FA5]',
    });
  }

  if (needsSavingsGoal) {
    actions.push({
      id: 'savings',
      title: 'Create a savings goal',
      description: 'Give the dashboard something long-term to track alongside spending.',
      ctaLabel: 'Open savings',
      href: '/savings',
      icon: PiggyBank,
      accentClass: 'bg-[#F3FBF7] text-[#1D9E75]',
    });
  }

  if (actions.length === 0) {
    return null;
  }

  return (
    <section className="rounded-2xl border-[0.5px] border-[color:var(--color-border-tertiary,#d9d7cf)] bg-white p-4 md:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[14px] font-medium text-zinc-900">Next actions</h2>
          <p className="mt-1 text-sm text-zinc-500">
            A few setup steps will make this dashboard more useful.
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 xl:grid-cols-3">
        {actions.map((action) => {
          const Icon = action.icon;
          const sharedBody = (
            <>
              <div className={`inline-flex h-10 w-10 items-center justify-center rounded-2xl ${action.accentClass}`}>
                <Icon size={18} />
              </div>
              <div className="mt-4 min-w-0">
                <p className="text-sm font-medium text-zinc-900">{action.title}</p>
                <p className="mt-1 text-sm leading-6 text-zinc-500">{action.description}</p>
              </div>
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-[#1D9E75]">
                {action.ctaLabel}
                <ChevronRight size={15} />
              </span>
            </>
          );

          if (action.href) {
            return (
              <Link
                key={action.id}
                href={action.href}
                className="rounded-2xl border border-[#E8DFD0] bg-[#FBF8F1] p-4 transition-colors hover:bg-[#F7F2E7]"
              >
                {sharedBody}
              </Link>
            );
          }

          return (
            <button
              key={action.id}
              type="button"
              onClick={action.onClick}
              className="rounded-2xl border border-[#E8DFD0] bg-[#FBF8F1] p-4 text-left transition-colors hover:bg-[#F7F2E7]"
            >
              {sharedBody}
            </button>
          );
        })}
      </div>
    </section>
  );
}