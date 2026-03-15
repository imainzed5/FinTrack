'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import BottomNav from '@/components/BottomNav';
import ConsentModal from '@/components/ConsentModal';
import ServiceWorkerRegistration from '@/components/ServiceWorkerRegistration';
import type { AuthSessionResponse } from '@/lib/auth-contract';
import type { ConsentCheckResponse, PolicyVersionStatus } from '@/lib/policy';

const AUTH_PATH_PREFIX = '/auth';
const DEFAULT_AUTHENTICATED_ROUTE = '/dashboard';
const PUBLIC_AUTH_ROUTES = new Set(['/auth/terms', '/auth/privacy']);
const PUBLIC_APP_ROUTES = new Set(['/']);

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

function createUnauthenticatedSession(): AuthSessionResponse {
  return {
    authenticated: false,
    rememberMe: false,
    user: null,
  };
}

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

function AppRouteSkeleton() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <aside className="hidden h-screen w-64 animate-pulse flex-col border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 sm:flex">
        <div className="mx-6 my-5 h-10 rounded-xl bg-zinc-200 dark:bg-zinc-800" />
        <div className="flex-1 space-y-2 px-3 py-4">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="h-10 rounded-xl bg-zinc-200 dark:bg-zinc-800" />
          ))}
        </div>
      </aside>
      <main className="space-y-4 p-5 sm:ml-64 sm:p-8">
        <div className="h-8 w-56 animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-800" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="h-28 animate-pulse rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
            />
          ))}
        </div>
      </main>
    </div>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isAuthRoute = pathname.startsWith(AUTH_PATH_PREFIX);
  const isPublicAuthRoute = PUBLIC_AUTH_ROUTES.has(pathname);
  const isPublicAppRoute = PUBLIC_APP_ROUTES.has(pathname);
  const [session, setSession] = useState<AuthSessionResponse>(
    createUnauthenticatedSession()
  );
  const [isSessionLoading, setIsSessionLoading] = useState(true);
  const [checkedPathname, setCheckedPathname] = useState('');
  const [consentStatus, setConsentStatus] =
    useState<ConsentCheckResponse | null>(null);
  const [consentError, setConsentError] = useState('');
  const [isSubmittingConsent, setIsSubmittingConsent] = useState(false);

  const loadSession = useCallback(async (forPathname: string) => {
    setIsSessionLoading(true);
    try {
      const response = await fetch('/api/auth/session', {
        method: 'GET',
        cache: 'no-store',
        credentials: 'include',
      });
      const data = (await response.json().catch(() => null)) as AuthSessionResponse | null;

      if (!response.ok || !data || !data.authenticated || !data.user) {
        setSession({
          authenticated: false,
          rememberMe: Boolean(data?.rememberMe),
          user: null,
        });
        return;
      }

      setSession(data);
    } catch {
      setSession(createUnauthenticatedSession());
    } finally {
      setCheckedPathname(forPathname);
      setIsSessionLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSession(pathname);
  }, [loadSession, pathname]);

  useEffect(() => {
    if (!session.authenticated) {
      setConsentStatus(null);
      setConsentError('');
      setIsSubmittingConsent(false);
    }
  }, [session.authenticated]);

  useEffect(() => {
    if (
      isSessionLoading ||
      checkedPathname !== pathname ||
      isAuthRoute ||
      isPublicAppRoute ||
      !session.authenticated ||
      !session.user
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
    checkedPathname,
    isAuthRoute,
    isPublicAppRoute,
    isSessionLoading,
    pathname,
    session.authenticated,
    session.user,
  ]);

  useEffect(() => {
    if (
      isSessionLoading ||
      checkedPathname !== pathname ||
      isAuthRoute ||
      isPublicAppRoute ||
      session.authenticated
    ) {
      return;
    }
    const nextPath = encodeURIComponent(pathname);
    router.replace(`/auth/login?next=${nextPath}`);
  }, [
    checkedPathname,
    isAuthRoute,
    isPublicAppRoute,
    isSessionLoading,
    pathname,
    router,
    session.authenticated,
  ]);

  useEffect(() => {
    if (
      isSessionLoading ||
      checkedPathname !== pathname ||
      !isAuthRoute ||
      isPublicAuthRoute ||
      !session.authenticated
    ) {
      return;
    }
    router.replace(DEFAULT_AUTHENTICATED_ROUTE);
  }, [
    checkedPathname,
    isAuthRoute,
    isPublicAuthRoute,
    isSessionLoading,
    pathname,
    router,
    session.authenticated,
  ]);

  const handleLoggedOut = useCallback(() => {
    setSession(createUnauthenticatedSession());
    setConsentStatus(null);
    setConsentError('');
    setIsSubmittingConsent(false);
  }, []);

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
          setSession(createUnauthenticatedSession());
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
  }, []);

  const shouldShowConsentModal = Boolean(consentStatus?.needs_reconsent);

  if (isAuthRoute) {
    if (isSessionLoading || (session.authenticated && !isPublicAuthRoute)) {
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

  if (!session.authenticated || !session.user) {
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
        <AppRouteSkeleton />
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
      <Sidebar user={session.user} onLoggedOut={handleLoggedOut} />
      <main className="sm:ml-64 pb-20 mobile-nav-offset sm:pb-0 min-h-screen">{children}</main>
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
