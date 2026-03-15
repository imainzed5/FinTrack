'use client';

import { useEffect } from 'react';

export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // SW registration failed - app still works
      });
    }

    const runRecurringCheck = async () => {
      try {
        await fetch('/api/transactions/recurring', { method: 'POST' });
      } catch {
        // recurring check failed, will retry later
      }
    };

    const syncPending = async () => {
      try {
        const { syncPendingTransactions } = await import('@/lib/indexeddb');
        await syncPendingTransactions();
      } catch {
        // sync failed, will retry later
      }
    };

    void runRecurringCheck();

    // Sync pending transactions when coming online
    const handleOnline = async () => {
      await runRecurringCheck();
      await syncPending();
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, []);

  return null;
}
