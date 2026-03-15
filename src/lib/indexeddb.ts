import { openDB, type IDBPDatabase } from 'idb';
import type { Transaction } from './types';

const DB_NAME = 'FinanceDashboard';
// Schema stays at v1: pendingTransactions stores full transaction objects,
// so new transaction fields are backward-compatible without a store migration.
const DB_VERSION = 1;
const TX_STORE = 'pendingTransactions';

interface FinanceDB {
  pendingTransactions: {
    key: string;
    value: Transaction;
  };
}

let dbPromise: Promise<IDBPDatabase<FinanceDB>> | null = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<FinanceDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(TX_STORE)) {
          db.createObjectStore(TX_STORE, { keyPath: 'id' });
        }
      },
    });
  }
  return dbPromise;
}

export async function savePendingTransaction(tx: Transaction): Promise<void> {
  const db = await getDB();
  await db.put(TX_STORE, tx);
}

export async function getPendingTransactions(): Promise<Transaction[]> {
  const db = await getDB();
  return db.getAll(TX_STORE);
}

export async function removePendingTransaction(id: string): Promise<void> {
  const db = await getDB();
  await db.delete(TX_STORE, id);
}

export async function clearPendingTransactions(): Promise<void> {
  const db = await getDB();
  await db.clear(TX_STORE);
}

export async function syncPendingTransactions(): Promise<{ synced: number }> {
  const pending = await getPendingTransactions();
  if (pending.length === 0) return { synced: 0 };

  try {
    const response = await fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transactions: pending }),
    });

    if (response.ok) {
      const result = await response.json();
      for (const id of result.synced) {
        await removePendingTransaction(id);
      }
      return { synced: result.synced.length };
    }
  } catch {
    // offline, will retry later
  }

  return { synced: 0 };
}
