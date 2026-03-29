import type {
  Account,
  Budget,
  Debt,
  PaymentMethod,
  SavingsDeposit,
  SavingsGoal,
  Transaction,
} from './types';
import type { AuthSessionResponse } from './auth-contract';

export const DEFAULT_DEVICE_CURRENCY = 'PHP';

export const SUPPORTED_DEVICE_CURRENCIES = [
  'PHP',
  'USD',
  'EUR',
  'GBP',
  'JPY',
  'SGD',
] as const;

export type SupportedDeviceCurrency = (typeof SUPPORTED_DEVICE_CURRENCIES)[number];

export type StorageSyncMode = 'local_only' | 'sync_ready' | 'syncing';

export interface DeviceProfile {
  id: string;
  deviceId: string;
  displayName: string;
  currency: string;
  onboardingComplete: boolean;
  defaultAccountId?: string;
  defaultBudgetAmount?: number;
  cloudLinkedUserId?: string | null;
  createdAt: string;
  updatedAt: string;
  lastSyncedAt?: string | null;
}

export interface LocalUserSettings {
  nextPayday: string | null;
}

export interface LocalRecordMeta {
  localUpdatedAt: string;
  syncStatus: 'local_only' | 'pending_upload' | 'synced';
  source: 'device' | 'cloud';
}

export interface LocalAppSnapshotSummary {
  accountCount: number;
  transactionCount: number;
  budgetCount: number;
  savingsGoalCount: number;
  savingsDepositCount: number;
  debtCount: number;
  includes: string[];
}

export interface LocalAppSnapshot {
  version: number;
  exportedAt: string;
  deviceProfile: DeviceProfile | null;
  userSettings: LocalUserSettings;
  accounts: Account[];
  transactions: Transaction[];
  budgets: Budget[];
  savingsGoals: SavingsGoal[];
  savingsDeposits: SavingsDeposit[];
  debts: Debt[];
  summary?: LocalAppSnapshotSummary;
}

export interface CloudSyncStatus {
  hasBackup: boolean;
  hasLegacyData: boolean;
  hasCloudData: boolean;
  lastUpdatedAt: string | null;
}

export interface LocalOnboardingInput {
  displayName: string;
  currency: string;
  startingAccountName?: string;
  startingBalance?: number;
  monthlyBudget?: number;
}

export const EMPTY_LOCAL_USER_SETTINGS: LocalUserSettings = {
  nextPayday: null,
};

export function deriveStorageSyncMode(params: {
  authSession: AuthSessionResponse;
  deviceProfile: DeviceProfile | null;
  syncing?: boolean;
}): StorageSyncMode {
  const { authSession, deviceProfile, syncing = false } = params;

  if (syncing) {
    return 'syncing';
  }

  if (
    authSession.authenticated &&
    authSession.user &&
    deviceProfile?.cloudLinkedUserId === authSession.user.id
  ) {
    return 'sync_ready';
  }

  return 'local_only';
}

export function getDeviceStorageCopy(mode: StorageSyncMode): string {
  if (mode === 'sync_ready') {
    return 'Backed up and syncing';
  }

  if (mode === 'syncing') {
    return 'Syncing your device backup';
  }

  return 'Stored only on this device';
}

export function createDisplayNameFromSession(session: AuthSessionResponse): string {
  if (session.user?.fullName?.trim()) {
    return session.user.fullName.trim();
  }

  if (session.user?.email) {
    const [emailName] = session.user.email.split('@');
    if (emailName?.trim()) {
      return emailName.trim();
    }
  }

  return 'Moneda user';
}

export function getLocalAppSnapshotSummary(
  snapshot: Pick<
    LocalAppSnapshot,
    | 'accounts'
    | 'transactions'
    | 'budgets'
    | 'savingsGoals'
    | 'savingsDeposits'
    | 'debts'
    | 'summary'
  >,
): LocalAppSnapshotSummary {
  const defaultIncludes = [
    'device profile',
    'user settings',
    'accounts',
    'transactions',
    'budgets',
    'savings goals',
    'savings deposits',
    'debts',
  ];

  return {
    accountCount: snapshot.summary?.accountCount ?? snapshot.accounts.length,
    transactionCount: snapshot.summary?.transactionCount ?? snapshot.transactions.length,
    budgetCount: snapshot.summary?.budgetCount ?? snapshot.budgets.length,
    savingsGoalCount: snapshot.summary?.savingsGoalCount ?? snapshot.savingsGoals.length,
    savingsDepositCount: snapshot.summary?.savingsDepositCount ?? snapshot.savingsDeposits.length,
    debtCount: snapshot.summary?.debtCount ?? snapshot.debts.length,
    includes:
      snapshot.summary?.includes && snapshot.summary.includes.length > 0
        ? snapshot.summary.includes
        : defaultIncludes,
  };
}

export function isLocalAppSnapshot(value: unknown): value is LocalAppSnapshot {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.version === 'number' &&
    typeof candidate.exportedAt === 'string' &&
    Array.isArray(candidate.accounts) &&
    Array.isArray(candidate.transactions) &&
    Array.isArray(candidate.budgets) &&
    Array.isArray(candidate.savingsGoals) &&
    Array.isArray(candidate.savingsDeposits) &&
    Array.isArray(candidate.debts) &&
    candidate.userSettings !== null &&
    typeof candidate.userSettings === 'object'
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeUserSettings(value: unknown): LocalUserSettings {
  if (!isRecord(value)) {
    return EMPTY_LOCAL_USER_SETTINGS;
  }

  return {
    nextPayday: typeof value.nextPayday === 'string' ? value.nextPayday : null,
  };
}

function normalizeTransactions(value: unknown): Transaction[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const transactions: Transaction[] = [];

  for (const entry of value) {
    if (!isRecord(entry)) {
      return null;
    }

    if (
      typeof entry.id !== 'string' ||
      typeof entry.amount !== 'number' ||
      typeof entry.category !== 'string' ||
      typeof entry.date !== 'string' ||
      typeof entry.paymentMethod !== 'string'
    ) {
      return null;
    }

    const createdAt = typeof entry.createdAt === 'string' ? entry.createdAt : entry.date;
    const updatedAt = typeof entry.updatedAt === 'string' ? entry.updatedAt : createdAt;
    const tags = Array.isArray(entry.tags)
      ? entry.tags.filter((tag): tag is string => typeof tag === 'string')
      : [];

    transactions.push({
      ...entry,
      id: entry.id,
      amount: entry.amount,
      type:
        entry.type === 'income' || entry.type === 'savings'
          ? entry.type
          : 'expense',
      category: entry.category as Transaction['category'],
      date: entry.date,
      paymentMethod: entry.paymentMethod as PaymentMethod,
      createdAt,
      updatedAt,
      tags,
    } as Transaction);
  }

  return transactions;
}

function normalizeBudgets(value: unknown): Budget[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const budgets: Budget[] = [];

  for (const entry of value) {
    if (!isRecord(entry)) {
      return null;
    }

    if (
      typeof entry.id !== 'string' ||
      typeof entry.category !== 'string' ||
      typeof entry.monthlyLimit !== 'number' ||
      typeof entry.month !== 'string'
    ) {
      return null;
    }

    budgets.push({
      ...entry,
      id: entry.id,
      category: entry.category as Budget['category'],
      monthlyLimit: entry.monthlyLimit,
      month: entry.month,
    } as Budget);
  }

  return budgets;
}

export function parseImportedLocalSnapshot(value: unknown): LocalAppSnapshot | null {
  if (isLocalAppSnapshot(value)) {
    return {
      ...value,
      summary: getLocalAppSnapshotSummary(value),
    };
  }

  const exportedAt = new Date().toISOString();

  if (Array.isArray(value)) {
    const transactions = normalizeTransactions(value);
    if (!transactions) {
      return null;
    }

    const snapshot: LocalAppSnapshot = {
      version: 1,
      exportedAt,
      deviceProfile: null,
      userSettings: EMPTY_LOCAL_USER_SETTINGS,
      accounts: [],
      transactions,
      budgets: [],
      savingsGoals: [],
      savingsDeposits: [],
      debts: [],
    };

    return {
      ...snapshot,
      summary: getLocalAppSnapshotSummary(snapshot),
    };
  }

  if (!isRecord(value)) {
    return null;
  }

  const transactions =
    value.transactions === undefined ? [] : normalizeTransactions(value.transactions);
  const budgets = value.budgets === undefined ? [] : normalizeBudgets(value.budgets);

  if (!transactions || !budgets) {
    return null;
  }

  const hasSupportedPayload =
    Array.isArray(value.transactions) ||
    Array.isArray(value.budgets) ||
    Array.isArray(value.accounts) ||
    Array.isArray(value.savingsGoals) ||
    Array.isArray(value.savingsDeposits) ||
    Array.isArray(value.debts);

  if (!hasSupportedPayload) {
    return null;
  }

  const snapshot: LocalAppSnapshot = {
    version: typeof value.version === 'number' ? value.version : 1,
    exportedAt: typeof value.exportedAt === 'string' ? value.exportedAt : exportedAt,
    deviceProfile: isRecord(value.deviceProfile) ? (value.deviceProfile as DeviceProfile) : null,
    userSettings: normalizeUserSettings(value.userSettings),
    accounts: Array.isArray(value.accounts) ? (value.accounts as Account[]) : [],
    transactions,
    budgets,
    savingsGoals: Array.isArray(value.savingsGoals) ? (value.savingsGoals as SavingsGoal[]) : [],
    savingsDeposits: Array.isArray(value.savingsDeposits)
      ? (value.savingsDeposits as SavingsDeposit[])
      : [],
    debts: Array.isArray(value.debts) ? (value.debts as Debt[]) : [],
  };

  return {
    ...snapshot,
    summary: getLocalAppSnapshotSummary(snapshot),
  };
}