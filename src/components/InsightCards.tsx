'use client';

import { AlertTriangle, Info, TrendingUp, CreditCard, Zap } from 'lucide-react';
import type { Insight } from '@/lib/types';

const insightIcons: Record<string, typeof Info> = {
  spending_spike: TrendingUp,
  subscription: CreditCard,
  budget_risk: AlertTriangle,
  pattern: Zap,
  saving: Info,
};

const severityStyles: Record<string, string> = {
  info: 'bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/20 text-blue-800 dark:text-blue-300',
  warning: 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20 text-amber-800 dark:text-amber-300',
  critical: 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20 text-red-800 dark:text-red-300',
};

const iconColors: Record<string, string> = {
  info: 'text-blue-500',
  warning: 'text-amber-500',
  critical: 'text-red-500',
};

interface InsightCardsProps {
  insights: Insight[];
  compact?: boolean;
}

export default function InsightCards({ insights, compact = false }: InsightCardsProps) {
  if (insights.length === 0) {
    return (
      <div className="text-center py-8 text-zinc-400 dark:text-zinc-600">
        <Info size={32} className="mx-auto mb-2 opacity-50" />
        <p className="text-sm">No insights yet. Add more transactions to get financial intelligence.</p>
      </div>
    );
  }

  const displayed = compact ? insights.slice(0, 3) : insights;

  return (
    <div className="space-y-3">
      {displayed.map((insight) => {
        const Icon = insightIcons[insight.insightType] || Info;
        return (
          <div
            key={insight.id}
            className={`flex items-start gap-3 p-4 rounded-xl border ${severityStyles[insight.severity]}`}
          >
            <Icon size={18} className={`mt-0.5 flex-shrink-0 ${iconColors[insight.severity]}`} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium leading-relaxed">{insight.message}</p>
              {insight.category && (
                <span className="inline-block mt-1 text-xs opacity-70">{insight.category}</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
