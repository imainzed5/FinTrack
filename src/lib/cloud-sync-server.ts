import type { SupabaseClient, User } from '@supabase/supabase-js';
import {
  getAccounts,
  getBudgets,
  getSavingsGoalWithDeposits,
  getSavingsGoals,
  getTransactions,
} from './db';
import { getDebts } from './debts';
import {
  DEFAULT_DEVICE_CURRENCY,
  EMPTY_LOCAL_USER_SETTINGS,
  type CloudSyncIssueCode,
  type CloudSyncStatus,
  type DeviceProfile,
  type LocalAppSnapshot,
} from './local-first';
import { deriveSupabaseUserDisplayName } from './supabase/user-profile';
import { requireSupabaseUser } from './supabase/server';

interface CloudBackupRow {
  user_id: string;
  snapshot: LocalAppSnapshot;
  created_at: string;
  updated_at: string;
}

interface ReadStoredBackupResult {
  row: CloudBackupRow | null;
  backupStorageAvailable: boolean;
  issueCode: CloudSyncIssueCode | null;
  issueMessage: string | null;
}

const MISSING_BACKUP_STORAGE_MESSAGE =
  'Cloud backup is unavailable because the backup storage table is not installed yet. Run the latest Supabase migrations and try again.';

export class CloudBackupUnavailableError extends Error {
  readonly code: CloudSyncIssueCode;

  constructor(message = MISSING_BACKUP_STORAGE_MESSAGE) {
    super(message);
    this.name = 'CloudBackupUnavailableError';
    this.code = 'missing_backup_storage';
  }
}

export function isCloudBackupUnavailableError(error: unknown): error is CloudBackupUnavailableError {
  return error instanceof CloudBackupUnavailableError;
}

function isMissingBackupTable(
  error: { code?: string; message?: string; details?: string; hint?: string } | null,
): boolean {
  if (!error) {
    return false;
  }

  return (
    error.code === '42P01' ||
    Boolean(error.message?.includes('user_device_backups')) ||
    Boolean(error.details?.includes('user_device_backups')) ||
    Boolean(error.hint?.includes('user_device_backups'))
  );
}

function hasSnapshotData(snapshot: LocalAppSnapshot): boolean {
  return Boolean(
    snapshot.accounts.length ||
    snapshot.transactions.length ||
    snapshot.budgets.length ||
    snapshot.savingsGoals.length ||
    snapshot.savingsDeposits.length ||
    snapshot.debts.length ||
    snapshot.userSettings.nextPayday
  );
}

async function loadProfileFields(
  supabase: SupabaseClient,
  userId: string
): Promise<{ displayName: string | null; nextPayday: string | null }> {
  const { data, error } = await supabase
    .from('profiles')
    .select('display_name, next_payday')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    return { displayName: null, nextPayday: null };
  }

  const record = (data as Record<string, unknown> | null) ?? null;
  return {
    displayName:
      record && typeof record.display_name === 'string' ? record.display_name : null,
    nextPayday:
      record && typeof record.next_payday === 'string' ? record.next_payday : null,
  };
}

async function readStoredBackup(
  supabase: SupabaseClient,
  userId: string
): Promise<ReadStoredBackupResult> {
  const { data, error } = await supabase
    .from('user_device_backups')
    .select('user_id, snapshot, created_at, updated_at')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    if (isMissingBackupTable(error)) {
      return {
        row: null,
        backupStorageAvailable: false,
        issueCode: 'missing_backup_storage',
        issueMessage: MISSING_BACKUP_STORAGE_MESSAGE,
      };
    }

    throw new Error(`Failed to load device backup: ${error.message}`);
  }

  return {
    row: (data as CloudBackupRow | null) ?? null,
    backupStorageAvailable: true,
    issueCode: null,
    issueMessage: null,
  };
}

async function buildLegacySnapshot(user: User, supabase: SupabaseClient): Promise<LocalAppSnapshot> {
  const [accounts, transactions, budgets, savingsGoals, debts, profileFields] = await Promise.all([
    getAccounts({ includeArchived: true }),
    getTransactions(),
    getBudgets(),
    getSavingsGoals(),
    getDebts(),
    loadProfileFields(supabase, user.id),
  ]);

  const goalDetails = await Promise.all(
    savingsGoals.map((goal) => getSavingsGoalWithDeposits(goal.id))
  );

  const deviceProfile: DeviceProfile = {
    id: user.id,
    deviceId: user.id,
    displayName: deriveSupabaseUserDisplayName(user, profileFields.displayName),
    currency: DEFAULT_DEVICE_CURRENCY,
    onboardingComplete: true,
    cloudLinkedUserId: user.id,
    createdAt: typeof user.created_at === 'string' ? user.created_at : new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastSyncedAt: new Date().toISOString(),
  };

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    deviceProfile,
    userSettings: {
      ...EMPTY_LOCAL_USER_SETTINGS,
      nextPayday: profileFields.nextPayday,
    },
    accounts,
    transactions,
    budgets,
    savingsGoals,
    savingsDeposits: goalDetails.flatMap((goal) => goal.deposits),
    debts,
  };
}

export async function getCloudSyncStatus(): Promise<CloudSyncStatus> {
  const { supabase, user } = await requireSupabaseUser();
  const storedBackup = await readStoredBackup(supabase, user.id);

  if (storedBackup.row?.snapshot) {
    return {
      hasBackup: true,
      hasLegacyData: false,
      hasCloudData: true,
      lastUpdatedAt: storedBackup.row.updated_at ?? null,
      backupStorageAvailable: storedBackup.backupStorageAvailable,
      issueCode: storedBackup.issueCode,
      issueMessage: storedBackup.issueMessage,
    };
  }

  const legacySnapshot = await buildLegacySnapshot(user, supabase);
  return {
    hasBackup: false,
    hasLegacyData: hasSnapshotData(legacySnapshot),
    hasCloudData: hasSnapshotData(legacySnapshot),
    lastUpdatedAt: null,
    backupStorageAvailable: storedBackup.backupStorageAvailable,
    issueCode: storedBackup.issueCode,
    issueMessage: storedBackup.issueMessage,
  };
}

export async function getCloudSnapshot(): Promise<LocalAppSnapshot> {
  const { supabase, user } = await requireSupabaseUser();
  const storedBackup = await readStoredBackup(supabase, user.id);

  if (storedBackup.row?.snapshot) {
    return storedBackup.row.snapshot;
  }

  return buildLegacySnapshot(user, supabase);
}

export async function saveCloudSnapshot(snapshot: LocalAppSnapshot): Promise<void> {
  const { supabase, user } = await requireSupabaseUser();

  const { error } = await supabase.from('user_device_backups').upsert(
    {
      user_id: user.id,
      snapshot,
    },
    { onConflict: 'user_id' }
  );

  if (error) {
    if (isMissingBackupTable(error)) {
      throw new CloudBackupUnavailableError();
    }

    throw new Error(`Failed to save device backup: ${error.message}`);
  }
}