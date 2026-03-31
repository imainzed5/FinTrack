'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import BottomNav from '@/components/BottomNav';
import ConsentModal from '@/components/ConsentModal';
import ServiceWorkerRegistration from '@/components/ServiceWorkerRegistration';
import { DashboardSkeleton } from '@/components/SkeletonLoaders';
import { useAppSession } from '@/components/AppSessionProvider';
import type { ConsentCheckResponse, PolicyVersionStatus } from '@/lib/policy';

const AUTH_PATH_PREFIX = '/auth';
const DEFAULT_AUTHENTICATED_ROUTE = '/dashboard';
const PUBLIC_AUTH_ROUTES = new Set(['/auth/terms', '/auth/privacy']);
const PUBLIC_APP_ROUTES = new Set(['/', '/onboarding']);

const EMPTY_CONSENT_POLICIES: ConsentCheckResponse['policies'] = {
  terms_of_service: {
    current_version: '',
    accepted_version: null,
  },
  privacy_policy: {
    current_version: '',
    accepted_version: null,
  },
};

function parsePolicyVersionStatus(value: unknown): PolicyVersionStatus | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  const currentVersion = candidate.current_version;
  const acceptedVersion = candidate.accepted_version;

  if (typeof currentVersion !== 'string' || currentVersion.trim().length === 0) {
    return null;
  }

  if (acceptedVersion !== null && typeof acceptedVersion !== 'string') {
    return null;
  }

  return {
    current_version: currentVersion,
    accepted_version: typeof acceptedVersion === 'string' ? acceptedVersion : null,
  };
}

function parseConsentCheckResponse(value: unknown): ConsentCheckResponse | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  if (typeof candidate.needs_reconsent !== 'boolean') {
    return null;
  }

  if (!candidate.policies || typeof candidate.policies !== 'object') {
    return null;
  }

  const policies = candidate.policies as Record<string, unknown>;
  const termsStatus = parsePolicyVersionStatus(policies.terms_of_service);
  const privacyStatus = parsePolicyVersionStatus(policies.privacy_policy);

  if (!termsStatus || !privacyStatus) {
    return null;
  }

  return {
    needs_reconsent: candidate.needs_reconsent,
    policies: {
      terms_of_service: termsStatus,
      privacy_policy: privacyStatus,
    },
  };
}

function AuthRouteSkeleton() {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-gradient-to-b from-slate-50 via-cyan-50/30 to-white dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950">
      <div className="relative mx-auto flex min-h-screen w-full max-w-md items-center px-4 py-8 sm:px-6">
        <div className="w-full animate-pulse rounded-3xl border border-slate-200/80 bg-white/95 p-6 dark:border-zinc-800 dark:bg-zinc-900/95 sm:p-8">
          <div className="mb-6 h-9 w-32 rounded-full bg-slate-200 dark:bg-zinc-800" />
          <div className="mb-3 h-7 w-2/3 rounded-lg bg-slate-200 dark:bg-zinc-800" />
          <div className="mb-8 h-4 w-full rounded bg-slate-200 dark:bg-zinc-800" />
          <div className="space-y-4">
            <div className="h-11 w-full rounded-xl bg-slate-200 dark:bg-zinc-800" />
            <div className="h-11 w-full rounded-xl bg-slate-200 dark:bg-zinc-800" />
            <div className="h-11 w-full rounded-xl bg-slate-200 dark:bg-zinc-800" />
          </div>
        </div>
      </div>
    </div>
  );
}

function AppRouteSkeleton({ pathname }: { pathname: string }) {
  const isDashboardPath = pathname === '/dashboard';

  return (
    <div className="min-h-screen bg-[#f8f7f2] dark:bg-zinc-950">
      <aside className="hidden sm:fixed sm:inset-y-0 sm:left-0 sm:flex h-screen w-56 animate-pulse flex-col border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-6 my-5 h-10 rounded-xl bg-zinc-200 dark:bg-zinc-800" />
        <div className="flex-1 space-y-2 px-3 py-4">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="h-10 rounded-xl bg-zinc-200 dark:bg-zinc-800" />
          ))}
        </div>
      </aside>
      <main
        className={
          isDashboardPath
            ? 'min-h-screen bg-[#f8f7f2] pb-20 mobile-nav-offset sm:ml-56 sm:pb-0 dark:bg-zinc-950'
            : 'space-y-4 bg-[#f8f7f2] p-5 sm:ml-56 sm:p-8 dark:bg-zinc-950'
        }
      >
        {isDashboardPath ? (
          <DashboardSkeleton />
        ) : (
          <>
            <div className="h-8 w-56 animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-800" />
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <div
                  key={index}
                  className="h-28 animate-pulse rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
                />
              ))}
            </div>
          </>
        )}
      </main>

      {isDashboardPath ? (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-zinc-200 bg-white sm:hidden">
          <div className="mx-auto flex h-16 max-w-md items-center justify-around px-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-8 w-14 animate-pulse rounded-xl bg-zinc-200" />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const {
    authSession,
    booting,
    canAccessApp,
    deviceProfile,
    handleLoggedOut,
    storageMode,
    viewer,
  } = useAppSession();
  const isAuthRoute = pathname.startsWith(AUTH_PATH_PREFIX);
  const isPublicAuthRoute = PUBLIC_AUTH_ROUTES.has(pathname);
  const isPublicAppRoute = PUBLIC_APP_ROUTES.has(pathname);
  const [consentStatus, setConsentStatus] =
    useState<ConsentCheckResponse | null>(null);
  const [consentError, setConsentError] = useState('');
  const [isSubmittingConsent, setIsSubmittingConsent] = useState(false);

  useEffect(() => {
    if (!authSession.authenticated) {
      setConsentStatus(null);
      setConsentError('');
      setIsSubmittingConsent(false);
    }
  }, [authSession.authenticated]);

  useEffect(() => {
    if (
      booting ||
      isAuthRoute ||
      isPublicAppRoute ||
      !authSession.authenticated ||
      !authSession.user
    ) {
      return;
    }

    let isCancelled = false;

    const loadConsentStatus = async () => {
      try {
        const response = await fetch('/api/auth/check-consent', {
          method: 'GET',
          cache: 'no-store',
          credentials: 'include',
        });
        const data = await response.json().catch(() => null);
        const parsed = parseConsentCheckResponse(data);

        if (!response.ok || !parsed) {
          if (!isCancelled) {
            setConsentStatus(null);
          }
          return;
        }

        if (!isCancelled) {
          setConsentStatus(parsed);
          setConsentError('');
        }
      } catch {
        if (!isCancelled) {
          setConsentStatus(null);
        }
      }
    };

    void loadConsentStatus();

    return () => {
      isCancelled = true;
    };
  }, [
    authSession.authenticated,
    authSession.user,
    booting,
    isAuthRoute,
    isPublicAppRoute,
    pathname,
  ]);

  useEffect(() => {
    if (
      booting ||
      isAuthRoute ||
      isPublicAppRoute ||
      canAccessApp
    ) {
      return;
    }
    router.replace('/');
  }, [
    booting,
    canAccessApp,
    isAuthRoute,
    isPublicAppRoute,
    pathname,
    router,
  ]);

  useEffect(() => {
    if (
      booting ||
      !isAuthRoute ||
      isPublicAuthRoute ||
      !authSession.authenticated
    ) {
      return;
    }
    router.replace(DEFAULT_AUTHENTICATED_ROUTE);
  }, [
    authSession.authenticated,
    booting,
    isAuthRoute,
    isPublicAuthRoute,
    router,
  ]);

  const handleAcceptLatestPolicies = useCallback(async () => {
    setConsentError('');
    setIsSubmittingConsent(true);

    try {
      const response = await fetch('/api/auth/consent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ acceptedLatestPolicies: true }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        if (response.status === 401) {
          await handleLoggedOut();
          return;
        }

        const fallback = 'Unable to update policy consent right now.';
        const message =
          data &&
          typeof data === 'object' &&
          'error' in data &&
          typeof (data as { error?: unknown }).error === 'string'
            ? (data as { error: string }).error
            : fallback;
        setConsentError(message);
        return;
      }

      const parsed = parseConsentCheckResponse(data);
      if (parsed) {
        setConsentStatus(parsed);
        setConsentError('');
        return;
      }

      setConsentStatus((previous) => {
        if (!previous) {
          return null;
        }

        return {
          needs_reconsent: false,
          policies: {
            terms_of_service: {
              current_version: previous.policies.terms_of_service.current_version,
              accepted_version: previous.policies.terms_of_service.current_version,
            },
            privacy_policy: {
              current_version: previous.policies.privacy_policy.current_version,
              accepted_version: previous.policies.privacy_policy.current_version,
            },
          },
        };
      });
    } catch {
      setConsentError('Network error. Please check your connection and retry.');
    } finally {
      setIsSubmittingConsent(false);
    }
  }, [handleLoggedOut]);

  const shouldShowConsentModal = Boolean(consentStatus?.needs_reconsent);
  const showDeviceBanner =
    storageMode === 'local_only' &&
    !isPublicAppRoute &&
    !isAuthRoute &&
    Boolean(deviceProfile?.onboardingComplete);

  if (isAuthRoute) {
    if (booting || (authSession.authenticated && !isPublicAuthRoute)) {
      return (
        <>
          <main className="min-h-screen">
            <AuthRouteSkeleton />
          </main>
          <ServiceWorkerRegistration />
        </>
      );
    }

    return (
      <>
        <main className="min-h-screen">{children}</main>
        <ServiceWorkerRegistration />
      </>
    );
  }

  if (!canAccessApp) {
    if (isPublicAppRoute) {
      return (
        <>
          {children}
          <ServiceWorkerRegistration />
        </>
      );
    }

    return (
      <>
        <AppRouteSkeleton pathname={pathname} />
        <ServiceWorkerRegistration />
      </>
    );
  }

  if (isPublicAppRoute) {
    return (
      <>
        {children}
        <ServiceWorkerRegistration />
      </>
    );
  }

  return (
    <>
      <Sidebar viewer={viewer} onLoggedOut={handleLoggedOut} />
      <main className="min-h-screen bg-[#f8f7f2] pb-20 mobile-nav-offset sm:ml-56 sm:pb-0 dark:bg-zinc-950">
        {showDeviceBanner ? (
          <div className="border-b border-amber-200 bg-amber-50/95 px-4 py-3 text-sm text-amber-900 backdrop-blur sm:px-6">
            <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
              <p>
                Stored only on this device right now. Add an account anytime in Settings to back up and sync across devices.
              </p>
              <button
                type="button"
                onClick={() => router.push('/settings?section=sync-data')}
                className="rounded-full border border-amber-300 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-amber-900 transition-colors hover:bg-amber-100"
              >
                Open backup settings
              </button>
            </div>
          </div>
        ) : null}
        {children}
      </main>
      <BottomNav />
      <ConsentModal
        open={shouldShowConsentModal}
        policies={consentStatus?.policies ?? EMPTY_CONSENT_POLICIES}
        isSubmitting={isSubmittingConsent}
        errorMessage={consentError}
        onAccept={handleAcceptLatestPolicies}
      />
      <ServiceWorkerRegistration />
    </>
  );
}
