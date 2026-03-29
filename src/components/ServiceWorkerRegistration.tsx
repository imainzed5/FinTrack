'use client';

import { useEffect } from 'react';
import { processRecurringTransactions } from '@/lib/local-store';

export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // SW registration failed - app still works
      });
    }

    const runRecurringCheck = async () => {
      try {
        await processRecurringTransactions();
      } catch {
        // recurring check failed, will retry later
      }
    };

    void runRecurringCheck();

    const handleOnline = async () => {
      await runRecurringCheck();
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, []);

  return null;
}
