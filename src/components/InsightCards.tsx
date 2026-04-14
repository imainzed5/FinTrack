'use client';

import type { ReactNode } from 'react';
import { BarChart2 } from 'lucide-react';
import type { Insight, InsightType } from '@/lib/types';
import EmptyState from '@/components/EmptyState';
import LockedInsightCard from '@/components/LockedInsightCard';

const FULL_WIDTH_TYPES: InsightType[] = [
  'category_concentration',
  'essentials_ratio',
  'weekend_vs_weekday',
  'payment_method_split',
  'category_drift',
  'savings_rate_trend',
  'post_income_behavior',
  'best_month_replay',
  'month_end_projection',
];

const FULL_WIDTH_SPAN_CLASS = 'col-span-2 lg:col-span-3 xl:col-span-4';

const LOCKED_DESCRIPTIONS: Partial<Record<InsightType, string>> = {
  budget_burn_rate: 'How long your budget will last at current pace',
  biggest_expense: 'Your largest single transaction this month',
  category_concentration: 'Which category dominates your spending',
  week_comparison: 'This week vs last week breakdown',
  no_spend_days: 'Days you spent nothing this month',
  essentials_ratio: 'Essentials vs discretionary split',
  avg_transaction_size: 'Average spend per transaction',
  payment_method_split: 'GCash vs cash vs card breakdown',
  weekend_vs_weekday: 'Where your leisure spending goes',
  category_drift: 'Month-over-month category changes',
  month_end_projection: 'Where you will land by month end',
  subscription_creep: 'How your recurring costs have grown',
  savings_rate_trend: '3-month savings trajectory',
  post_income_behavior: 'Spending pattern after receiving money',
  best_month_replay: 'What made your best month so efficient',
};

interface InsightCardsProps {
  insights: Insight[];
  transactionCount: number;
  compact?: boolean;
}

function getLockedDescription(type: InsightType): string {
  return LOCKED_DESCRIPTIONS[type] ?? 'More data needed to unlock this insight';
}

function getCardStyle(insight: Insight): string {
  if (insight.insightType === 'budget_burn_rate') {
    const state = insight.dataPayload?.state;
    if (state === 'safe') return 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900';
    if (state === 'tight') return 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900';
    if (state === 'at_risk') return 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900';
  }
  if (insight.severity === 'warning') return 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900';
  if (insight.severity === 'critical') return 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900';
  return 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800';
}

function getAccentColor(insight: Insight): string {
  if (insight.insightType === 'budget_burn_rate') {
    const state = insight.dataPayload?.state;
    if (state === 'safe') return 'bg-[#1D9E75]';
    if (state === 'tight') return 'bg-amber-400';
    if (state === 'at_risk') return 'bg-red-400';
  }
  if (insight.severity === 'warning') return 'bg-amber-400';
  if (insight.severity === 'critical') return 'bg-red-400';
  if (insight.insightType === 'no_spend_days') return 'bg-[#1D9E75]';
  if (insight.insightType === 'budget_burn_rate') return 'bg-[#1D9E75]';
  if (insight.insightType === 'category_concentration') return 'bg-[#1D9E75]';
  return 'bg-zinc-200 dark:bg-zinc-700';
}

function TwoStat({ items }: { items: { label: string; value: string; highlight?: boolean }[] }) {
  return (
    <div className="flex gap-2 mt-1">
      {items.map((item, i) => (
        <div key={i} className={`flex-1 rounded-lg px-2.5 py-1.5 ${item.highlight ? 'bg-[#E1F5EE] dark:bg-[#085041]/30' : 'bg-zinc-100 dark:bg-zinc-800'}`}>
          <p className="text-[10px] uppercase tracking-wide text-zinc-400 dark:text-zinc-500 mb-0.5">{item.label}</p>
          <p className={`text-[13px] font-medium ${item.highlight ? 'text-[#085041] dark:text-[#5DCAA5]' : 'text-zinc-800 dark:text-zinc-200'}`}>{item.value}</p>
        </div>
      ))}
    </div>
  );
}

function MiniBarChart({ rows }: { rows: { name: string; pct: number; primary?: boolean }[] }) {
  return (
    <div className="flex flex-col gap-1.5 mt-1">
      {rows.map((row, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="text-[11px] text-zinc-400 w-14 flex-shrink-0 truncate">{row.name}</span>
          <div className="flex-1 h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${Math.max(row.pct, 3)}%`, background: row.primary ? '#1D9E75' : '#A1A1AA' }} />
          </div>
          <span className="text-[11px] text-zinc-400 w-8 text-right">{row.pct.toFixed(1)}%</span>
        </div>
      ))}
    </div>
  );
}

function SegmentBar({ leftPct, leftLabel, rightLabel }: { leftPct: number; leftLabel: string; rightLabel: string }) {
  return (
    <div className="mt-1">
      <div className="flex h-2 rounded-full overflow-hidden">
        <div style={{ width: `${leftPct}%`, background: '#71717A' }} />
        <div style={{ width: `${100 - leftPct}%`, background: '#1D9E75' }} />
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-[11px] text-zinc-400">{leftLabel}</span>
        <span className="text-[11px] text-[#1D9E75]">{rightLabel}</span>
      </div>
    </div>
  );
}

function Badge({ label, variant }: { label: string; variant: 'green' | 'amber' | 'red' | 'gray' }) {
  const styles = {
    green: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    amber: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
    red: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    gray: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400',
  };
  return <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${styles[variant]}`}>{label}</span>;
}

function renderHero(insight: Insight): ReactNode {
  const p = insight.dataPayload as Record<string, unknown> | undefined;
  if (!p) return null;

  const fmtShort = (n: unknown) =>
    typeof n === 'number'
      ? `${n.toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
      : String(n);

  const fmtCurrency = (n: unknown) =>
    typeof n === 'number'
      ? `₱${n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : String(n);

  switch (insight.insightType) {
    case 'budget_burn_rate': {
      const state = p.state as string;
      const color = state === 'safe' ? 'text-[#1D9E75]' : state === 'tight' ? 'text-amber-500' : 'text-red-500';
      return (
        <div className="mt-1 mb-1">
          <div className={`text-3xl font-medium leading-none ${color}`}>{String(p.daysUntilEmpty)}</div>
          <div className="text-[10px] uppercase tracking-wide text-zinc-400 mt-1">days of runway</div>
        </div>
      );
    }

    case 'biggest_expense':
      return (
        <div className="mt-1 mb-1">
          <div className="text-3xl font-medium leading-none text-zinc-800 dark:text-zinc-200">
            {fmtCurrency(p.amount)}
          </div>
          <div className="text-[10px] uppercase tracking-wide text-zinc-400 mt-1">largest this month</div>
        </div>
      );

    case 'category_concentration':
      return (
        <div className="mt-1 mb-1 flex items-baseline gap-2">
          <div className="text-3xl font-medium leading-none text-[#1D9E75]">
            {(p.percentage as number).toFixed(0)}%
          </div>
          <div className="text-[11px] text-zinc-400">{String(p.topCategory)}</div>
        </div>
      );

    case 'week_comparison': {
      const delta = p.delta as number;
      const pct = p.percentChange as number;
      const up = delta > 0;
      return (
        <div className="mt-1 mb-1">
          <div className={`text-3xl font-medium leading-none ${up ? 'text-amber-500' : 'text-[#1D9E75]'}`}>
            {up ? '+' : ''}{fmtShort(delta)}
          </div>
          <div className="text-[10px] uppercase tracking-wide text-zinc-400 mt-1">
            vs last week ({up ? '+' : ''}{pct.toFixed(0)}%)
          </div>
        </div>
      );
    }

    case 'no_spend_days':
      return (
        <div className="mt-1 mb-1 flex items-baseline gap-1">
          <div className="text-3xl font-medium leading-none text-[#1D9E75]">{String(p.noSpendCount)}</div>
          <div className="text-xl text-zinc-300 dark:text-zinc-600">/ {String(p.daysElapsed)}</div>
        </div>
      );

    case 'essentials_ratio':
      return (
        <div className="mt-1 mb-1">
          <div className="text-3xl font-medium leading-none text-amber-500">
            {(p.essentialsPercent as number).toFixed(0)}%
          </div>
          <div className="text-[10px] uppercase tracking-wide text-zinc-400 mt-1">goes to essentials</div>
        </div>
      );

    case 'avg_transaction_size':
      return (
        <div className="mt-1 mb-1">
          <div className="text-3xl font-medium leading-none text-zinc-800 dark:text-zinc-200">
            {fmtCurrency(p.avgAmount)}
          </div>
          <div className="text-[10px] uppercase tracking-wide text-zinc-400 mt-1">per transaction</div>
        </div>
      );

    case 'payment_method_split':
      return (
        <div className="mt-1 mb-1 flex items-baseline gap-2">
          <div className="text-3xl font-medium leading-none text-zinc-800 dark:text-zinc-200">
            {(p.topPercent as number).toFixed(0)}%
          </div>
          <div className="text-[11px] text-zinc-400">{String(p.topMethod)}</div>
        </div>
      );

    case 'weekend_vs_weekday': {
      const wknd = p.weekendDailyAvg as number;
      const wkdy = p.weekdayDailyAvg as number;
      const higher = wkdy >= wknd ? 'Weekdays' : 'Weekends';
      return (
        <div className="mt-1 mb-1">
          <div className="text-2xl font-medium leading-none text-zinc-800 dark:text-zinc-200">{higher}</div>
          <div className="text-[10px] uppercase tracking-wide text-zinc-400 mt-1">higher daily spend</div>
        </div>
      );
    }

    case 'category_drift': {
      const delta = p.delta as number;
      const up = delta > 0;
      return (
        <div className="mt-1 mb-1">
          <div className={`text-3xl font-medium leading-none ${up ? 'text-red-500' : 'text-[#1D9E75]'}`}>
            {up ? '+' : ''}{fmtShort(delta)}
          </div>
          <div className="text-[10px] uppercase tracking-wide text-zinc-400 mt-1">
            {String(p.category)} vs last month
          </div>
        </div>
      );
    }

    case 'month_end_projection': {
      const rem = p.projectedRemaining as number;
      return (
        <div className="mt-1 mb-1">
          <div className={`text-3xl font-medium leading-none ${rem >= 0 ? 'text-[#1D9E75]' : 'text-red-500'}`}>
            {rem >= 0 ? fmtShort(rem) : `-${fmtShort(Math.abs(rem))}`}
          </div>
          <div className="text-[10px] uppercase tracking-wide text-zinc-400 mt-1">
            {rem >= 0 ? 'projected surplus' : 'projected overshoot'}
          </div>
        </div>
      );
    }

    case 'subscription_creep': {
      const delta = (p.currentSubTotal as number) - (p.previousSubTotal as number);
      return (
        <div className="mt-1 mb-1">
          <div className="text-3xl font-medium leading-none text-amber-500">+{fmtShort(delta)}</div>
          <div className="text-[10px] uppercase tracking-wide text-zinc-400 mt-1">more in recurring costs</div>
        </div>
      );
    }

    case 'savings_rate_trend': {
      const rates = p.monthlyRates as { month: string; rate: number }[];
      const latest = rates?.[rates.length - 1]?.rate ?? 0;
      const trend = p.trend as string;
      const color = trend === 'improving' ? 'text-[#1D9E75]' : trend === 'declining' ? 'text-red-500' : 'text-zinc-500';
      return (
        <div className="mt-1 mb-1">
          <div className={`text-3xl font-medium leading-none ${color}`}>{latest.toFixed(0)}%</div>
          <div className="text-[10px] uppercase tracking-wide text-zinc-400 mt-1">savings rate last month</div>
        </div>
      );
    }

    case 'post_income_behavior': {
      const multiplier = p.multiplier as number;
      return (
        <div className="mt-1 mb-1">
          <div className="text-3xl font-medium leading-none text-amber-500">{multiplier.toFixed(1)}x</div>
          <div className="text-[10px] uppercase tracking-wide text-zinc-400 mt-1">more spending after income</div>
        </div>
      );
    }

    case 'best_month_replay':
      return (
        <div className="mt-1 mb-1">
          <div className="text-3xl font-medium leading-none text-[#1D9E75]">{fmtShort(p.bestMonthTotal)}</div>
          <div className="text-[10px] uppercase tracking-wide text-zinc-400 mt-1">
            best month  {String(p.bestMonth)}
          </div>
        </div>
      );

    default:
      return null;
  }
}

function renderCardBody(insight: Insight): ReactNode {
  const p = insight.dataPayload as Record<string, unknown> | undefined;
  if (!p) return null;

  const fmt = (n: unknown) =>
    typeof n === 'number'
      ? `${n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : String(n);

  switch (insight.insightType) {
    case 'budget_burn_rate': {
      const state = p.state as string;
      const badgeVariant: 'green' | 'amber' | 'red' =
        state === 'safe' ? 'green' : state === 'tight' ? 'amber' : 'red';
      return (
        <div className="stat-pair-wrapper">
          <TwoStat items={[
            { label: 'Daily avg', value: `${fmt(p.dailyAverage)}/day` },
            { label: 'Remaining', value: fmt(p.remaining) },
          ]} />
          <div className="mt-2"><Badge label={state.toUpperCase()} variant={badgeVariant} /></div>
        </div>
      );
    }

    case 'biggest_expense': {
      const rawDate = String(p.date).substring(0, 10);
      const [year, month, day] = rawDate.split('-').map(Number);
      const dateStr = new Date(year, month - 1, day).toLocaleDateString('en-PH', {
        month: 'short', day: 'numeric', year: 'numeric',
      });
      return (
        <div className="flex items-center justify-between mt-2">
          <span className="text-[11px] bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 px-2 py-0.5 rounded-full">
            {String(p.category)}
          </span>
          <span className="text-[11px] text-zinc-400">{dateStr}</span>
        </div>
      );
    }

    case 'category_concentration': {
      const breakdown = p.categoryBreakdown as Record<string, number>;
      const total = p.totalSpent as number;
      const rows = Object.entries(breakdown)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, amount], i) => ({ name, pct: (amount / total) * 100, primary: i === 0 }));
      return <MiniBarChart rows={rows} />;
    }

    case 'week_comparison':
      return (
        <TwoStat items={[
          { label: 'This week', value: fmt(p.thisWeekTotal) },
          { label: 'Last week', value: fmt(p.lastWeekTotal) },
        ]} />
      );

    case 'no_spend_days': {
      const count = p.noSpendCount as number;
      const elapsed = p.daysElapsed as number;
      const dots = Array.from({ length: Math.min(elapsed, 22) }, (_, i) => i < count);
      return (
        <div className="flex flex-wrap gap-1 mt-2">
          {dots.map((filled, i) => (
            <div key={i} className={`w-2 h-2 rounded-full ${filled ? 'bg-[#1D9E75]' : 'bg-zinc-200 dark:bg-zinc-700'}`} />
          ))}
        </div>
      );
    }

    case 'essentials_ratio': {
      const pct = p.essentialsPercent as number;
      return (
        <SegmentBar
          leftPct={pct}
          leftLabel={`Essentials ${pct.toFixed(1)}%`}
          rightLabel={`${(p.discretionaryTotal as number).toLocaleString('en-PH', { minimumFractionDigits: 0 })} free`}
        />
      );
    }

    case 'avg_transaction_size': {
      const large = p.largeCount as number;
      return (
        <div className="flex items-center justify-between mt-2">
          <span className="text-[11px] text-zinc-400">{String(p.count)} transactions</span>
          {large > 0 && <Badge label={`${large} large`} variant="amber" />}
        </div>
      );
    }

    case 'payment_method_split': {
      const split = p.split as Record<string, { amount: number; percent: number }>;
      const rows = Object.entries(split)
        .sort((a, b) => b[1].amount - a[1].amount)
        .map(([name, val], i) => ({ name, pct: val.percent, primary: i === 0 }));
      return <MiniBarChart rows={rows} />;
    }

    case 'weekend_vs_weekday': {
      const wknd = p.weekendDailyAvg as number;
      const wkdy = p.weekdayDailyAvg as number;
      return (
        <TwoStat items={[
          { label: 'Weekday/day', value: fmt(wkdy), highlight: wkdy >= wknd },
          { label: 'Weekend/day', value: fmt(wknd), highlight: wknd > wkdy },
        ]} />
      );
    }

    case 'category_drift': {
      const delta = p.delta as number;
      const up = delta > 0;
      return (
        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-1.5">
            <span className="text-[12px] text-zinc-400">{fmt(p.previousAmount)}</span>
            <span className="text-[11px] text-zinc-300 dark:text-zinc-600"></span>
            <span className="text-[12px] font-medium text-zinc-700 dark:text-zinc-300">{fmt(p.currentAmount)}</span>
          </div>
          <Badge label={`${up ? '+' : ''}${fmt(delta)}`} variant={up ? 'red' : 'green'} />
        </div>
      );
    }

    case 'month_end_projection': {
      return (
        <TwoStat items={[
          { label: 'Projected total', value: fmt(p.projectedTotal) },
          { label: `${String(p.daysLeft)} days left`, value: fmt(p.dailyRate) + '/day' },
        ]} />
      );
    }

    case 'subscription_creep':
      return (
        <TwoStat items={[
          { label: '3 months ago', value: fmt(p.previousSubTotal) },
          { label: 'Now', value: fmt(p.currentSubTotal) },
        ]} />
      );

    case 'savings_rate_trend': {
      const rates = p.monthlyRates as { month: string; rate: number }[];
      if (!rates || rates.length < 2) return null;
      const trend = p.trend as string;
      const color = trend === 'improving' ? '#1D9E75' : trend === 'declining' ? '#EF4444' : '#A1A1AA';
      const max = Math.max(...rates.map((r) => r.rate), 1);
      const w = 100 / rates.length;
      const points = rates.map((r, i) => ({
        x: i * w + w / 2,
        y: 36 - (r.rate / max) * 28,
        label: r.month.substring(0, 3),
      }));
      const pathD = points.map((pt, i) => `${i === 0 ? 'M' : 'L'}${pt.x},${pt.y}`).join(' ');
      return (
        <svg width="100%" height="48" viewBox="0 0 100 48" preserveAspectRatio="none" style={{ overflow: 'visible' }}>
          <path d={pathD} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          {points.map((pt, i) => (
            <g key={i}>
              <circle cx={pt.x} cy={pt.y} r="2.5" fill={color} />
              <text x={pt.x} y="47" textAnchor="middle" fontSize="7" fill="#a1a1aa">{pt.label}</text>
            </g>
          ))}
        </svg>
      );
    }

    case 'post_income_behavior':
      return (
        <TwoStat items={[
          { label: 'Normal days', value: `${fmt(p.dailyAvg)}/day` },
          { label: 'Post-income', value: `${fmt(p.postIncomeDailyAvg)}/day` },
        ]} />
      );

    case 'best_month_replay':
      return (
        <TwoStat items={[
          { label: String(p.bestMonth), value: fmt(p.bestMonthTotal), highlight: true },
          { label: 'This month', value: fmt(p.currentTotal) },
        ]} />
      );

    default:
      return null;
  }
}

function InsightCard({ insight, forceFullWidth }: { insight: Insight; forceFullWidth?: boolean }) {
  const isFullWidth = forceFullWidth ?? FULL_WIDTH_TYPES.includes(insight.insightType);
  const hasPayload = Boolean(insight.dataPayload && Object.keys(insight.dataPayload).length > 0);

  return (
    <div className={`rounded-[14px] border p-3.5 flex flex-col ${getCardStyle(insight)} ${isFullWidth ? FULL_WIDTH_SPAN_CLASS : ''}`}>
      <div className={`h-[3px] rounded-full mb-3 ${getAccentColor(insight)}`} />

      <p className="text-[12px] font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide leading-none">
        {insight.title}
      </p>

      {hasPayload && renderHero(insight)}

      <p className="text-[12px] text-zinc-500 dark:text-zinc-400 leading-relaxed mt-1 mb-2">
        {insight.message}
      </p>

      {hasPayload && renderCardBody(insight)}
    </div>
  );
}

export default function InsightCards({ insights, transactionCount, compact = false }: InsightCardsProps) {
  if (insights.length === 0) {
    return (
      <EmptyState
        icon={BarChart2}
        headline="Not enough data yet."
        subtext="Log transactions across a few categories and patterns will start to emerge."
      />
    );
  }

  const displayed = compact ? insights.slice(0, 3) : insights;
  const unlockedInsights = displayed.filter((i) => transactionCount >= i.requiresTransactionCount);
  const lockedInsights = displayed.filter((i) => transactionCount < i.requiresTransactionCount);
  const halfWidthInsights = unlockedInsights.filter(
    (i) => !FULL_WIDTH_TYPES.includes(i.insightType)
  );
  const fullWidthInsights = unlockedInsights.filter(
    (i) => FULL_WIDTH_TYPES.includes(i.insightType)
  );
  const orderedInsights = [...halfWidthInsights, ...fullWidthInsights];

  const shouldForceFullWidth = (insight: Insight, pool: Insight[]) =>
    FULL_WIDTH_TYPES.includes(insight.insightType) && pool.length > 1;

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-3 xl:grid-cols-4">
        {orderedInsights.map((insight) => (
          <InsightCard
            key={insight.id}
            insight={insight}
            forceFullWidth={shouldForceFullWidth(insight, orderedInsights)}
          />
        ))}
      </div>

      {lockedInsights.length > 0 && (
        <>
          <div className="h-px bg-zinc-100 dark:bg-zinc-800 my-1" />
          <p className="text-[10px] font-medium uppercase tracking-widest text-zinc-300 dark:text-zinc-600">
            Locked - keep tracking to unlock
          </p>
          <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-3 xl:grid-cols-4">
            {lockedInsights.map((insight) => (
              <LockedInsightCard
                key={insight.id}
                title={insight.title}
                description={getLockedDescription(insight.insightType)}
                currentCount={transactionCount}
                requiredCount={insight.requiresTransactionCount}
                tier={insight.tier}
                isFullWidth={shouldForceFullWidth(insight, lockedInsights)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
