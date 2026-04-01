'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import {
  Play, CreditCard, TrendingUp, TrendingDown,
  PiggyBank, AlertTriangle, Star, Trophy, Flame,
  Zap, ExternalLink, Lightbulb, Info, CalendarX, BarChart3, Target,
} from 'lucide-react';
import type { TimelineEvent } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';
import EmptyState from '@/components/EmptyState';

// ── Config ──────────────────────────────────────────────────────────────────
type IconType = typeof Play;
type EventCfg = { icon: IconType; dot: string; badge: string; label: string };

const EVENT_CFG: Record<string, EventCfg> = {
  started_tracking:     { icon: Play,          dot: 'bg-emerald-500', badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400', label: 'Journey Start' },
  subscription_detected:{ icon: CreditCard,    dot: 'bg-purple-500',  badge: 'bg-purple-100 text-purple-700 dark:bg-purple-500/15 dark:text-purple-400',   label: 'Subscription'  },
  income_logged:        { icon: PiggyBank,     dot: 'bg-emerald-500', badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400', label: 'Income'         },
  spending_spike:       { icon: TrendingUp,    dot: 'bg-red-500',     badge: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400',               label: 'Spending Spike'},
  spending_improvement: { icon: TrendingDown,  dot: 'bg-teal-500',    badge: 'bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-400',           label: 'Improvement'   },
  budget_recovery:      { icon: Trophy,        dot: 'bg-emerald-500', badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400', label: 'Recovery'       },
  budget_exceeded:      { icon: AlertTriangle, dot: 'bg-amber-500',   badge: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400',       label: 'Over Budget'   },
  highest_savings:      { icon: PiggyBank,     dot: 'bg-blue-500',    badge: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400',           label: 'Best Savings'  },
  best_savings_rate:    { icon: Star,          dot: 'bg-indigo-500',  badge: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-400',   label: 'Best Rate'     },
  savings_milestone:    { icon: Trophy,        dot: 'bg-yellow-500',  badge: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-400',   label: 'Milestone'     },
  savings_streak:       { icon: Flame,         dot: 'bg-orange-500',  badge: 'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-400',   label: 'Streak'        },
  low_spend_month:      { icon: Zap,           dot: 'bg-teal-500',    badge: 'bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-400',           label: 'Low Spend'     },
  savings_rate_trend:   { icon: BarChart3,     dot: 'bg-sky-500',     badge: 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-400',               label: 'Savings Trend' },
  post_income_spending: { icon: Zap,           dot: 'bg-amber-500',   badge: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400',       label: 'Behavior'      },
  month_projection_on_track: { icon: Target,   dot: 'bg-emerald-500', badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400', label: 'On Track'       },
  month_projection_at_risk:  { icon: AlertTriangle, dot: 'bg-red-500', badge: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400',              label: 'At Risk'        },
  milestone:            { icon: Star,          dot: 'bg-yellow-500',  badge: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-400',   label: 'Milestone'     },
};

const LEFT_BORDER: Record<string, string> = {
  positive: 'border-l-4 border-l-emerald-400',
  neutral:  'border-l-4 border-l-zinc-300 dark:border-l-zinc-600',
  warning:  'border-l-4 border-l-amber-400',
  critical: 'border-l-4 border-l-red-500',
};

const AMOUNT_COLOR: Record<string, string> = {
  positive: 'text-emerald-500',
  neutral:  'text-zinc-600 dark:text-zinc-300',
  warning:  'text-amber-500',
  critical: 'text-red-500',
};

type FilterKey = 'all' | 'positive' | 'warning' | 'critical';
const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all',      label: 'All events' },
  { key: 'positive', label: 'Wins'       },
  { key: 'warning',  label: 'Warnings'   },
  { key: 'critical', label: 'Alerts'     },
];

interface TimelineViewProps {
  events: TimelineEvent[];
  onAddTransaction?: () => void;
}

export default function TimelineView({ events, onAddTransaction }: TimelineViewProps) {
  const [filter, setFilter] = useState<FilterKey>('all');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');

  const sorted = useMemo(() => {
    const base = [...events].sort(
      (a, b) => parseISO(b.date).getTime() - parseISO(a.date).getTime()
    );
    if (filter === 'all') return base;
    if (filter === 'warning') return base.filter(e => e.severity === 'warning' || e.severity === 'neutral');
    return base.filter(e => e.severity === filter);
  }, [events, filter]);

  if (events.length === 0) {
    return (
      <EmptyState
        icon={CalendarX}
        headline="Nothing here yet."
        subtext="Your transactions will appear here in chronological order."
        cta={{ label: '+ Add Transaction', action: 'add-transaction' }}
        onAddTransaction={onAddTransaction}
      />
    );
  }

  // Group by year, ordered by sortOrder
  const byYear = sorted.reduce<Record<string, TimelineEvent[]>>((acc, e) => {
    const yr = e.date.slice(0, 4);
    (acc[yr] ??= []).push(e);
    return acc;
  }, {});
  const years = Object.keys(byYear).sort((a, b) =>
    sortOrder === 'newest' ? Number(b) - Number(a) : Number(a) - Number(b)
  );

  return (
    <div>
      {/* Filter + sort bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-6">
        {/* Filter pills */}
        <div className="flex flex-wrap gap-2">
          {FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${
                filter === f.key
                  ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900'
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
              }`}
            >
              {f.label}
            </button>
          ))}
          <span className="text-xs text-zinc-400 dark:text-zinc-500 self-center ml-1">
            {sorted.length} event{sorted.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Sort order */}
        <select
          value={sortOrder}
          onChange={e => setSortOrder(e.target.value as 'newest' | 'oldest')}
          aria-label="Year sort order"
          className="text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
        </select>
      </div>

      {sorted.length === 0 && (
        <div className="text-center py-10 text-zinc-400 dark:text-zinc-600 text-sm">
          No events match this filter.
        </div>
      )}

      {/* Timeline grouped by year */}
      <div className="space-y-10">
        {years.map(year => (
          <div key={year}>
            {/* Year divider */}
            <div className="flex items-center gap-3 mb-5">
              <span className="text-xs font-bold tracking-widest uppercase text-zinc-500 dark:text-zinc-400">{year}</span>
              <div className="flex-1 h-px bg-zinc-200 dark:bg-zinc-800" />
            </div>

            {/* Events */}
            <div className="relative">
              <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-zinc-200 dark:bg-zinc-800" />
              <div className="space-y-5">
                {byYear[year].map(event => {
                  const cfg  = EVENT_CFG[event.eventType] ?? EVENT_CFG.milestone;
                  const Icon = cfg.icon;
                  const sev  = event.severity ?? 'neutral';
                  const amountPositive = sev === 'positive';

                  return (
                    <div key={event.id} className="relative flex items-start gap-4 pl-2">
                      {/* Timeline dot */}
                      <div className={`relative z-10 w-7 h-7 rounded-full ${cfg.dot} flex items-center justify-center flex-shrink-0 shadow-sm mt-0.5`}>
                        <Icon size={13} className="text-white" />
                      </div>

                      {/* Card */}
                      <div className={`flex-1 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-100 dark:border-zinc-800 overflow-hidden ${LEFT_BORDER[sev]}`}>

                        {/* ── Header ── */}
                        <div className="px-4 pt-3.5 pb-2.5">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              {/* Badge + date */}
                              <div className="flex items-center flex-wrap gap-2 mb-1">
                                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${cfg.badge}`}>
                                  {cfg.label}
                                </span>
                                <span className="text-[10px] text-zinc-400 dark:text-zinc-500">
                                  {format(parseISO(event.date), 'MMM d, yyyy')}
                                </span>
                              </div>
                              {/* Title */}
                              <p className="text-sm font-semibold text-zinc-900 dark:text-white leading-snug">
                                {event.description}
                              </p>
                            </div>
                            {/* Amount highlight */}
                            {event.amount !== undefined && (
                              <span className={`text-sm font-bold flex-shrink-0 ${AMOUNT_COLOR[sev]}`}>
                                {!amountPositive && event.amount > 0 ? '+' : ''}{formatCurrency(event.amount)}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* ── Context (what & why) ── */}
                        {event.context && (
                          <div className="px-4 pb-2.5">
                            <div className="flex gap-2 text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                              <Info size={12} className="flex-shrink-0 mt-0.5 text-zinc-400 dark:text-zinc-600" />
                              <span>{event.context}</span>
                            </div>
                          </div>
                        )}

                        {/* ── Advice ── */}
                        {event.advice && (
                          <div className="px-4 pb-3">
                            <div className="flex gap-2 text-xs bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 rounded-lg px-3 py-2 leading-relaxed">
                              <Lightbulb size={12} className="flex-shrink-0 mt-0.5" />
                              <span>{event.advice}</span>
                            </div>
                          </div>
                        )}

                        {/* ── Footer  ── */}
                        {event.link && (
                          <div className="px-4 pb-3 flex justify-end">
                            <Link
                              href={event.link}
                              className="inline-flex items-center gap-1 text-[10px] font-medium text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
                            >
                              View details <ExternalLink size={10} />
                            </Link>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}


