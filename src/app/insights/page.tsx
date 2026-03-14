'use client';

import { useState, useEffect } from 'react';
import type { Insight } from '@/lib/types';
import InsightCards from '@/components/InsightCards';
import { Lightbulb } from 'lucide-react';

export default function InsightsPage() {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    async function fetchInsights() {
      try {
        const res = await fetch('/api/insights');
        const json = await res.json();
        setInsights(json);
      } catch {
        // offline
      } finally {
        setLoading(false);
      }
    }
    fetchInsights();
  }, []);

  const filtered =
    filter === 'all' ? insights : insights.filter((i) => i.insightType === filter);

  const insightTypes = [
    { key: 'all', label: 'All' },
    { key: 'spending_spike', label: 'Spending Spikes' },
    { key: 'subscription', label: 'Subscriptions' },
    { key: 'budget_risk', label: 'Budget Risks' },
    { key: 'pattern', label: 'Patterns' },
  ];

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-500/15 flex items-center justify-center">
          <Lightbulb size={20} className="text-amber-600 dark:text-amber-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Financial Insights</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Smart analysis of your spending behavior
          </p>
        </div>
      </div>

      {/* Filter Chips */}
      <div className="flex flex-wrap gap-2 mb-6">
        {insightTypes.map((type) => (
          <button
            key={type.key}
            onClick={() => setFilter(type.key)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              filter === type.key
                ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/25'
                : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-800 hover:border-emerald-300'
            }`}
          >
            {type.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <InsightCards insights={filtered} />
      )}
    </div>
  );
}
