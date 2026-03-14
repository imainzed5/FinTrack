'use client';

import { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';
import type { TimelineEvent } from '@/lib/types';
import TimelineView from '@/components/TimelineView';

export default function TimelinePage() {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchTimeline() {
      try {
        const res = await fetch('/api/timeline');
        const json = await res.json();
        setEvents(json);
      } catch {
        // offline
      } finally {
        setLoading(false);
      }
    }
    fetchTimeline();
  }, []);

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-violet-100 dark:bg-violet-500/15 flex items-center justify-center">
          <Clock size={20} className="text-violet-600 dark:text-violet-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Financial Timeline</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Your financial life milestones
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <TimelineView events={events} />
      )}
    </div>
  );
}
