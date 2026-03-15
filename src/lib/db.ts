import { promises as fs } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { addDays, addMonths, addWeeks, addYears, format, isAfter, parseISO, startOfDay } from 'date-fns';
import type {
  Transaction,
  Budget,
  TimelineEvent,
  Subscription,
  RecurringFrequency,
  RecurringConfig,
  TransactionSplit,
} from './types';
import { CATEGORIES, PAYMENT_METHODS, RECURRING_FREQUENCIES } from './types';

const DATA_DIR = path.join(process.cwd(), 'data');
const BUDGET_ALERT_THRESHOLDS = [50, 80, 100] as const;

function safeParseDate(value?: string): Date | null {
  if (!value) return null;
  const parsed = parseISO(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function normalizeIsoDate(value: string | undefined, fallback: string): string {
  const parsed = safeParseDate(value);
  if (parsed) return parsed.toISOString();
  const fallbackParsed = safeParseDate(fallback);
  return fallbackParsed ? fallbackParsed.toISOString() : new Date().toISOString();
}

function addRecurringInterval(
  date: Date,
  frequency: RecurringFrequency,
  interval: number
): Date {
  const steps = Math.max(1, Math.floor(interval));
  if (frequency === 'daily') return addDays(date, steps);
  if (frequency === 'weekly') return addWeeks(date, steps);
  if (frequency === 'yearly') return addYears(date, steps);
  return addMonths(date, steps);
}

export function getNextRecurringRunDate(
  fromDate: string,
  frequency: RecurringFrequency,
  interval = 1
): string {
  const baseDate = safeParseDate(fromDate) || new Date();
  return addRecurringInterval(baseDate, frequency, interval).toISOString();
}

export function buildRecurringConfig(
  fromDate: string,
  frequency: RecurringFrequency,
  interval = 1,
  endDate?: string
): RecurringConfig {
  const normalizedInterval = Math.max(1, Math.floor(interval));
  return {
    frequency,
    interval: normalizedInterval,
    nextRunDate: getNextRecurringRunDate(fromDate, frequency, normalizedInterval),
    endDate: endDate ? normalizeIsoDate(endDate, endDate) : undefined,
  };
}

function normalizeSplit(value: unknown): TransactionSplit | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Partial<TransactionSplit>;
  if (!raw.category || !CATEGORIES.includes(raw.category)) return null;
  if (typeof raw.amount !== 'number' || !Number.isFinite(raw.amount) || raw.amount <= 0) return null;

  const subCategory =
    typeof raw.subCategory === 'string' && raw.subCategory.trim().length > 0
      ? raw.subCategory.trim()
      : undefined;

  return {
    id: typeof raw.id === 'string' && raw.id.trim() ? raw.id : uuidv4(),
    category: raw.category,
    subCategory,
    amount: Number(raw.amount.toFixed(2)),
  };
}

function normalizeRecurring(
  value: unknown,
  baseDate: string
): RecurringConfig | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const raw = value as Partial<RecurringConfig>;
  if (!raw.frequency || !RECURRING_FREQUENCIES.includes(raw.frequency)) {
    return undefined;
  }

  const interval =
    typeof raw.interval === 'number' && Number.isFinite(raw.interval)
      ? Math.max(1, Math.floor(raw.interval))
      : 1;

  const nextRunDate = raw.nextRunDate
    ? normalizeIsoDate(raw.nextRunDate, baseDate)
    : getNextRecurringRunDate(baseDate, raw.frequency, interval);

  const endDate = raw.endDate ? normalizeIsoDate(raw.endDate, raw.endDate) : undefined;

  return {
    frequency: raw.frequency,
    interval,
    nextRunDate,
    endDate,
  };
}

function normalizeTransaction(raw: Partial<Transaction>): Transaction {
  const now = new Date().toISOString();

  const category = raw.category && CATEGORIES.includes(raw.category)
    ? raw.category
    : 'Miscellaneous';

  const paymentMethod = raw.paymentMethod && PAYMENT_METHODS.includes(raw.paymentMethod)
    ? raw.paymentMethod
    : 'Cash';

  const rawNotes = typeof raw.notes === 'string' ? raw.notes.trim() : '';
  const rawDescription = typeof raw.description === 'string' ? raw.description.trim() : '';
  const description = rawDescription || rawNotes || category;
  const merchant = typeof raw.merchant === 'string' && raw.merchant.trim()
    ? raw.merchant.trim()
    : undefined;

  const tags = Array.isArray(raw.tags)
    ? Array.from(
        new Set(
          raw.tags
            .filter((tag): tag is string => typeof tag === 'string')
            .map((tag) => tag.trim())
            .filter(Boolean)
        )
      )
    : [];

  const split = Array.isArray(raw.split)
    ? raw.split.map((entry) => normalizeSplit(entry)).filter((entry): entry is TransactionSplit => !!entry)
    : [];

  const splitTotal = split.reduce((sum, entry) => sum + entry.amount, 0);
  const amount = split.length > 0
    ? Number(splitTotal.toFixed(2))
    : typeof raw.amount === 'number' && Number.isFinite(raw.amount)
      ? Number(raw.amount.toFixed(2))
      : 0;

  const subCategory =
    typeof raw.subCategory === 'string' && raw.subCategory.trim().length > 0
      ? raw.subCategory.trim()
      : split[0]?.subCategory;

  const date = normalizeIsoDate(raw.date, now);

  const recurring = normalizeRecurring(raw.recurring, date);

  const attachmentBase64 =
    typeof raw.attachmentBase64 === 'string' && raw.attachmentBase64.trim().length > 0
      ? raw.attachmentBase64
      : undefined;

  return {
    id: typeof raw.id === 'string' && raw.id.trim() ? raw.id : uuidv4(),
    amount,
    category: split[0]?.category || category,
    subCategory,
    merchant,
    description,
    date,
    paymentMethod,
    notes: rawNotes,
    tags,
    attachmentBase64,
    split: split.length > 0 ? split : undefined,
    recurring,
    recurringOriginId:
      typeof raw.recurringOriginId === 'string' && raw.recurringOriginId.trim()
        ? raw.recurringOriginId
        : undefined,
    isAutoGenerated: Boolean(raw.isAutoGenerated),
    createdAt: normalizeIsoDate(raw.createdAt, now),
    updatedAt: normalizeIsoDate(raw.updatedAt, raw.createdAt || now),
    synced: typeof raw.synced === 'boolean' ? raw.synced : true,
  };
}

function normalizeBudget(raw: Partial<Budget>): Budget {
  const nowMonth = format(new Date(), 'yyyy-MM');
  const category = raw.category && (raw.category === 'Overall' || CATEGORIES.includes(raw.category))
    ? raw.category
    : 'Overall';

  const subCategory =
    category !== 'Overall' && typeof raw.subCategory === 'string' && raw.subCategory.trim().length > 0
      ? raw.subCategory.trim()
      : undefined;

  const monthlyLimit = typeof raw.monthlyLimit === 'number' && Number.isFinite(raw.monthlyLimit)
    ? Number(raw.monthlyLimit.toFixed(2))
    : 0;

  const alertThresholdsTriggered = Array.isArray(raw.alertThresholdsTriggered)
    ? Array.from(
        new Set(
          raw.alertThresholdsTriggered.filter(
            (value): value is (typeof BUDGET_ALERT_THRESHOLDS)[number] =>
              BUDGET_ALERT_THRESHOLDS.includes(value as (typeof BUDGET_ALERT_THRESHOLDS)[number])
          )
        )
      ).sort((a, b) => a - b)
    : [];

  return {
    id: typeof raw.id === 'string' && raw.id.trim() ? raw.id : uuidv4(),
    category,
    subCategory,
    monthlyLimit,
    month: typeof raw.month === 'string' && /^\d{4}-\d{2}$/.test(raw.month) ? raw.month : nowMonth,
    rollover: Boolean(raw.rollover),
    alertThresholdsTriggered,
  };
}

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
  const raw = await readJsonFile<Partial<Transaction>[]>('transactions.json', []);
  return raw.map((tx) => normalizeTransaction(tx));
}

export async function saveTransactions(transactions: Transaction[]): Promise<void> {
  await writeJsonFile('transactions.json', transactions.map((tx) => normalizeTransaction(tx)));
}

export async function addTransaction(tx: Transaction): Promise<Transaction> {
  const transactions = await getTransactions();
  const normalized = normalizeTransaction(tx);
  transactions.push(normalized);
  await saveTransactions(transactions);
  return normalized;
}

export async function updateTransaction(id: string, updates: Partial<Transaction>): Promise<Transaction | null> {
  const transactions = await getTransactions();
  const idx = transactions.findIndex((t) => t.id === id);
  if (idx === -1) return null;
  transactions[idx] = normalizeTransaction({
    ...transactions[idx],
    ...updates,
    id,
    updatedAt: new Date().toISOString(),
  });
  await saveTransactions(transactions);
  return transactions[idx];
}

export async function deleteTransaction(id: string): Promise<boolean> {
  const transactions = await getTransactions();
  const filtered = transactions.filter((t) => t.id !== id);
  if (filtered.length === transactions.length) return false;
  await saveTransactions(filtered);
  return true;
}

export async function processRecurringTransactions(
  now: Date = new Date()
): Promise<{ created: number }> {
  const transactions = await getTransactions();
  let changed = false;
  let created = 0;
  const today = startOfDay(now);

  for (const template of transactions) {
    if (!template.recurring || template.isAutoGenerated) continue;

    const interval = Math.max(1, Math.floor(template.recurring.interval || 1));
    let nextRunDate =
      safeParseDate(template.recurring.nextRunDate) ||
      addRecurringInterval(safeParseDate(template.date) || now, template.recurring.frequency, interval);

    const endDate = safeParseDate(template.recurring.endDate);

    while (!isAfter(startOfDay(nextRunDate), today)) {
      if (endDate && isAfter(startOfDay(nextRunDate), startOfDay(endDate))) {
        break;
      }

      const runDay = format(nextRunDate, 'yyyy-MM-dd');
      const alreadyExists = transactions.some(
        (tx) => tx.recurringOriginId === template.id && tx.date.startsWith(runDay)
      );

      if (!alreadyExists) {
        const timestamp = new Date().toISOString();
        transactions.push(
          normalizeTransaction({
            ...template,
            id: uuidv4(),
            date: nextRunDate.toISOString(),
            recurring: undefined,
            recurringOriginId: template.id,
            isAutoGenerated: true,
            synced: true,
            createdAt: timestamp,
            updatedAt: timestamp,
          })
        );
        created += 1;
        changed = true;
      }

      nextRunDate = addRecurringInterval(nextRunDate, template.recurring.frequency, interval);
    }

    const nextRunIso = nextRunDate.toISOString();
    if (template.recurring.nextRunDate !== nextRunIso) {
      template.recurring = {
        ...template.recurring,
        interval,
        nextRunDate: nextRunIso,
      };
      template.updatedAt = new Date().toISOString();
      changed = true;
    }
  }

  if (changed) {
    await saveTransactions(transactions);
  }

  return { created };
}

// Budgets
export async function getBudgets(): Promise<Budget[]> {
  const raw = await readJsonFile<Partial<Budget>[]>('budgets.json', []);
  return raw.map((budget) => normalizeBudget(budget));
}

export async function saveBudgets(budgets: Budget[]): Promise<void> {
  await writeJsonFile('budgets.json', budgets.map((budget) => normalizeBudget(budget)));
}

export async function setBudget(budget: Budget): Promise<Budget> {
  const budgets = await getBudgets();
  const normalized = normalizeBudget(budget);
  const idx = budgets.findIndex(
    (b) =>
      b.id === normalized.id ||
      (
        b.category === normalized.category &&
        b.month === normalized.month &&
        (b.subCategory || '') === (normalized.subCategory || '')
      )
  );
  if (idx >= 0) {
    budgets[idx] = {
      ...budgets[idx],
      ...normalized,
      id: budgets[idx].id,
    };
  } else {
    budgets.push(normalized);
  }
  await saveBudgets(budgets);
  return idx >= 0 ? budgets[idx] : normalized;
}

export async function deleteBudget(id: string): Promise<boolean> {
  const budgets = await getBudgets();
  const filtered = budgets.filter((b) => b.id !== id);
  if (filtered.length === budgets.length) return false;
  await saveBudgets(filtered);
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
