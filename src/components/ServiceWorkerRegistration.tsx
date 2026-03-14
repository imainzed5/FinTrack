'use client';

import { useEffect } from 'react';

export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // SW registration failed - app still works
      });
    }

    // Sync pending transactions when coming online
    const handleOnline = async () => {
      try {
        const { syncPendingTransactions } = await import('@/lib/indexeddb');
        await syncPendingTransactions();
      } catch {
        // sync failed, will retry later
      }
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, []);

  return null;
}
