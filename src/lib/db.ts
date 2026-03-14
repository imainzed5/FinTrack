import { promises as fs } from 'fs';
import path from 'path';
import type { Transaction, Budget, TimelineEvent, Subscription } from './types';

const DATA_DIR = path.join(process.cwd(), 'data');

async function ensureDataDir() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
  } catch {
    // already exists
  }
}

async function readJsonFile<T>(filename: string, defaultValue: T): Promise<T> {
  await ensureDataDir();
  const filepath = path.join(DATA_DIR, filename);
  try {
    const data = await fs.readFile(filepath, 'utf-8');
    return JSON.parse(data) as T;
  } catch {
    return defaultValue;
  }
}

async function writeJsonFile<T>(filename: string, data: T): Promise<void> {
  await ensureDataDir();
  const filepath = path.join(DATA_DIR, filename);
  await fs.writeFile(filepath, JSON.stringify(data, null, 2), 'utf-8');
}

// Transactions
export async function getTransactions(): Promise<Transaction[]> {
  return readJsonFile<Transaction[]>('transactions.json', []);
}

export async function addTransaction(tx: Transaction): Promise<Transaction> {
  const transactions = await getTransactions();
  transactions.push(tx);
  await writeJsonFile('transactions.json', transactions);
  return tx;
}

export async function updateTransaction(id: string, updates: Partial<Transaction>): Promise<Transaction | null> {
  const transactions = await getTransactions();
  const idx = transactions.findIndex((t) => t.id === id);
  if (idx === -1) return null;
  transactions[idx] = { ...transactions[idx], ...updates, updatedAt: new Date().toISOString() };
  await writeJsonFile('transactions.json', transactions);
  return transactions[idx];
}

export async function deleteTransaction(id: string): Promise<boolean> {
  const transactions = await getTransactions();
  const filtered = transactions.filter((t) => t.id !== id);
  if (filtered.length === transactions.length) return false;
  await writeJsonFile('transactions.json', filtered);
  return true;
}

// Budgets
export async function getBudgets(): Promise<Budget[]> {
  return readJsonFile<Budget[]>('budgets.json', []);
}

export async function setBudget(budget: Budget): Promise<Budget> {
  const budgets = await getBudgets();
  const idx = budgets.findIndex(
    (b) => b.category === budget.category && b.month === budget.month
  );
  if (idx >= 0) {
    budgets[idx] = budget;
  } else {
    budgets.push(budget);
  }
  await writeJsonFile('budgets.json', budgets);
  return budget;
}

export async function deleteBudget(id: string): Promise<boolean> {
  const budgets = await getBudgets();
  const filtered = budgets.filter((b) => b.id !== id);
  if (filtered.length === budgets.length) return false;
  await writeJsonFile('budgets.json', filtered);
  return true;
}

// Timeline Events
export async function getTimelineEvents(): Promise<TimelineEvent[]> {
  return readJsonFile<TimelineEvent[]>('timeline.json', []);
}

export async function addTimelineEvent(event: TimelineEvent): Promise<TimelineEvent> {
  const events = await getTimelineEvents();
  events.push(event);
  await writeJsonFile('timeline.json', events);
  return event;
}

// Subscriptions
export async function getSubscriptions(): Promise<Subscription[]> {
  return readJsonFile<Subscription[]>('subscriptions.json', []);
}

export async function saveSubscriptions(subs: Subscription[]): Promise<void> {
  await writeJsonFile('subscriptions.json', subs);
}
