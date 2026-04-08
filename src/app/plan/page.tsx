'use client';

import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import {
  CalendarDays,
  ChevronRight,
  CircleDollarSign,
  PiggyBank,
  ReceiptText,
  Target,
  type LucideIcon,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import {
  getBudgets,
  getDebts,
  getLocalUserSettings,
  getSavingsGoalsSummary,
} from '@/lib/local-store';
import { isSyncStateRealtimeUpdate, subscribeAppUpdates } from '@/lib/transaction-ws';

type PlanCardTone = 'emerald' | 'amber';

interface PlanCardDefinition {
  title: string;
  href: string;
  icon: LucideIcon;
  tone: PlanCardTone;
  getHelper: (summary: PlanSummary) => string;
}

interface PlanSummary {
  activeBudgetCount: number;
  activeGoalCount: number;
  owingDebtCount: number;
  owedDebtCount: number;
  hasOverallBudget: boolean;
  nextPayday: string | null;
}

const EMPTY_SUMMARY: PlanSummary = {
  activeBudgetCount: 0,
  activeGoalCount: 0,
  owingDebtCount: 0,
  owedDebtCount: 0,
  hasOverallBudget: false,
  nextPayday: null,
};

const CARD_TONE_STYLES: Record<PlanCardTone, { icon: string }> = {
  emerald: {
    icon: 'bg-[#eef7f0] text-[#4e8f60]',
  },
  amber: {
    icon: 'bg-[#fff5e8] text-[#d79b25]',
  },
};

function formatCount(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

async function loadPlanSummary(): Promise<PlanSummary> {
  const [budgets, goalsSummary, debts, userSettings] = await Promise.all([
    getBudgets(),
    getSavingsGoalsSummary(),
    getDebts('active'),
    getLocalUserSettings(),
  ]);
  const currentMonth = format(new Date(), 'yyyy-MM');
  const currentMonthBudgets = budgets.filter((budget) => budget.month === currentMonth);

  return {
    activeBudgetCount: currentMonthBudgets.length,
    activeGoalCount: goalsSummary.activeGoalCount,
    owingDebtCount: debts.filter((debt) => debt.direction === 'owing').length,
    owedDebtCount: debts.filter((debt) => debt.direction === 'owed').length,
    hasOverallBudget: currentMonthBudgets.some(
      (budget) => budget.category === 'Overall' && !budget.subCategory
    ),
    nextPayday: userSettings.nextPayday,
  };
}

const PLAN_CARDS: PlanCardDefinition[] = [
  {
    title: 'Category budgets',
    href: '/budgets',
    icon: PiggyBank,
    tone: 'emerald',
    getHelper: (summary) => formatCount(summary.activeBudgetCount, 'active budget'),
  },
  {
    title: 'Personal goals',
    href: '/savings',
    icon: Target,
    tone: 'emerald',
    getHelper: (summary) => formatCount(summary.activeGoalCount, 'goal in progress', 'goals in progress'),
  },
  {
    title: 'Debt',
    href: '/debts',
    icon: ReceiptText,
    tone: 'amber',
    getHelper: (summary) => formatCount(summary.owingDebtCount, 'debt tracked', 'debts tracked'),
  },
  {
    title: 'Money owed to you',
    href: '/debts',
    icon: CircleDollarSign,
    tone: 'emerald',
    getHelper: (summary) => formatCount(summary.owedDebtCount, 'receivable', 'receivables'),
  },
  {
    title: 'Payday',
    href: '/settings?section=payday',
    icon: CalendarDays,
    tone: 'emerald',
    getHelper: (summary) => {
      if (!summary.nextPayday) {
        return 'No payday scheduled yet';
      }

      try {
        return `Next payday: ${format(parseISO(summary.nextPayday), 'MMM d')}`;
      } catch {
        return 'Next payday saved';
      }
    },
  },
  {
    title: 'Overall budget',
    href: '/budgets',
    icon: Target,
    tone: 'emerald',
    getHelper: (summary) => (summary.hasOverallBudget ? 'Overall cap ready' : 'Needs overall cap'),
  },
];

function PlanCard({ card, summary }: { card: PlanCardDefinition; summary: PlanSummary }) {
  const Icon = card.icon;
  const tone = CARD_TONE_STYLES[card.tone];

  return (
    <Link
      href={card.href}
      className="group block w-full rounded-[28px] border border-[#e3dbc9] bg-white/95 px-4 py-4 shadow-[0_14px_34px_rgba(42,42,28,0.05)] transition-all hover:-translate-y-0.5 hover:border-[#d9cfbb] hover:shadow-[0_18px_40px_rgba(42,42,28,0.08)]"
    >
      <div className="flex items-center gap-4">
        <span className={`inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${tone.icon}`}>
          <Icon size={22} />
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-xl font-semibold tracking-[-0.02em] text-zinc-900">
            {card.title}
          </p>
          <p className="mt-1 text-sm text-zinc-500">
            {card.getHelper(summary)}
          </p>
        </div>

        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-zinc-400 transition-colors group-hover:text-zinc-600">
          <ChevronRight size={20} />
        </span>
      </div>
    </Link>
  );
}

export default function PlanPage() {
  const [summary, setSummary] = useState<PlanSummary>(EMPTY_SUMMARY);

  const refreshPlanSummary = useCallback(async () => {
    try {
      const nextSummary = await loadPlanSummary();
      setSummary(nextSummary);
    } catch {
      setSummary(EMPTY_SUMMARY);
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void refreshPlanSummary();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [refreshPlanSummary]);

  useEffect(() => {
    const unsubscribe = subscribeAppUpdates((message) => {
      if (isSyncStateRealtimeUpdate(message)) {
        return;
      }

      void refreshPlanSummary();
    });

    return unsubscribe;
  }, [refreshPlanSummary]);

  return (
    <div className="mx-auto min-h-screen max-w-3xl px-4 py-7 sm:px-6 sm:py-8">
      <header className="px-1">
        <h1 className="font-display text-[2.15rem] font-semibold tracking-[-0.03em] text-zinc-900">
          Plan
        </h1>
        <p className="mt-3 text-base leading-8 text-zinc-500">
          Manage your budgets, goals, and more.
        </p>
      </header>

      <div className="mt-8 space-y-4">
        {PLAN_CARDS.map((card) => (
          <PlanCard key={card.title} card={card} summary={summary} />
        ))}
      </div>
    </div>
  );
}
