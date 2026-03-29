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
import {
  deriveStorageSyncMode,
  getDeviceStorageCopy,
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
import { subscribeAppUpdates } from '@/lib/transaction-ws';

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
  storageMode: StorageSyncMode;
  hasDeviceProfile: boolean;
  onboardingComplete: boolean;
  canAccessApp: boolean;
  pendingSyncCount: number;
  viewer: ViewerIdentity;
  completeOnboarding: (input: LocalOnboardingInput) => Promise<void>;
  clearLocalData: () => Promise<void>;
  refreshSession: () => Promise<void>;
  handleLoggedOut: () => void;
  triggerCloudSync: (options?: { quiet?: boolean }) => Promise<void>;
}

const AppSessionContext = createContext<AppSessionContextValue | null>(null);

async function fetchAuthSession(): Promise<AuthSessionResponse> {
  try {
    const response = await fetch('/api/auth/session', {
      method: 'GET',
      cache: 'no-store',
      credentials: 'include',
    });

    const data = (await response.json().catch(() => null)) as AuthSessionResponse | null;
    if (!response.ok || !data) {
      return EMPTY_SESSION;
    }

    return data;
  } catch {
    return EMPTY_SESSION;
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
    throw new Error('Failed to load cloud backup.');
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
    throw new Error('Failed to upload cloud backup.');
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
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [conflictOpen, setConflictOpen] = useState(false);
  const syncTimerRef = useRef<number | null>(null);

  const storageMode = useMemo(
    () => deriveStorageSyncMode({ authSession, deviceProfile, syncing }),
    [authSession, deviceProfile, syncing]
  );

  const refreshPendingSyncCount = useCallback(async () => {
    setPendingSyncCount(await getPendingSyncCount());
  }, []);

  const syncCurrentSnapshot = useCallback(async (options: { quiet?: boolean } = {}) => {
    if (!authSession.authenticated || !authSession.user || conflictOpen) {
      return;
    }

    if (!options.quiet) {
      setSyncing(true);
    }

    try {
      const snapshot = await exportLocalSnapshot();
      await uploadSnapshotToCloud(snapshot);
      const profile = await markLocalSnapshotSynced(authSession.user.id);
      setDeviceProfile(profile);
      await refreshPendingSyncCount();
    } finally {
      if (!options.quiet) {
        setSyncing(false);
      }
    }
  }, [authSession, conflictOpen, refreshPendingSyncCount]);

  const bootstrapSession = useCallback(async () => {
    setBooting(true);

    try {
      const nextAuthSession = await fetchAuthSession();
      let nextDeviceProfile = await getDeviceProfile();
      const localDataExists = await hasLocalAppData();

      if (nextAuthSession.authenticated && nextAuthSession.user) {
        const cloudStatus = await fetchCloudSyncStatus();

        if (!nextDeviceProfile) {
          if (cloudStatus?.hasCloudData) {
            const cloudSnapshot = await fetchCloudSnapshot();
            nextDeviceProfile = await replaceLocalSnapshot(cloudSnapshot, {
              linkedCloudUserId: nextAuthSession.user.id,
              source: 'cloud',
            });
          } else {
            nextDeviceProfile = await seedDeviceProfileFromAuth(nextAuthSession);
          }
        } else if (nextDeviceProfile.cloudLinkedUserId === nextAuthSession.user.id) {
          if (!cloudStatus?.hasCloudData) {
            const snapshot = await exportLocalSnapshot();
            await uploadSnapshotToCloud(snapshot);
            nextDeviceProfile = await markLocalSnapshotSynced(nextAuthSession.user.id);
          }
        } else if (localDataExists && cloudStatus?.hasCloudData) {
          setConflictOpen(true);
        } else if (cloudStatus?.hasCloudData) {
          const cloudSnapshot = await fetchCloudSnapshot();
          nextDeviceProfile = await replaceLocalSnapshot(cloudSnapshot, {
            preserveDeviceIdentity: true,
            linkedCloudUserId: nextAuthSession.user.id,
            source: 'cloud',
          });
        } else {
          const snapshot = await exportLocalSnapshot();
          await uploadSnapshotToCloud(snapshot);
          nextDeviceProfile = await markLocalSnapshotSynced(nextAuthSession.user.id);
        }
      } else {
        setConflictOpen(false);
      }

      setAuthSession(nextAuthSession);
      setDeviceProfile(nextDeviceProfile);
      await refreshPendingSyncCount();
    } finally {
      setBooting(false);
    }
  }, [refreshPendingSyncCount]);

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
        void syncCurrentSnapshot({ quiet: true });
      }, 1200);
    };

    const unsubscribe = subscribeAppUpdates(() => {
      void refreshPendingSyncCount();
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

  const completeOnboarding = useCallback(async (input: LocalOnboardingInput) => {
    setSyncing(true);

    try {
      const profile = await completeLocalOnboarding(input, {
        linkedCloudUserId: authSession.user?.id ?? null,
      });
      setDeviceProfile(profile);

      if (authSession.authenticated && authSession.user) {
        await syncCurrentSnapshot();
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
      const profile = await replaceLocalSnapshot(cloudSnapshot, {
        preserveDeviceIdentity: true,
        linkedCloudUserId: authSession.user.id,
        source: 'cloud',
      });
      setDeviceProfile(profile);
      setConflictOpen(false);
      await refreshPendingSyncCount();
    } finally {
      setSyncing(false);
    }
  }, [authSession, refreshPendingSyncCount]);

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

  const handleLoggedOut = useCallback(() => {
    setAuthSession(EMPTY_SESSION);
    setConflictOpen(false);
  }, []);

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