import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveStorageSyncMode, getDeviceStorageCopy, type CloudSyncStatus } from './local-first';
import type { AuthSessionResponse } from './auth-contract';

const AUTH_SESSION: AuthSessionResponse = {
  authenticated: true,
  rememberMe: false,
  user: {
    id: 'user-1',
    email: 'user@example.com',
    fullName: 'Moneda User',
  },
};

const READY_STATUS: CloudSyncStatus = {
  hasBackup: true,
  hasLegacyData: false,
  hasCloudData: true,
  lastUpdatedAt: new Date().toISOString(),
  backupStorageAvailable: true,
  issueCode: null,
  issueMessage: null,
};

test('deriveStorageSyncMode returns backup_unavailable when linked account cannot write backups', () => {
  const mode = deriveStorageSyncMode({
    authSession: AUTH_SESSION,
    deviceProfile: {
      id: 'device-1',
      deviceId: 'device-1',
      displayName: 'Local device',
      currency: 'PHP',
      onboardingComplete: true,
      cloudLinkedUserId: 'user-1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastSyncedAt: null,
    },
    cloudSyncStatus: {
      ...READY_STATUS,
      hasBackup: false,
      lastUpdatedAt: null,
      backupStorageAvailable: false,
      issueCode: 'missing_backup_storage',
      issueMessage: 'Cloud backup is unavailable.',
    },
  });

  assert.equal(mode, 'backup_unavailable');
});

test('deriveStorageSyncMode returns sync_ready when linked account has healthy backup status', () => {
  const mode = deriveStorageSyncMode({
    authSession: AUTH_SESSION,
    deviceProfile: {
      id: 'device-1',
      deviceId: 'device-1',
      displayName: 'Local device',
      currency: 'PHP',
      onboardingComplete: true,
      cloudLinkedUserId: 'user-1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastSyncedAt: null,
    },
    cloudSyncStatus: READY_STATUS,
  });

  assert.equal(mode, 'sync_ready');
});

test('getDeviceStorageCopy returns readable copy for unavailable backup mode', () => {
  assert.equal(getDeviceStorageCopy('backup_unavailable'), 'Backup unavailable');
});