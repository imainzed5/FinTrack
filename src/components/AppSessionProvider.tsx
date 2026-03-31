'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { AuthSessionResponse } from '@/lib/auth-contract';
import CloudSyncDecisionDialog from '@/components/CloudSyncDecisionDialog';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import {
  deriveStorageSyncMode,
  getDeviceStorageCopy,
  isTimestampNewer,
  type CloudSyncStatus,
  type DeviceProfile,
  type LocalAppSnapshot,
  type LocalOnboardingInput,
  type StorageSyncMode,
} from '@/lib/local-first';
import {
  clearLocalAppData,
  completeLocalOnboarding,
  exportLocalSnapshot,
  getDeviceProfile,
  getPendingSyncCount,
  hasLocalAppData,
  markLocalSnapshotSynced,
  replaceLocalSnapshot,
  seedDeviceProfileFromAuth,
} from '@/lib/local-store';
import { isSyncStateRealtimeUpdate, subscribeAppUpdates } from '@/lib/transaction-ws';

const EMPTY_SESSION: AuthSessionResponse = {
  authenticated: false,
  rememberMe: false,
  user: null,
};

interface ViewerIdentity {
  id: string;
  displayName: string;
  email: string | null;
  authenticated: boolean;
  storageCopy: string;
}

interface AppSessionContextValue {
  booting: boolean;
  syncing: boolean;
  authSession: AuthSessionResponse;
  deviceProfile: DeviceProfile | null;
  cloudSyncStatus: CloudSyncStatus | null;
  cloudSyncError: string | null;
  storageMode: StorageSyncMode;
  hasDeviceProfile: boolean;
  onboardingComplete: boolean;
  canAccessApp: boolean;
  pendingSyncCount: number;
  viewer: ViewerIdentity;
  completeOnboarding: (input: LocalOnboardingInput) => Promise<void>;
  clearLocalData: () => Promise<void>;
  refreshSession: () => Promise<void>;
  handleLoggedOut: () => Promise<void>;
  triggerCloudSync: (options?: { quiet?: boolean }) => Promise<void>;
}

interface AuthSessionFetchResult {
  session: AuthSessionResponse;
  resolved: boolean;
}

const AppSessionContext = createContext<AppSessionContextValue | null>(null);

async function readResponseErrorMessage(
  response: Response,
  fallbackMessage: string,
): Promise<string> {
  const payload = (await response.json().catch(() => null)) as { error?: unknown } | null;
  return typeof payload?.error === 'string' ? payload.error : fallbackMessage;
}

async function fetchAuthSession(): Promise<AuthSessionFetchResult> {
  try {
    const response = await fetch('/api/auth/session', {
      method: 'GET',
      cache: 'no-store',
      credentials: 'include',
    });

    const data = (await response.json().catch(() => null)) as AuthSessionResponse | null;
    if (!response.ok || !data) {
      return {
        session: EMPTY_SESSION,
        resolved: false,
      };
    }

    return {
      session: data,
      resolved: true,
    };
  } catch {
    return {
      session: EMPTY_SESSION,
      resolved: false,
    };
  }
}

async function fetchCloudSyncStatus(): Promise<CloudSyncStatus | null> {
  try {
    const response = await fetch('/api/cloud-sync/status', {
      method: 'GET',
      cache: 'no-store',
      credentials: 'include',
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as CloudSyncStatus;
  } catch {
    return null;
  }
}

async function fetchCloudSnapshot(): Promise<LocalAppSnapshot> {
  const response = await fetch('/api/cloud-sync/backup', {
    method: 'GET',
    cache: 'no-store',
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(await readResponseErrorMessage(response, 'Failed to load cloud backup.'));
  }

  return (await response.json()) as LocalAppSnapshot;
}

async function uploadSnapshotToCloud(snapshot: LocalAppSnapshot): Promise<void> {
  const response = await fetch('/api/cloud-sync/backup', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(snapshot),
  });

  if (!response.ok) {
    throw new Error(await readResponseErrorMessage(response, 'Failed to upload cloud backup.'));
  }
}

function getViewerIdentity(
  authSession: AuthSessionResponse,
  deviceProfile: DeviceProfile | null,
  storageMode: StorageSyncMode
): ViewerIdentity {
  const displayName =
    deviceProfile?.displayName ||
    authSession.user?.fullName ||
    authSession.user?.email?.split('@')[0] ||
    'Moneda';

  return {
    id: deviceProfile?.id || authSession.user?.id || 'local-device',
    displayName,
    email: authSession.user?.email ?? null,
    authenticated: authSession.authenticated,
    storageCopy: getDeviceStorageCopy(storageMode),
  };
}

export function AppSessionProvider({ children }: { children: React.ReactNode }) {
  const [booting, setBooting] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [authSession, setAuthSession] = useState<AuthSessionResponse>(EMPTY_SESSION);
  const [deviceProfile, setDeviceProfile] = useState<DeviceProfile | null>(null);
  const [cloudSyncStatus, setCloudSyncStatus] = useState<CloudSyncStatus | null>(null);
  const [cloudSyncError, setCloudSyncError] = useState<string | null>(null);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [conflictOpen, setConflictOpen] = useState(false);
  const syncTimerRef = useRef<number | null>(null);
  const suppressAutoSyncUntilRef = useRef(0);
  const suppressCloudPullUntilRef = useRef(0);
  const cloudRefreshInFlightRef = useRef(false);
  const lastCloudRefreshAttemptAtRef = useRef(0);

  const storageMode = useMemo(
    () => deriveStorageSyncMode({ authSession, deviceProfile, cloudSyncStatus, syncing }),
    [authSession, cloudSyncStatus, deviceProfile, syncing]
  );

  const refreshPendingSyncCount = useCallback(async () => {
    setPendingSyncCount(await getPendingSyncCount());
  }, []);

  const suppressAutoSyncForCloudRestore = useCallback(() => {
    suppressAutoSyncUntilRef.current = Date.now() + 2500;
  }, []);

  const suppressCloudPullForLocalWrite = useCallback(() => {
    suppressCloudPullUntilRef.current = Date.now() + 3000;
  }, []);

  const purgeAccountLinkedDeviceData = useCallback(
    async (profileOverride?: DeviceProfile | null): Promise<DeviceProfile | null> => {
      const profile = profileOverride ?? await getDeviceProfile();
      if (!profile?.cloudLinkedUserId) {
        return profile ?? null;
      }

      await clearLocalAppData();
      return null;
    },
    [],
  );

  const applyCloudSnapshotToDevice = useCallback(
    async (
      snapshot: LocalAppSnapshot,
      userId: string,
      options: { preserveDeviceIdentity?: boolean } = {},
    ): Promise<DeviceProfile | null> => {
      suppressAutoSyncForCloudRestore();

      const profile = await replaceLocalSnapshot(snapshot, {
        preserveDeviceIdentity: options.preserveDeviceIdentity ?? true,
        linkedCloudUserId: userId,
        source: 'cloud',
      });

      setDeviceProfile(profile);
      await refreshPendingSyncCount();
      return profile;
    },
    [refreshPendingSyncCount, suppressAutoSyncForCloudRestore],
  );

  const refreshFromCloudIfNeeded = useCallback(
    async (options: { force?: boolean } = {}): Promise<boolean> => {
      if (!authSession.authenticated || !authSession.user || conflictOpen) {
        return false;
      }

      const profile = await getDeviceProfile();
      if (!profile || profile.cloudLinkedUserId !== authSession.user.id) {
        return false;
      }

      const cloudStatus = await fetchCloudSyncStatus();
      setCloudSyncStatus(cloudStatus);
      setCloudSyncError(cloudStatus?.issueMessage ?? null);

      if (!cloudStatus?.hasCloudData || cloudStatus.backupStorageAvailable === false) {
        return false;
      }

      const localPendingSyncCount = await getPendingSyncCount();
      if (!options.force && localPendingSyncCount > 0) {
        return false;
      }

      if (!options.force && !isTimestampNewer(cloudStatus.lastUpdatedAt, profile.lastSyncedAt)) {
        return false;
      }

      const cloudSnapshot = await fetchCloudSnapshot();
      await applyCloudSnapshotToDevice(cloudSnapshot, authSession.user.id, {
        preserveDeviceIdentity: true,
      });
      return true;
    },
    [applyCloudSnapshotToDevice, authSession, conflictOpen],
  );

  const requestCloudRefresh = useCallback(
    (options: { force?: boolean; minimumGapMs?: number } = {}) => {
      const minimumGapMs = options.minimumGapMs ?? 0;
      const now = Date.now();

      if (cloudRefreshInFlightRef.current) {
        return;
      }

      if (!options.force && minimumGapMs > 0) {
        const elapsed = now - lastCloudRefreshAttemptAtRef.current;
        if (elapsed < minimumGapMs) {
          return;
        }
      }

      lastCloudRefreshAttemptAtRef.current = now;
      cloudRefreshInFlightRef.current = true;

      void refreshFromCloudIfNeeded({ force: options.force })
        .catch(() => undefined)
        .finally(() => {
          cloudRefreshInFlightRef.current = false;
        });
    },
    [refreshFromCloudIfNeeded],
  );

  const syncCurrentSnapshot = useCallback(async (options: { quiet?: boolean } = {}) => {
    if (!authSession.authenticated || !authSession.user || conflictOpen) {
      return;
    }

    if (!options.quiet) {
      setSyncing(true);
    }

    try {
      setCloudSyncError(null);
      suppressCloudPullForLocalWrite();
      const snapshot = await exportLocalSnapshot();
      await uploadSnapshotToCloud(snapshot);
      const profile = await markLocalSnapshotSynced(authSession.user.id);
      setDeviceProfile(profile);
      setCloudSyncStatus(await fetchCloudSyncStatus());
      await refreshPendingSyncCount();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to upload cloud backup.';
      setCloudSyncError(message);
      throw error;
    } finally {
      if (!options.quiet) {
        setSyncing(false);
      }
    }
  }, [authSession, conflictOpen, refreshPendingSyncCount, suppressCloudPullForLocalWrite]);

  const bootstrapSession = useCallback(async () => {
    setBooting(true);

    try {
      const { session: nextAuthSession, resolved: authSessionResolved } = await fetchAuthSession();
      let nextDeviceProfile = await getDeviceProfile();
      let nextCloudSyncStatus: CloudSyncStatus | null = null;
      let nextCloudSyncError: string | null = null;
      const localDataExists = await hasLocalAppData();

      const attemptInitialBackup = async (userId: string) => {
        try {
          const snapshot = await exportLocalSnapshot();
          await uploadSnapshotToCloud(snapshot);
          nextDeviceProfile = await markLocalSnapshotSynced(userId);
          nextCloudSyncStatus = await fetchCloudSyncStatus();
          nextCloudSyncError = null;
        } catch (error) {
          nextCloudSyncError =
            error instanceof Error ? error.message : 'Failed to upload cloud backup.';
        }
      };

      if (nextAuthSession.authenticated && nextAuthSession.user) {
        const cloudStatus = await fetchCloudSyncStatus();
        nextCloudSyncStatus = cloudStatus;
        nextCloudSyncError = cloudStatus?.issueMessage ?? null;
        const backupStorageAvailable = cloudStatus?.backupStorageAvailable !== false;
        const localPendingSyncCount = await getPendingSyncCount();

        if (!nextDeviceProfile) {
          if (cloudStatus?.hasCloudData) {
            const cloudSnapshot = await fetchCloudSnapshot();
            nextDeviceProfile = await applyCloudSnapshotToDevice(
              cloudSnapshot,
              nextAuthSession.user.id,
              { preserveDeviceIdentity: false },
            );
          } else {
            nextDeviceProfile = await seedDeviceProfileFromAuth(nextAuthSession);
          }
        } else if (nextDeviceProfile.cloudLinkedUserId === nextAuthSession.user.id) {
          if (!cloudStatus?.hasCloudData && backupStorageAvailable) {
            await attemptInitialBackup(nextAuthSession.user.id);
          } else if (
            cloudStatus?.hasCloudData &&
            localPendingSyncCount === 0 &&
            isTimestampNewer(cloudStatus.lastUpdatedAt, nextDeviceProfile.lastSyncedAt)
          ) {
            const cloudSnapshot = await fetchCloudSnapshot();
            nextDeviceProfile = await applyCloudSnapshotToDevice(
              cloudSnapshot,
              nextAuthSession.user.id,
            );
          }
        } else if (localDataExists && cloudStatus?.hasCloudData) {
          setConflictOpen(true);
        } else if (cloudStatus?.hasCloudData) {
          const cloudSnapshot = await fetchCloudSnapshot();
          nextDeviceProfile = await applyCloudSnapshotToDevice(
            cloudSnapshot,
            nextAuthSession.user.id,
          );
        } else {
          if (backupStorageAvailable) {
            await attemptInitialBackup(nextAuthSession.user.id);
          } else {
            nextDeviceProfile = await seedDeviceProfileFromAuth(nextAuthSession);
          }
        }
      } else {
        if (authSessionResolved && nextDeviceProfile?.cloudLinkedUserId) {
          nextDeviceProfile = await purgeAccountLinkedDeviceData(nextDeviceProfile);
        }

        setConflictOpen(false);
      }

      setAuthSession(nextAuthSession);
      setDeviceProfile(nextDeviceProfile);
      setCloudSyncStatus(nextAuthSession.authenticated ? nextCloudSyncStatus : null);
      setCloudSyncError(nextAuthSession.authenticated ? nextCloudSyncError : null);
      await refreshPendingSyncCount();
    } finally {
      setBooting(false);
    }
  }, [applyCloudSnapshotToDevice, purgeAccountLinkedDeviceData, refreshPendingSyncCount]);

  useEffect(() => {
    void bootstrapSession();
  }, [bootstrapSession]);

  useEffect(() => {
    if (!authSession.authenticated || !authSession.user || conflictOpen) {
      return;
    }

    const scheduleSync = () => {
      if (syncTimerRef.current !== null) {
        window.clearTimeout(syncTimerRef.current);
      }

      syncTimerRef.current = window.setTimeout(() => {
        void syncCurrentSnapshot({ quiet: true }).catch(() => undefined);
      }, 1200);
    };

    const unsubscribe = subscribeAppUpdates((message) => {
      void refreshPendingSyncCount();
      if (isSyncStateRealtimeUpdate(message)) {
        return;
      }
      if (Date.now() < suppressAutoSyncUntilRef.current) {
        return;
      }
      scheduleSync();
    });

    const handleOnline = () => {
      void refreshPendingSyncCount();
      scheduleSync();
    };

    window.addEventListener('online', handleOnline);

    return () => {
      unsubscribe();
      window.removeEventListener('online', handleOnline);
      if (syncTimerRef.current !== null) {
        window.clearTimeout(syncTimerRef.current);
      }
    };
  }, [authSession, conflictOpen, refreshPendingSyncCount, syncCurrentSnapshot]);

  useEffect(() => {
    if (!authSession.authenticated || !authSession.user || conflictOpen) {
      return;
    }

    const profile = deviceProfile;
    if (!profile || profile.cloudLinkedUserId !== authSession.user.id) {
      return;
    }

    const supabase = getSupabaseBrowserClient();
    const channel = supabase
      .channel(`cloud-backup-${authSession.user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_device_backups',
          filter: `user_id=eq.${authSession.user.id}`,
        },
        () => {
          if (Date.now() < suppressCloudPullUntilRef.current) {
            return;
          }

          requestCloudRefresh({ minimumGapMs: 1000 });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [authSession, conflictOpen, deviceProfile, requestCloudRefresh]);

  useEffect(() => {
    if (!authSession.authenticated || !authSession.user || conflictOpen) {
      return;
    }

    const refreshCloudSnapshot = () => {
      requestCloudRefresh({ minimumGapMs: 5000 });
    };

    const handleFocus = () => refreshCloudSnapshot();
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        refreshCloudSnapshot();
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [authSession, conflictOpen, requestCloudRefresh]);

  const completeOnboarding = useCallback(async (input: LocalOnboardingInput) => {
    setSyncing(true);

    try {
      const profile = await completeLocalOnboarding(input, {
        linkedCloudUserId: authSession.user?.id ?? null,
      });
      setDeviceProfile(profile);

      if (authSession.authenticated && authSession.user) {
        await syncCurrentSnapshot().catch(() => undefined);
      }

      await refreshPendingSyncCount();
    } finally {
      setSyncing(false);
    }
  }, [authSession, refreshPendingSyncCount, syncCurrentSnapshot]);

  const applyCloudBackup = useCallback(async () => {
    if (!authSession.authenticated || !authSession.user) {
      return;
    }

    setSyncing(true);
    try {
      const cloudSnapshot = await fetchCloudSnapshot();
      await applyCloudSnapshotToDevice(cloudSnapshot, authSession.user.id);
      setConflictOpen(false);
    } finally {
      setSyncing(false);
    }
  }, [applyCloudSnapshotToDevice, authSession]);

  const keepDeviceData = useCallback(async () => {
    if (!authSession.authenticated || !authSession.user) {
      return;
    }

    setSyncing(true);
    try {
      await syncCurrentSnapshot();
      setConflictOpen(false);
      setDeviceProfile(await getDeviceProfile());
      await refreshPendingSyncCount();
    } finally {
      setSyncing(false);
    }
  }, [authSession, refreshPendingSyncCount, syncCurrentSnapshot]);

  const handleLoggedOut = useCallback(async () => {
    const nextDeviceProfile = await purgeAccountLinkedDeviceData();

    setAuthSession(EMPTY_SESSION);
    setDeviceProfile(nextDeviceProfile);
    setCloudSyncStatus(null);
    setCloudSyncError(null);
    setConflictOpen(false);
    await refreshPendingSyncCount();
  }, [purgeAccountLinkedDeviceData, refreshPendingSyncCount]);

  const clearLocalData = useCallback(async () => {
    setSyncing(true);

    try {
      await clearLocalAppData();
      setDeviceProfile(null);
      setConflictOpen(false);
      await refreshPendingSyncCount();
    } finally {
      setSyncing(false);
    }
  }, [refreshPendingSyncCount]);

  const contextValue = useMemo<AppSessionContextValue>(() => {
    const canAccessApp = Boolean(deviceProfile?.onboardingComplete) || authSession.authenticated;

    return {
      booting,
      syncing,
      authSession,
      deviceProfile,
      cloudSyncStatus,
      cloudSyncError,
      storageMode,
      hasDeviceProfile: Boolean(deviceProfile),
      onboardingComplete: Boolean(deviceProfile?.onboardingComplete),
      canAccessApp,
      pendingSyncCount,
      viewer: getViewerIdentity(authSession, deviceProfile, storageMode),
      completeOnboarding,
      clearLocalData,
      refreshSession: bootstrapSession,
      handleLoggedOut,
      triggerCloudSync: syncCurrentSnapshot,
    };
  }, [
    authSession,
    bootstrapSession,
    booting,
    clearLocalData,
    cloudSyncError,
    cloudSyncStatus,
    completeOnboarding,
    deviceProfile,
    handleLoggedOut,
    pendingSyncCount,
    storageMode,
    syncCurrentSnapshot,
    syncing,
  ]);

  return (
    <AppSessionContext.Provider value={contextValue}>
      {children}
      <CloudSyncDecisionDialog
        open={conflictOpen}
        loading={syncing}
        onKeepDeviceData={() => {
          void keepDeviceData();
        }}
        onUseCloudBackup={() => {
          void applyCloudBackup();
        }}
      />
    </AppSessionContext.Provider>
  );
}

export function useAppSession(): AppSessionContextValue {
  const context = useContext(AppSessionContext);
  if (!context) {
    throw new Error('useAppSession must be used inside AppSessionProvider.');
  }

  return context;
}