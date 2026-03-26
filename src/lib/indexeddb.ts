import { openDB, type IDBPDatabase } from 'idb';
import type { Transaction } from './types';

const DB_NAME = 'FinanceDashboard';
const DB_VERSION = 2;
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
      async upgrade(db, oldVersion, _newVersion, transaction) {
        if (!db.objectStoreNames.contains(TX_STORE)) {
          db.createObjectStore(TX_STORE, { keyPath: 'id' });
        }

        if (oldVersion < 2) {
          const store = transaction.objectStore(TX_STORE);
          const records = await store.getAll();
          for (const record of records) {
            if (!Object.prototype.hasOwnProperty.call(record, 'accountId')) {
              await store.put({ ...record, accountId: null });
            }
          }
        }
      },
    });
  }
  return dbPromise;
}

async function resolveDefaultAccountIdWithRetry(maxAttempts = 2): Promise<string | null> {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const res = await fetch('/api/accounts', { cache: 'no-store' });
      if (!res.ok) {
        throw new Error('Failed to fetch accounts');
      }
      const accounts = (await res.json()) as Array<{ id: string; name?: string; type?: string }>;
      if (!Array.isArray(accounts) || accounts.length === 0) {
        return null;
      }

      const cash = accounts.find((account) => account.name === 'Cash' && account.type === 'Cash');
      return cash?.id ?? accounts[0].id ?? null;
    } catch {
      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 150 * attempt));
      }
    }
  }

  return null;
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

  const defaultAccountId = await resolveDefaultAccountIdWithRetry();
  const mappedPending = pending.map((tx) => {
    if (tx.accountId) {
      return tx;
    }

    return {
      ...tx,
      accountId: defaultAccountId ?? null,
    };
  });

  try {
    const response = await fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transactions: mappedPending }),
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
