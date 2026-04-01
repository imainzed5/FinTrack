'use client';

import { addDays, addMonths, addYears, differenceInCalendarDays, format } from 'date-fns';
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { v4 as uuidv4 } from 'uuid';
import {
  computeAccountBalance,
  resolveDefaultExpensePaymentMethodForAccountType,
  resolvePreferredDefaultAccount,
} from './accounts-utils';
import {
  buildDashboardData,
  computeMonthlySavingsHistory,
  detectSubscriptions,
  generateTimelineEvents,
  mergeTriggeredBudgetThresholds,
} from './insights-engine';
import {
  createDisplayNameFromSession,
  DEFAULT_DEVICE_CURRENCY,
  EMPTY_LOCAL_USER_SETTINGS,
  getLocalAppSnapshotSummary,
  isRecordBackedUp,
  type DeviceProfile,
  type LocalAppSnapshot,
  type LocalOnboardingInput,
  type LocalRecordMeta,
  type LocalUserSettings,
} from './local-first';
import {
  publishBudgetAdd,
  publishBudgetDelete,
  publishBudgetEdit,
  publishTransactionAdd,
  publishTransactionDelete,
  publishTransactionEdit,
} from './transaction-ws';
import type {
  Account,
  AccountType,
  AccountWithBalance,
  Budget,
  DashboardData,
  Debt,
  DebtInput,
  MonthlySavings,
  PaymentMethod,
  RecurringConfig,
  RecurringFrequency,
  SavingsDeposit,
  SavingsDepositInput,
  SavingsGoal,
  SavingsGoalHealth,
  SavingsGoalInput,
  SavingsGoalMilestone,
  SavingsGoalsSummary,
  SavingsGoalStatus,
  SavingsGoalWithDeposits,
  TimelineEvent,
  Transaction,
  TransactionInput,
  TransactionSplit,
  TransactionType,
} from './types';
import type { AuthSessionResponse } from './auth-contract';

const DB_NAME = 'MonedaLocalFirst';
const DB_VERSION = 1;

const META_STORE = 'meta';
const ACCOUNTS_STORE = 'accounts';
const TRANSACTIONS_STORE = 'transactions';
const BUDGETS_STORE = 'budgets';
const SAVINGS_GOALS_STORE = 'savingsGoals';
const SAVINGS_DEPOSITS_STORE = 'savingsDeposits';
const DEBTS_STORE = 'debts';

const DEVICE_PROFILE_KEY = 'device-profile';
const USER_SETTINGS_KEY = 'user-settings';

type EntityStoreName =
  | typeof ACCOUNTS_STORE
  | typeof TRANSACTIONS_STORE
  | typeof BUDGETS_STORE
  | typeof SAVINGS_GOALS_STORE
  | typeof SAVINGS_DEPOSITS_STORE
  | typeof DEBTS_STORE;

type LocalRecordSyncStatus = LocalRecordMeta['syncStatus'];

interface MetaValueRecord {
  key: string;
  value: unknown;
  updatedAt: string;
}

interface StoredRecord<T> {
  id: string;
  value: T;
  meta: LocalRecordMeta;
}

interface MonedaLocalDB extends DBSchema {
  meta: {
    key: string;
    value: MetaValueRecord;
  };
  accounts: {
    key: string;
    value: StoredRecord<Account>;
  };
  transactions: {
    key: string;
    value: StoredRecord<Transaction>;
  };
  budgets: {
    key: string;
    value: StoredRecord<Budget>;
  };
  savingsGoals: {
    key: string;
    value: StoredRecord<SavingsGoal>;
  };
  savingsDeposits: {
    key: string;
    value: StoredRecord<SavingsDeposit>;
  };
  debts: {
    key: string;
    value: StoredRecord<Debt>;
  };
}

let dbPromise: Promise<IDBPDatabase<MonedaLocalDB>> | null = null;

function getNowIso(): string {
  return new Date().toISOString();
}

function normalizeText(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeDateInput(value?: string): string {
  if (!value) {
    return getNowIso();
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return getNowIso();
  }

  return parsed.toISOString();
}

function normalizeDateOnly(value?: string | null): string | null {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString().split('T')[0];
}

function roundMoney(value: number): number {
  return Number(value.toFixed(2));
}

function advanceRecurringDate(
  fromDate: string,
  frequency: RecurringFrequency,
  interval = 1
): string {
  const steps = Math.max(1, Math.floor(interval));
  const baseDate = new Date(fromDate);

  if (Number.isNaN(baseDate.getTime())) {
    return getNowIso();
  }

  if (frequency === 'daily') {
    return addDays(baseDate, steps).toISOString();
  }

  if (frequency === 'weekly') {
    return addDays(baseDate, steps * 7).toISOString();
  }

  if (frequency === 'yearly') {
    return addYears(baseDate, steps).toISOString();
  }

  return addMonths(baseDate, steps).toISOString();
}

function buildRecurringConfig(
  fromDate: string,
  frequency: RecurringFrequency,
  interval = 1,
  endDate?: string
): RecurringConfig {
  return {
    frequency,
    interval: Math.max(1, Math.floor(interval)),
    nextRunDate: advanceRecurringDate(fromDate, frequency, interval),
    endDate: endDate ? normalizeDateInput(endDate) : undefined,
  };
}

function sameDateKey(left: string, right: string): boolean {
  return left.split('T')[0] === right.split('T')[0];
}

function getGoalHealth(goal: SavingsGoal): SavingsGoalHealth {
  if (!goal.deadline) {
    return 'no_deadline';
  }

  const created = new Date(goal.createdAt);
  const deadline = new Date(goal.deadline);
  if (Number.isNaN(created.getTime()) || Number.isNaN(deadline.getTime())) {
    return 'no_deadline';
  }

  const totalDays = Math.max(1, differenceInCalendarDays(deadline, created));
  const elapsedDays = Math.max(
    0,
    Math.min(totalDays, differenceInCalendarDays(new Date(), created))
  );
  const expectedPercent = Math.max(0, Math.min(100, (elapsedDays / totalDays) * 100));
  const progressPercent = goal.targetAmount > 0
    ? Math.min(Math.round((goal.currentAmount / goal.targetAmount) * 100), 100)
    : 0;

  if (progressPercent >= expectedPercent - 5) {
    return 'on_track';
  }

  if (progressPercent >= expectedPercent - 20) {
    return 'falling_behind';
  }

  return 'at_risk';
}

function getProjectedCompletionDate(
  goal: SavingsGoal,
  deposits: SavingsDeposit[]
): string | undefined {
  const depositOnly = deposits
    .filter((entry) => entry.type === 'deposit')
    .sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime());

  if (depositOnly.length === 0) {
    return undefined;
  }

  const firstDepositDate = new Date(depositOnly[0].createdAt);
  if (Number.isNaN(firstDepositDate.getTime())) {
    return undefined;
  }

  const depositTotal = depositOnly.reduce((sum, entry) => sum + entry.amount, 0);
  const daysSinceFirstDeposit = Math.max(1, differenceInCalendarDays(new Date(), firstDepositDate) + 1);
  const averageDailyDeposit = depositTotal / daysSinceFirstDeposit;
  if (averageDailyDeposit <= 0) {
    return undefined;
  }

  const remaining = Math.max(0, goal.targetAmount - goal.currentAmount);
  if (remaining <= 0) {
    return new Date().toISOString().split('T')[0];
  }

  return addDays(new Date(), Math.ceil(remaining / averageDailyDeposit))
    .toISOString()
    .split('T')[0];
}

function getRequiredMonthlyAmount(goal: SavingsGoal): number | undefined {
  if (!goal.deadline) {
    return undefined;
  }

  const deadline = new Date(goal.deadline);
  if (Number.isNaN(deadline.getTime())) {
    return undefined;
  }

  const remaining = Math.max(0, goal.targetAmount - goal.currentAmount);
  if (remaining <= 0) {
    return 0;
  }

  const daysUntilDeadline = differenceInCalendarDays(deadline, new Date());
  if (daysUntilDeadline <= 0) {
    return undefined;
  }

  return roundMoney(remaining / Math.max(1, Math.ceil(daysUntilDeadline / 30)));
}

function getGoalMilestones(goal: SavingsGoal, deposits: SavingsDeposit[]): SavingsGoalMilestone[] {
  const thresholds: Array<25 | 50 | 75 | 100> = [25, 50, 75, 100];
  const sortedDeposits = [...deposits].sort(
    (left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()
  );

  let runningTotal = 0;
  const hits = new Map<number, string>();

  for (const deposit of sortedDeposits) {
    if (deposit.type !== 'deposit') {
      continue;
    }

    runningTotal += deposit.amount;
    const progressPercent = goal.targetAmount > 0 ? (runningTotal / goal.targetAmount) * 100 : 0;

    for (const threshold of thresholds) {
      if (!hits.has(threshold) && progressPercent >= threshold) {
        hits.set(threshold, deposit.createdAt);
      }
    }
  }

  return thresholds.map((percent) => ({
    percent,
    hitAt: hits.get(percent),
  }));
}

function buildSavingsGoalWithDeposits(
  goal: SavingsGoal,
  deposits: SavingsDeposit[]
): SavingsGoalWithDeposits {
  const progressPercent = goal.targetAmount > 0
    ? Math.min(Math.round((goal.currentAmount / goal.targetAmount) * 100), 100)
    : 0;

  return {
    ...goal,
    deposits,
    progressPercent,
    health: getGoalHealth(goal),
    projectedCompletionDate: getProjectedCompletionDate(goal, deposits),
    requiredMonthlyAmount: getRequiredMonthlyAmount(goal),
    milestones: getGoalMilestones(goal, deposits),
  };
}

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB<MonedaLocalDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(META_STORE)) {
          db.createObjectStore(META_STORE, { keyPath: 'key' });
        }

        if (!db.objectStoreNames.contains(ACCOUNTS_STORE)) {
          db.createObjectStore(ACCOUNTS_STORE, { keyPath: 'id' });
        }

        if (!db.objectStoreNames.contains(TRANSACTIONS_STORE)) {
          db.createObjectStore(TRANSACTIONS_STORE, { keyPath: 'id' });
        }

        if (!db.objectStoreNames.contains(BUDGETS_STORE)) {
          db.createObjectStore(BUDGETS_STORE, { keyPath: 'id' });
        }

        if (!db.objectStoreNames.contains(SAVINGS_GOALS_STORE)) {
          db.createObjectStore(SAVINGS_GOALS_STORE, { keyPath: 'id' });
        }

        if (!db.objectStoreNames.contains(SAVINGS_DEPOSITS_STORE)) {
          db.createObjectStore(SAVINGS_DEPOSITS_STORE, { keyPath: 'id' });
        }

        if (!db.objectStoreNames.contains(DEBTS_STORE)) {
          db.createObjectStore(DEBTS_STORE, { keyPath: 'id' });
        }
      },
    });
  }

  return dbPromise;
}

async function getMetaValue<T>(key: string, fallback: T): Promise<T> {
  const db = await getDb();
  const record = await db.get(META_STORE, key);
  return record ? (record.value as T) : fallback;
}

async function setMetaValue<T>(key: string, value: T): Promise<void> {
  const db = await getDb();
  await db.put(META_STORE, {
    key,
    value,
    updatedAt: getNowIso(),
  });
}

async function getStoredRecords<T>(storeName: EntityStoreName): Promise<Array<StoredRecord<T>>> {
  const db = await getDb();
  return (await db.getAll(storeName as never)) as Array<StoredRecord<T>>;
}

async function getStoredValues<T>(storeName: EntityStoreName): Promise<T[]> {
  const records = await getStoredRecords<T>(storeName);
  return records.map((record) => record.value);
}

function withTransactionSyncState(record: StoredRecord<Transaction>): Transaction {
  return {
    ...record.value,
    synced: isRecordBackedUp(record.meta.syncStatus),
  };
}

async function resolveNewRecordStatus(): Promise<LocalRecordSyncStatus> {
  const profile = await getDeviceProfile();
  return profile?.cloudLinkedUserId ? 'pending_upload' : 'local_only';
}

async function putStoredValue<T extends { id: string }>(
  storeName: EntityStoreName,
  value: T,
  options: {
    source?: LocalRecordMeta['source'];
    syncStatus?: LocalRecordSyncStatus;
  } = {}
): Promise<void> {
  const db = await getDb();
  const existing = (await db.get(storeName as never, value.id as never)) as StoredRecord<T> | undefined;
  const syncStatus = options.syncStatus ?? await resolveNewRecordStatus();

  await db.put(storeName as never, {
    id: value.id,
    value,
    meta: {
      localUpdatedAt: getNowIso(),
      syncStatus,
      source: options.source ?? existing?.meta.source ?? 'device',
    },
  } as never);
}

async function deleteStoredValue(storeName: EntityStoreName, id: string): Promise<void> {
  const db = await getDb();
  await db.delete(storeName as never, id as never);
}

async function clearStore(storeName: EntityStoreName): Promise<void> {
  const db = await getDb();
  await db.clear(storeName as never);
}

async function replaceStoreValues<T extends { id: string }>(
  storeName: EntityStoreName,
  values: T[],
  options: {
    source: LocalRecordMeta['source'];
    syncStatus: LocalRecordSyncStatus;
  }
): Promise<void> {
  await clearStore(storeName);
  const db = await getDb();
  const transaction = db.transaction(storeName as never, 'readwrite');

  for (const value of values) {
    await transaction.store.put({
      id: value.id,
      value,
      meta: {
        localUpdatedAt: getNowIso(),
        syncStatus: options.syncStatus,
        source: options.source,
      },
    } as never);
  }

  await transaction.done;
}

async function markAllStoreRecordsSynced(storeName: EntityStoreName): Promise<void> {
  const db = await getDb();
  const transaction = db.transaction(storeName as never, 'readwrite');
  const allRecords = (await transaction.store.getAll()) as Array<StoredRecord<unknown>>;

  for (const record of allRecords) {
    await transaction.store.put({
      ...record,
      meta: {
        ...record.meta,
        localUpdatedAt: getNowIso(),
        syncStatus: 'synced',
      },
    } as never);
  }

  await transaction.done;
}

async function markAllStoreRecordsPending(storeName: EntityStoreName): Promise<void> {
  const db = await getDb();
  const transaction = db.transaction(storeName as never, 'readwrite');
  const allRecords = (await transaction.store.getAll()) as Array<StoredRecord<unknown>>;

  for (const record of allRecords) {
    await transaction.store.put({
      ...record,
      meta: {
        ...record.meta,
        localUpdatedAt: getNowIso(),
        syncStatus: 'pending_upload',
      },
    } as never);
  }

  await transaction.done;
}

function emitTransactionUpdate(action: 'add' | 'edit' | 'delete', payload: unknown) {
  if (action === 'add') {
    publishTransactionAdd(payload);
    return;
  }

  if (action === 'delete') {
    publishTransactionDelete(typeof payload === 'string' ? payload : 'local-delete');
    return;
  }

  publishTransactionEdit(payload);
}

function emitBudgetUpdate(action: 'add' | 'edit' | 'delete', payload: unknown) {
  if (action === 'add') {
    publishBudgetAdd(payload);
    return;
  }

  if (action === 'delete') {
    publishBudgetDelete(typeof payload === 'string' ? payload : 'local-delete');
    return;
  }

  publishBudgetEdit(payload);
}

function buildLocalUserId(profile: DeviceProfile | null): string {
  return profile?.cloudLinkedUserId || profile?.id || 'local-device';
}

function buildSeededDeviceProfile(session: AuthSessionResponse): DeviceProfile {
  const nowIso = getNowIso();
  return {
    id: uuidv4(),
    deviceId: uuidv4(),
    displayName: createDisplayNameFromSession(session),
    currency: DEFAULT_DEVICE_CURRENCY,
    onboardingComplete: true,
    cloudLinkedUserId: session.user?.id ?? null,
    createdAt: nowIso,
    updatedAt: nowIso,
    lastSyncedAt: session.user ? nowIso : null,
  };
}

export async function getDeviceProfile(): Promise<DeviceProfile | null> {
  return getMetaValue<DeviceProfile | null>(DEVICE_PROFILE_KEY, null);
}

export async function saveDeviceProfile(profile: DeviceProfile): Promise<DeviceProfile> {
  const nowIso = getNowIso();
  const existing = await getDeviceProfile();
  const nextProfile: DeviceProfile = {
    ...profile,
    createdAt: existing?.createdAt ?? profile.createdAt ?? nowIso,
    updatedAt: nowIso,
  };

  await setMetaValue(DEVICE_PROFILE_KEY, nextProfile);
  return nextProfile;
}

export async function getLocalUserSettings(): Promise<LocalUserSettings> {
  return getMetaValue<LocalUserSettings>(USER_SETTINGS_KEY, EMPTY_LOCAL_USER_SETTINGS);
}

export async function saveLocalUserSettings(
  updates: Partial<LocalUserSettings>
): Promise<LocalUserSettings> {
  const current = await getLocalUserSettings();
  const nextSettings: LocalUserSettings = {
    ...current,
    ...updates,
    nextPayday: normalizeDateOnly(updates.nextPayday ?? current.nextPayday),
  };

  await setMetaValue(USER_SETTINGS_KEY, nextSettings);
  return nextSettings;
}

export async function hasLocalAppData(): Promise<boolean> {
  const [profile, accounts, transactions, budgets, goals, deposits, debts] = await Promise.all([
    getDeviceProfile(),
    getStoredRecords<Account>(ACCOUNTS_STORE),
    getStoredRecords<Transaction>(TRANSACTIONS_STORE),
    getStoredRecords<Budget>(BUDGETS_STORE),
    getStoredRecords<SavingsGoal>(SAVINGS_GOALS_STORE),
    getStoredRecords<SavingsDeposit>(SAVINGS_DEPOSITS_STORE),
    getStoredRecords<Debt>(DEBTS_STORE),
  ]);

  return Boolean(
    profile ||
    accounts.length ||
    transactions.length ||
    budgets.length ||
    goals.length ||
    deposits.length ||
    debts.length
  );
}

export async function clearLocalAppData(): Promise<void> {
  await Promise.all([
    clearStore(ACCOUNTS_STORE),
    clearStore(TRANSACTIONS_STORE),
    clearStore(BUDGETS_STORE),
    clearStore(SAVINGS_GOALS_STORE),
    clearStore(SAVINGS_DEPOSITS_STORE),
    clearStore(DEBTS_STORE),
  ]);

  await setMetaValue<DeviceProfile | null>(DEVICE_PROFILE_KEY, null);
  await setMetaValue(USER_SETTINGS_KEY, EMPTY_LOCAL_USER_SETTINGS);
}

export async function exportLocalSnapshot(): Promise<LocalAppSnapshot> {
  const [
    deviceProfile,
    userSettings,
    accounts,
    transactions,
    budgets,
    savingsGoals,
    savingsDeposits,
    debts,
  ] = await Promise.all([
    getDeviceProfile(),
    getLocalUserSettings(),
    getAccounts({ includeArchived: true }),
    getTransactions({ includeRecurringProcessing: false }),
    getBudgets(),
    getSavingsGoals(),
    getSavingsDeposits(),
    getDebts(),
  ]);

  const snapshot: LocalAppSnapshot = {
    version: 1,
    exportedAt: getNowIso(),
    deviceProfile,
    userSettings,
    accounts,
    transactions,
    budgets,
    savingsGoals,
    savingsDeposits,
    debts,
  };

  return {
    ...snapshot,
    summary: getLocalAppSnapshotSummary(snapshot),
  };
}

export async function replaceLocalSnapshot(
  snapshot: LocalAppSnapshot,
  options: {
    preserveDeviceIdentity?: boolean;
    linkedCloudUserId?: string | null;
    source?: LocalRecordMeta['source'];
  } = {}
): Promise<DeviceProfile | null> {
  const currentProfile = await getDeviceProfile();
  const source = options.source ?? 'cloud';
  const syncStatus: LocalRecordSyncStatus = options.linkedCloudUserId ? 'synced' : 'local_only';
  const nextProfile = snapshot.deviceProfile
    ? {
        ...snapshot.deviceProfile,
        id: options.preserveDeviceIdentity && currentProfile ? currentProfile.id : snapshot.deviceProfile.id,
        deviceId:
          options.preserveDeviceIdentity && currentProfile
            ? currentProfile.deviceId
            : snapshot.deviceProfile.deviceId,
        cloudLinkedUserId: options.linkedCloudUserId ?? snapshot.deviceProfile.cloudLinkedUserId ?? null,
        lastSyncedAt: options.linkedCloudUserId ? getNowIso() : snapshot.deviceProfile.lastSyncedAt ?? null,
        updatedAt: getNowIso(),
      }
    : currentProfile;

  await Promise.all([
    replaceStoreValues<Account>(ACCOUNTS_STORE, snapshot.accounts, { source, syncStatus }),
    replaceStoreValues<Transaction>(TRANSACTIONS_STORE, snapshot.transactions, { source, syncStatus }),
    replaceStoreValues<Budget>(BUDGETS_STORE, snapshot.budgets, { source, syncStatus }),
    replaceStoreValues<SavingsGoal>(SAVINGS_GOALS_STORE, snapshot.savingsGoals, { source, syncStatus }),
    replaceStoreValues<SavingsDeposit>(SAVINGS_DEPOSITS_STORE, snapshot.savingsDeposits, { source, syncStatus }),
    replaceStoreValues<Debt>(DEBTS_STORE, snapshot.debts, { source, syncStatus }),
    setMetaValue(USER_SETTINGS_KEY, snapshot.userSettings ?? EMPTY_LOCAL_USER_SETTINGS),
  ]);

  if (nextProfile) {
    await saveDeviceProfile(nextProfile);
  }

  emitTransactionUpdate('edit', { scope: 'snapshot-replaced' });
  emitBudgetUpdate('edit', { scope: 'snapshot-replaced' });
  return nextProfile ?? null;
}

export async function markLocalSnapshotSynced(userId: string): Promise<DeviceProfile | null> {
  await Promise.all([
    markAllStoreRecordsSynced(ACCOUNTS_STORE),
    markAllStoreRecordsSynced(TRANSACTIONS_STORE),
    markAllStoreRecordsSynced(BUDGETS_STORE),
    markAllStoreRecordsSynced(SAVINGS_GOALS_STORE),
    markAllStoreRecordsSynced(SAVINGS_DEPOSITS_STORE),
    markAllStoreRecordsSynced(DEBTS_STORE),
  ]);

  emitTransactionUpdate('edit', { scope: 'sync-state' });
  emitBudgetUpdate('edit', { scope: 'sync-state' });

  const profile = await getDeviceProfile();
  if (!profile) {
    return null;
  }

  return saveDeviceProfile({
    ...profile,
    cloudLinkedUserId: userId,
    lastSyncedAt: getNowIso(),
  });
}

export async function markLocalSnapshotPending(): Promise<void> {
  await Promise.all([
    markAllStoreRecordsPending(ACCOUNTS_STORE),
    markAllStoreRecordsPending(TRANSACTIONS_STORE),
    markAllStoreRecordsPending(BUDGETS_STORE),
    markAllStoreRecordsPending(SAVINGS_GOALS_STORE),
    markAllStoreRecordsPending(SAVINGS_DEPOSITS_STORE),
    markAllStoreRecordsPending(DEBTS_STORE),
  ]);

  emitTransactionUpdate('edit', { scope: 'sync-state' });
  emitBudgetUpdate('edit', { scope: 'sync-state' });
}

export async function seedDeviceProfileFromAuth(
  session: AuthSessionResponse
): Promise<DeviceProfile> {
  const existing = await getDeviceProfile();
  const profile = existing
    ? {
        ...existing,
        displayName: existing.displayName || createDisplayNameFromSession(session),
        onboardingComplete: true,
        cloudLinkedUserId: session.user?.id ?? existing.cloudLinkedUserId ?? null,
      }
    : buildSeededDeviceProfile(session);

  return saveDeviceProfile(profile);
}

export async function completeLocalOnboarding(
  input: LocalOnboardingInput,
  options: { linkedCloudUserId?: string | null } = {}
): Promise<DeviceProfile> {
  const existing = await getDeviceProfile();
  const nowIso = getNowIso();

  const nextProfile: DeviceProfile = {
    id: existing?.id ?? uuidv4(),
    deviceId: existing?.deviceId ?? uuidv4(),
    displayName: input.displayName.trim(),
    currency: input.currency || DEFAULT_DEVICE_CURRENCY,
    onboardingComplete: true,
    cloudLinkedUserId: options.linkedCloudUserId ?? existing?.cloudLinkedUserId ?? null,
    createdAt: existing?.createdAt ?? nowIso,
    updatedAt: nowIso,
    lastSyncedAt: existing?.lastSyncedAt ?? null,
  };

  const profile = await saveDeviceProfile(nextProfile);
  const accounts = await getAccounts({ includeArchived: true });

  let defaultAccountId = resolvePreferredDefaultAccount(accounts)?.id;
  if (!defaultAccountId) {
    const defaultAccount = await createAccount({
      name: normalizeText(input.startingAccountName) ?? 'Cash',
      type: 'Cash',
      initialBalance: Number.isFinite(input.startingBalance)
        ? roundMoney(input.startingBalance ?? 0)
        : 0,
      isSystemCashWallet: true,
    });
    defaultAccountId = defaultAccount.id;
  }

  if (!profile.defaultAccountId && defaultAccountId) {
    await saveDeviceProfile({
      ...profile,
      defaultAccountId,
      defaultBudgetAmount:
        typeof input.monthlyBudget === 'number' && input.monthlyBudget > 0
          ? roundMoney(input.monthlyBudget)
          : undefined,
    });
  }

  if (typeof input.monthlyBudget === 'number' && input.monthlyBudget > 0) {
    await setBudget({
      id: uuidv4(),
      category: 'Overall',
      monthlyLimit: roundMoney(input.monthlyBudget),
      month: format(new Date(), 'yyyy-MM'),
      rollover: false,
      alertThresholdsTriggered: [],
    });
  }

  return (await getDeviceProfile()) as DeviceProfile;
}

export async function getPendingSyncCount(): Promise<number> {
  const stores: EntityStoreName[] = [
    ACCOUNTS_STORE,
    TRANSACTIONS_STORE,
    BUDGETS_STORE,
    SAVINGS_GOALS_STORE,
    SAVINGS_DEPOSITS_STORE,
    DEBTS_STORE,
  ];

  let count = 0;
  for (const storeName of stores) {
    const records = await getStoredRecords<unknown>(storeName);
    count += records.filter((record) => record.meta.syncStatus === 'pending_upload').length;
  }

  return count;
}

export async function getAccounts(
  options: { includeArchived?: boolean } = {}
): Promise<Account[]> {
  const accounts = await getStoredValues<Account>(ACCOUNTS_STORE);
  return accounts
    .filter((account) => options.includeArchived || !account.isArchived)
    .sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime());
}

export async function getAccountsWithBalances(
  options: { includeArchived?: boolean } = {}
): Promise<AccountWithBalance[]> {
  const [accounts, transactions] = await Promise.all([
    getAccounts({ includeArchived: options.includeArchived }),
    getTransactions({ includeRecurringProcessing: false }),
  ]);

  const transactionsByAccount = new Map<string, Transaction[]>();
  for (const transaction of transactions) {
    if (!transaction.accountId) {
      continue;
    }

    const bucket = transactionsByAccount.get(transaction.accountId) ?? [];
    bucket.push(transaction);
    transactionsByAccount.set(transaction.accountId, bucket);
  }

  return accounts.map((account) => ({
    ...account,
    computedBalance: computeAccountBalance(
      account.initialBalance,
      transactionsByAccount.get(account.id) ?? []
    ),
  }));
}

export async function getTotalBalance(): Promise<number> {
  const accounts = await getAccountsWithBalances();
  return roundMoney(accounts.reduce((sum, account) => sum + account.computedBalance, 0));
}

export async function createAccount(input: {
  name: string;
  type: AccountType;
  expensePaymentMethod?: PaymentMethod;
  initialBalance?: number;
  color?: string | null;
  icon?: string | null;
  isSystemCashWallet?: boolean;
}): Promise<Account> {
  const profile = await getDeviceProfile();
  const activeAccounts = await getAccounts();
  const name = normalizeText(input.name);

  if (!name) {
    throw new Error('Account name is required.');
  }

  const nowIso = getNowIso();
  const account: Account = {
    id: uuidv4(),
    userId: buildLocalUserId(profile),
    name,
    type: input.type,
    expensePaymentMethod:
      input.expensePaymentMethod ?? resolveDefaultExpensePaymentMethodForAccountType(input.type),
    initialBalance: roundMoney(input.initialBalance ?? 0),
    color: normalizeText(input.color ?? undefined),
    icon: normalizeText(input.icon ?? undefined),
    isSystemCashWallet: Boolean(input.isSystemCashWallet) || (activeAccounts.length === 0 && input.type === 'Cash'),
    isArchived: false,
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  if (account.isSystemCashWallet) {
    const existingAccounts = await getAccounts({ includeArchived: true });
    for (const existingAccount of existingAccounts.filter((entry) => entry.isSystemCashWallet)) {
      await putStoredValue<Account>(ACCOUNTS_STORE, {
        ...existingAccount,
        isSystemCashWallet: false,
        updatedAt: nowIso,
      });
    }
  }

  await putStoredValue<Account>(ACCOUNTS_STORE, account);
  emitTransactionUpdate('edit', { scope: 'accounts-updated' });
  return account;
}

export async function updateAccount(
  id: string,
  updates: {
    name?: string;
    type?: AccountType;
    expensePaymentMethod?: PaymentMethod;
    color?: string | null;
    icon?: string | null;
    initialBalance?: number;
  }
): Promise<Account> {
  const accounts = await getAccounts({ includeArchived: true });
  const account = accounts.find((entry) => entry.id === id);
  if (!account) {
    throw new Error('Account not found.');
  }

  const nextAccount: Account = {
    ...account,
    name: Object.prototype.hasOwnProperty.call(updates, 'name')
      ? normalizeText(updates.name) ?? account.name
      : account.name,
    type: updates.type ?? account.type,
    expensePaymentMethod: Object.prototype.hasOwnProperty.call(updates, 'expensePaymentMethod')
      ? updates.expensePaymentMethod ?? resolveDefaultExpensePaymentMethodForAccountType(updates.type ?? account.type)
      : account.expensePaymentMethod,
    color: Object.prototype.hasOwnProperty.call(updates, 'color')
      ? normalizeText(updates.color ?? undefined)
      : account.color,
    icon: Object.prototype.hasOwnProperty.call(updates, 'icon')
      ? normalizeText(updates.icon ?? undefined)
      : account.icon,
    initialBalance:
      typeof updates.initialBalance === 'number'
        ? roundMoney(updates.initialBalance)
        : account.initialBalance,
    updatedAt: getNowIso(),
  };

  await putStoredValue<Account>(ACCOUNTS_STORE, nextAccount);
  emitTransactionUpdate('edit', { scope: 'accounts-updated' });
  return nextAccount;
}

export async function setAccountArchived(id: string, isArchived: boolean): Promise<Account> {
  const accounts = await getAccounts({ includeArchived: true });
  const account = accounts.find((entry) => entry.id === id);
  if (!account) {
    throw new Error('Account not found.');
  }

  if (isArchived) {
    const activeCount = accounts.filter((entry) => !entry.isArchived).length;
    if (activeCount <= 1) {
      throw new Error('You must keep at least one active account.');
    }
  }

  const nextAccount: Account = {
    ...account,
    isArchived,
    updatedAt: getNowIso(),
  };

  await putStoredValue<Account>(ACCOUNTS_STORE, nextAccount);
  emitTransactionUpdate('edit', { scope: 'accounts-updated' });
  return nextAccount;
}

export async function resolveDefaultAccountId(): Promise<string> {
  const preferredAccount = resolvePreferredDefaultAccount(await getAccounts());
  if (preferredAccount) {
    return preferredAccount.id;
  }

  return (
    await createAccount({
      name: 'Cash',
      type: 'Cash',
      initialBalance: 0,
      isSystemCashWallet: true,
    })
  ).id;
}

export async function addAccountBalanceAdjustment(input: {
  accountId: string;
  amount: number;
  note?: string;
  date?: string;
}): Promise<Transaction> {
  if (!Number.isFinite(input.amount) || input.amount === 0) {
    throw new Error('Adjustment amount must be non-zero.');
  }

  const note = normalizeText(input.note);
  return createTransaction({
    amount: Math.abs(input.amount),
    type: input.amount > 0 ? 'income' : 'expense',
    incomeCategory: input.amount > 0 ? 'Other Income' : undefined,
    accountId: input.accountId,
    category: 'Miscellaneous',
    subCategory: 'Account Adjustment',
    description: note || 'Account balance adjustment',
    notes: note,
    date: normalizeDateInput(input.date),
    paymentMethod: 'Bank Transfer',
  });
}

export async function createTransfer(input: {
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  date?: string;
  notes?: string;
  metadata?: Record<string, unknown>;
}): Promise<{ transferGroupId: string; debitTransactionId: string; creditTransactionId: string }> {
  const accounts = await getAccountsWithBalances({ includeArchived: true });
  const fromAccount = accounts.find((entry) => entry.id === input.fromAccountId);
  const toAccount = accounts.find((entry) => entry.id === input.toAccountId);

  if (!fromAccount || !toAccount) {
    throw new Error('Select valid accounts for this transfer.');
  }

  if (fromAccount.id === toAccount.id) {
    throw new Error('Choose two different accounts.');
  }

  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new Error('Transfer amount must be greater than zero.');
  }

  if (fromAccount.computedBalance + 0.005 < input.amount) {
    throw new Error('Insufficient balance.');
  }

  const transferGroupId = uuidv4();
  const transferDate = normalizeDateInput(input.date);
  const note = normalizeText(input.notes);

  const debitTransaction = await storeTransaction({
    id: uuidv4(),
    amount: roundMoney(input.amount),
    type: 'expense',
    category: 'Miscellaneous',
    subCategory: 'Transfer',
    merchant: toAccount.name,
    description: `Transfer to ${toAccount.name}`,
    date: transferDate,
    paymentMethod: 'Bank Transfer',
    notes: note,
    accountId: fromAccount.id,
    transferGroupId,
    metadata: input.metadata,
    createdAt: getNowIso(),
    updatedAt: getNowIso(),
  }, 'add');

  const creditTransaction = await storeTransaction({
    id: uuidv4(),
    amount: roundMoney(input.amount),
    type: 'income',
    incomeCategory: 'Other Income',
    category: 'Miscellaneous',
    subCategory: 'Transfer',
    merchant: fromAccount.name,
    description: `Transfer from ${fromAccount.name}`,
    date: transferDate,
    paymentMethod: 'Bank Transfer',
    notes: note,
    accountId: toAccount.id,
    transferGroupId,
    metadata: input.metadata,
    createdAt: getNowIso(),
    updatedAt: getNowIso(),
  }, 'add');

  return {
    transferGroupId,
    debitTransactionId: debitTransaction.id,
    creditTransactionId: creditTransaction.id,
  };
}

async function storeTransaction(
  transaction: Transaction,
  action: 'add' | 'edit'
): Promise<Transaction> {
  await putStoredValue<Transaction>(TRANSACTIONS_STORE, transaction);
  emitTransactionUpdate(action, transaction);
  return transaction;
}

async function getRawTransactions(): Promise<Transaction[]> {
  const records = await getStoredRecords<Transaction>(TRANSACTIONS_STORE);
  return records.map(withTransactionSyncState);
}

export async function processRecurringTransactions(): Promise<void> {
  const transactions = await getRawTransactions();
  const baseTransactions = transactions.filter(
    (transaction) => Boolean(transaction.recurring) && !transaction.recurringOriginId
  );

  const now = new Date();

  for (const baseTransaction of baseTransactions) {
    const recurring = baseTransaction.recurring;
    if (!recurring) {
      continue;
    }

    let nextRunDate = recurring.nextRunDate;
    let generated = false;

    while (true) {
      const nextRun = new Date(nextRunDate);
      const endDate = recurring.endDate ? new Date(recurring.endDate) : null;

      if (Number.isNaN(nextRun.getTime()) || nextRun > now) {
        break;
      }

      if (endDate && nextRun > endDate) {
        break;
      }

      const alreadyGenerated = transactions.some(
        (transaction) =>
          transaction.recurringOriginId === baseTransaction.id &&
          sameDateKey(transaction.date, nextRunDate)
      );

      if (!alreadyGenerated) {
        await storeTransaction({
          ...baseTransaction,
          id: uuidv4(),
          date: nextRun.toISOString(),
          recurring: undefined,
          recurringOriginId: baseTransaction.id,
          isAutoGenerated: true,
          createdAt: getNowIso(),
          updatedAt: getNowIso(),
        }, 'add');
        generated = true;
      }

      nextRunDate = advanceRecurringDate(nextRunDate, recurring.frequency, recurring.interval);
    }

    if (generated || nextRunDate !== recurring.nextRunDate) {
      await storeTransaction({
        ...baseTransaction,
        recurring: {
          ...recurring,
          nextRunDate,
        },
        updatedAt: getNowIso(),
      }, 'edit');
    }
  }
}

export async function getTransactions(options: {
  includeRecurringProcessing?: boolean;
} = {}): Promise<Transaction[]> {
  if (options.includeRecurringProcessing !== false) {
    await processRecurringTransactions();
  }

  const transactions = await getRawTransactions();
  return transactions.sort((left, right) => new Date(right.date).getTime() - new Date(left.date).getTime());
}

export async function getActiveRecurringTransactions(): Promise<Transaction[]> {
  const transactions = await getTransactions();
  return transactions
    .filter((transaction) => Boolean(transaction.recurring) && !transaction.recurringOriginId)
    .sort((left, right) => {
      const leftRun = left.recurring?.nextRunDate ? new Date(left.recurring.nextRunDate).getTime() : 0;
      const rightRun = right.recurring?.nextRunDate ? new Date(right.recurring.nextRunDate).getTime() : 0;
      return leftRun - rightRun;
    });
}

export async function createTransaction(input: TransactionInput): Promise<Transaction> {
  const type: TransactionType = input.type === 'income' || input.type === 'savings'
    ? input.type
    : 'expense';

  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new Error('Amount must be greater than zero.');
  }

  const nowIso = getNowIso();
  const normalizedDate = normalizeDateInput(input.date);
  const paymentMethod = (input.paymentMethod ?? 'Cash') as PaymentMethod;
  const accountId = input.accountId ?? await resolveDefaultAccountId();

  let normalizedSplit: TransactionSplit[] | undefined;
  if (Array.isArray(input.split) && input.split.length > 0) {
    normalizedSplit = input.split.map((line) => ({
      id: line.id ?? uuidv4(),
      category: line.category,
      subCategory: normalizeText(line.subCategory),
      amount: roundMoney(line.amount),
    }));
  }

  const recurring = input.recurring
    ? buildRecurringConfig(
        normalizedDate,
        input.recurring.frequency,
        input.recurring.interval ?? 1,
        input.recurring.endDate
      )
    : undefined;

  const transaction: Transaction = {
    id: uuidv4(),
    amount: roundMoney(input.amount),
    type,
    accountId,
    linkedTransferGroupId: input.linkedTransferGroupId,
    incomeCategory: type === 'income' ? input.incomeCategory ?? 'Other Income' : undefined,
    category: type === 'income'
      ? 'Miscellaneous'
      : (normalizedSplit?.[0]?.category ?? input.category),
    subCategory:
      type === 'income'
        ? undefined
        : (normalizedSplit?.[0]?.subCategory ?? normalizeText(input.subCategory)),
    merchant: normalizeText(input.merchant),
    description: normalizeText(input.description) ?? normalizeText(input.notes) ?? input.category,
    date: normalizedDate,
    paymentMethod,
    notes: normalizeText(input.notes),
    tags: Array.isArray(input.tags) ? Array.from(new Set(input.tags.filter(Boolean))) : [],
    attachmentBase64: normalizeText(input.attachmentBase64),
    metadata: input.metadata,
    split: normalizedSplit,
    recurring,
    createdAt: nowIso,
    updatedAt: nowIso,
    synced: false,
  };

  return storeTransaction(transaction, 'add');
}

export async function updateTransaction(
  id: string,
  updates: Partial<Transaction>
): Promise<Transaction | null> {
  const transactions = await getTransactions({ includeRecurringProcessing: false });
  const existing = transactions.find((transaction) => transaction.id === id);
  if (!existing) {
    return null;
  }

  const nextTransaction: Transaction = {
    ...existing,
    ...updates,
    split: Object.prototype.hasOwnProperty.call(updates, 'split')
      ? updates.split
      : existing.split,
    recurring: Object.prototype.hasOwnProperty.call(updates, 'recurring')
      ? updates.recurring
      : existing.recurring,
    updatedAt: getNowIso(),
  };

  await storeTransaction(nextTransaction, 'edit');
  return nextTransaction;
}

export async function deleteTransaction(id: string): Promise<boolean> {
  const transactions = await getTransactions({ includeRecurringProcessing: false });
  const exists = transactions.some((transaction) => transaction.id === id);
  if (!exists) {
    return false;
  }

  await deleteStoredValue(TRANSACTIONS_STORE, id);
  emitTransactionUpdate('delete', id);
  return true;
}

export async function getBudgets(): Promise<Budget[]> {
  const budgets = await getStoredValues<Budget>(BUDGETS_STORE);
  return budgets.sort((left, right) => right.month.localeCompare(left.month));
}

export async function setBudget(budget: Budget): Promise<Budget> {
  const budgets = await getBudgets();
  const normalizedBudget: Budget = {
    ...budget,
    subCategory: budget.category === 'Overall' ? undefined : normalizeText(budget.subCategory),
    monthlyLimit: roundMoney(budget.monthlyLimit),
    alertThresholdsTriggered: Array.isArray(budget.alertThresholdsTriggered)
      ? Array.from(new Set(budget.alertThresholdsTriggered)).sort((left, right) => left - right)
      : [],
  };

  const existingBudget = budgets.find(
    (entry) =>
      entry.id === normalizedBudget.id ||
      (
        entry.month === normalizedBudget.month &&
        entry.category === normalizedBudget.category &&
        (entry.subCategory || '') === (normalizedBudget.subCategory || '')
      )
  );

  const nextBudget = existingBudget
    ? {
        ...existingBudget,
        ...normalizedBudget,
      }
    : normalizedBudget;

  await putStoredValue<Budget>(BUDGETS_STORE, nextBudget);
  emitBudgetUpdate(existingBudget ? 'edit' : 'add', nextBudget);
  return nextBudget;
}

export async function saveBudgets(budgets: Budget[]): Promise<void> {
  for (const budget of budgets) {
    await setBudget(budget);
  }
}

export async function deleteBudget(id: string): Promise<boolean> {
  const budgets = await getBudgets();
  const exists = budgets.some((budget) => budget.id === id);
  if (!exists) {
    return false;
  }

  await deleteStoredValue(BUDGETS_STORE, id);
  emitBudgetUpdate('delete', id);
  return true;
}

export async function saveBudgetThresholdAlerts(alerts: DashboardData['budgetAlerts']): Promise<void> {
  if (alerts.length === 0) {
    return;
  }

  const mergedBudgets = mergeTriggeredBudgetThresholds(await getBudgets(), alerts);
  await saveBudgets(mergedBudgets);
}

export async function getDashboardData(): Promise<DashboardData> {
  await processRecurringTransactions();
  const [transactions, budgets, totalBalance] = await Promise.all([
    getTransactions({ includeRecurringProcessing: false }),
    getBudgets(),
    getTotalBalance(),
  ]);

  const dashboard = buildDashboardData(transactions, budgets);
  if (dashboard.budgetAlerts.length > 0) {
    await saveBudgetThresholdAlerts(dashboard.budgetAlerts);
  }

  return {
    ...dashboard,
    totalBalance,
  };
}

export async function getInsights(): Promise<DashboardData['insights']> {
  return (await getDashboardData()).insights;
}

export async function getTimelineEvents(): Promise<TimelineEvent[]> {
  const [transactions, budgets] = await Promise.all([
    getTransactions(),
    getBudgets(),
  ]);

  return generateTimelineEvents(transactions, detectSubscriptions(transactions), budgets);
}

export async function getMonthlySavingsHistory(): Promise<MonthlySavings[]> {
  const [transactions, budgets] = await Promise.all([
    getTransactions(),
    getBudgets(),
  ]);

  return computeMonthlySavingsHistory(transactions, budgets);
}

export async function getSavingsGoals(): Promise<SavingsGoal[]> {
  const goals = await getStoredValues<SavingsGoal>(SAVINGS_GOALS_STORE);
  return goals.sort((left, right) => {
    if (left.isPinned !== right.isPinned) {
      return left.isPinned ? -1 : 1;
    }

    if (left.sortOrder !== right.sortOrder) {
      return left.sortOrder - right.sortOrder;
    }

    return new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
  });
}

export async function getSavingsDeposits(): Promise<SavingsDeposit[]> {
  const deposits = await getStoredValues<SavingsDeposit>(SAVINGS_DEPOSITS_STORE);
  return deposits.sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime());
}

export async function getSavingsGoalWithDeposits(goalId: string): Promise<SavingsGoalWithDeposits> {
  const [goals, deposits] = await Promise.all([
    getSavingsGoals(),
    getSavingsDeposits(),
  ]);

  const goal = goals.find((entry) => entry.id === goalId);
  if (!goal) {
    throw new Error('Savings goal not found.');
  }

  return buildSavingsGoalWithDeposits(
    goal,
    deposits.filter((entry) => entry.goalId === goalId)
  );
}

export async function getSavingsGoalsSummary(): Promise<SavingsGoalsSummary> {
  const [goals, deposits, transactions, budgets] = await Promise.all([
    getSavingsGoals(),
    getSavingsDeposits(),
    getTransactions(),
    getBudgets(),
  ]);

  const goalDetails = goals.map((goal) =>
    buildSavingsGoalWithDeposits(
      goal,
      deposits.filter((entry) => entry.goalId === goal.id)
    )
  );

  const activeGoals = goalDetails.filter((goal) => goal.status === 'active');
  const dashboard = buildDashboardData(transactions, budgets);

  return {
    goals: goalDetails,
    totalSaved: roundMoney(activeGoals.reduce((sum, goal) => sum + goal.currentAmount, 0)),
    activeGoalCount: activeGoals.length,
    closestGoal: [...activeGoals].sort((left, right) => right.progressPercent - left.progressPercent)[0],
    nearestDeadlineGoal: [...activeGoals]
      .filter((goal) => Boolean(goal.deadline))
      .sort((left, right) => {
        const leftDate = left.deadline ? new Date(left.deadline).getTime() : Number.MAX_SAFE_INTEGER;
        const rightDate = right.deadline ? new Date(right.deadline).getTime() : Number.MAX_SAFE_INTEGER;
        return leftDate - rightDate;
      })[0],
    savingsRate: dashboard.savingsRate,
  };
}

export async function createSavingsGoal(input: SavingsGoalInput): Promise<SavingsGoal> {
  const profile = await getDeviceProfile();
  const goals = await getSavingsGoals();
  const nowIso = getNowIso();

  const goal: SavingsGoal = {
    id: uuidv4(),
    userId: buildLocalUserId(profile),
    name: input.name,
    emoji: input.emoji,
    colorAccent: input.colorAccent,
    tag: normalizeText(input.tag),
    motivationNote: normalizeText(input.motivationNote),
    targetAmount: roundMoney(input.targetAmount),
    currentAmount: 0,
    deadline: normalizeDateOnly(input.deadline) ?? undefined,
    isPrivate: Boolean(input.isPrivate),
    isPinned: Boolean(input.isPinned),
    sortOrder: goals.length,
    status: 'active',
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  await putStoredValue<SavingsGoal>(SAVINGS_GOALS_STORE, goal);
  emitTransactionUpdate('edit', { scope: 'savings-goals' });
  return goal;
}

export async function updateSavingsGoal(
  goalId: string,
  updates: Partial<SavingsGoalInput> & {
    status?: SavingsGoalStatus;
    completedAt?: string;
    whatDidYouBuy?: string;
    sortOrder?: number;
    isPinned?: boolean;
    isPrivate?: boolean;
  }
): Promise<SavingsGoal> {
  const goals = await getSavingsGoals();
  const goal = goals.find((entry) => entry.id === goalId);
  if (!goal) {
    throw new Error('Savings goal not found.');
  }

  const nextGoal: SavingsGoal = {
    ...goal,
    name: Object.prototype.hasOwnProperty.call(updates, 'name') ? updates.name ?? goal.name : goal.name,
    emoji: Object.prototype.hasOwnProperty.call(updates, 'emoji') ? updates.emoji ?? goal.emoji : goal.emoji,
    colorAccent: Object.prototype.hasOwnProperty.call(updates, 'colorAccent')
      ? updates.colorAccent ?? goal.colorAccent
      : goal.colorAccent,
    tag: Object.prototype.hasOwnProperty.call(updates, 'tag')
      ? normalizeText(updates.tag)
      : goal.tag,
    motivationNote: Object.prototype.hasOwnProperty.call(updates, 'motivationNote')
      ? normalizeText(updates.motivationNote)
      : goal.motivationNote,
    targetAmount:
      typeof updates.targetAmount === 'number'
        ? roundMoney(updates.targetAmount)
        : goal.targetAmount,
    deadline: Object.prototype.hasOwnProperty.call(updates, 'deadline')
      ? normalizeDateOnly(updates.deadline) ?? undefined
      : goal.deadline,
    status: updates.status ?? goal.status,
    completedAt: Object.prototype.hasOwnProperty.call(updates, 'completedAt')
      ? updates.completedAt
      : goal.completedAt,
    whatDidYouBuy: Object.prototype.hasOwnProperty.call(updates, 'whatDidYouBuy')
      ? updates.whatDidYouBuy
      : goal.whatDidYouBuy,
    sortOrder: typeof updates.sortOrder === 'number' ? updates.sortOrder : goal.sortOrder,
    isPinned: Object.prototype.hasOwnProperty.call(updates, 'isPinned')
      ? Boolean(updates.isPinned)
      : goal.isPinned,
    isPrivate: Object.prototype.hasOwnProperty.call(updates, 'isPrivate')
      ? Boolean(updates.isPrivate)
      : goal.isPrivate,
    updatedAt: getNowIso(),
  };

  await putStoredValue<SavingsGoal>(SAVINGS_GOALS_STORE, nextGoal);
  emitTransactionUpdate('edit', { scope: 'savings-goals' });
  return nextGoal;
}

export async function deleteSavingsGoal(goalId: string): Promise<void> {
  const deposits = await getSavingsDeposits();
  await Promise.all(
    deposits
      .filter((deposit) => deposit.goalId === goalId)
      .map((deposit) => deleteStoredValue(SAVINGS_DEPOSITS_STORE, deposit.id))
  );

  await deleteStoredValue(SAVINGS_GOALS_STORE, goalId);
  emitTransactionUpdate('edit', { scope: 'savings-goals' });
}

export async function addSavingsDeposit(input: SavingsDepositInput): Promise<SavingsDeposit> {
  const [goals, profile] = await Promise.all([getSavingsGoals(), getDeviceProfile()]);
  const goal = goals.find((entry) => entry.id === input.goalId);
  if (!goal) {
    throw new Error('Savings goal not found.');
  }

  const deposit: SavingsDeposit = {
    id: uuidv4(),
    goalId: input.goalId,
    userId: buildLocalUserId(profile),
    amount: roundMoney(input.amount),
    type: input.type,
    note: normalizeText(input.note),
    createdAt: getNowIso(),
  };

  const nextAmount = input.type === 'withdrawal'
    ? Math.max(0, goal.currentAmount - input.amount)
    : goal.currentAmount + input.amount;
  const nextStatus: SavingsGoalStatus = nextAmount >= goal.targetAmount ? 'completed' : goal.status;

  await putStoredValue<SavingsDeposit>(SAVINGS_DEPOSITS_STORE, deposit);
  await putStoredValue<SavingsGoal>(SAVINGS_GOALS_STORE, {
    ...goal,
    currentAmount: roundMoney(nextAmount),
    status: nextStatus,
    completedAt: nextStatus === 'completed' ? getNowIso() : goal.completedAt,
    updatedAt: getNowIso(),
  });

  await createTransaction({
    amount: roundMoney(input.amount),
    type: 'savings',
    category: 'Miscellaneous',
    merchant: goal.name,
    description: input.type === 'deposit' ? `Saved to ${goal.name}` : `Withdrew from ${goal.name}`,
    date: getNowIso(),
    paymentMethod: 'Other',
    notes: input.note,
    accountId: undefined,
    metadata: undefined,
  });

  return deposit;
}

export async function getDebts(status?: Debt['status']): Promise<Debt[]> {
  const debts = await getStoredValues<Debt>(DEBTS_STORE);
  return debts
    .filter((debt) => !status || debt.status === status)
    .sort((left, right) => {
      if (left.status !== right.status) {
        return left.status.localeCompare(right.status);
      }
      return new Date(right.date).getTime() - new Date(left.date).getTime();
    });
}

export async function createDebt(input: DebtInput): Promise<Debt> {
  const profile = await getDeviceProfile();
  const nowIso = getNowIso();

  const debt: Debt = {
    id: uuidv4(),
    userId: buildLocalUserId(profile),
    direction: input.direction,
    personName: input.personName,
    amount: roundMoney(input.amount),
    reason: input.reason,
    date: normalizeDateOnly(input.date) ?? nowIso.split('T')[0],
    status: 'active',
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  await putStoredValue<Debt>(DEBTS_STORE, debt);
  emitTransactionUpdate('edit', { scope: 'debts' });
  return debt;
}

export async function updateDebt(
  id: string,
  updates: {
    personName?: string;
    reason?: string;
    amount?: number;
    date?: string;
    status?: Debt['status'];
  }
): Promise<Debt | null> {
  const debts = await getDebts();
  const debt = debts.find((entry) => entry.id === id);
  if (!debt) {
    return null;
  }

  const nextDebt: Debt = {
    ...debt,
    personName: updates.personName ?? debt.personName,
    reason: updates.reason ?? debt.reason,
    amount: typeof updates.amount === 'number' ? roundMoney(updates.amount) : debt.amount,
    date: normalizeDateOnly(updates.date) ?? debt.date,
    status: updates.status ?? debt.status,
    settledAt:
      updates.status === 'settled'
        ? getNowIso()
        : updates.status === 'active'
          ? undefined
          : debt.settledAt,
    updatedAt: getNowIso(),
  };

  await putStoredValue<Debt>(DEBTS_STORE, nextDebt);
  emitTransactionUpdate('edit', { scope: 'debts' });
  return nextDebt;
}

export async function settleDebt(id: string): Promise<Debt | null> {
  return updateDebt(id, { status: 'settled' });
}

export async function deleteDebt(id: string): Promise<boolean> {
  const debts = await getDebts();
  const exists = debts.some((debt) => debt.id === id);
  if (!exists) {
    return false;
  }

  await deleteStoredValue(DEBTS_STORE, id);
  emitTransactionUpdate('edit', { scope: 'debts' });
  return true;
}

export async function savePendingTransaction(transaction: Transaction): Promise<void> {
  await storeTransaction(transaction, 'add');
}

export async function getPendingTransactions(): Promise<Transaction[]> {
  const records = await getStoredRecords<Transaction>(TRANSACTIONS_STORE);
  return records
    .filter((record) => record.meta.syncStatus === 'pending_upload')
    .map(withTransactionSyncState)
    .sort((left, right) => new Date(right.date).getTime() - new Date(left.date).getTime());
}

export async function removePendingTransaction(id: string): Promise<void> {
  await deleteStoredValue(TRANSACTIONS_STORE, id);
}

export async function clearPendingTransactions(): Promise<void> {
  const pendingTransactions = await getPendingTransactions();
  await Promise.all(pendingTransactions.map((transaction) => deleteStoredValue(TRANSACTIONS_STORE, transaction.id)));
}

export async function syncPendingTransactions(): Promise<{ synced: number }> {
  return { synced: 0 };
}