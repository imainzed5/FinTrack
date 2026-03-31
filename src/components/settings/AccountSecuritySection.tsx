'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { differenceInDays, differenceInMinutes, format } from 'date-fns';
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  Info,
  Laptop,
  Loader2,
  LogOut,
  Monitor,
  Shield,
  Smartphone,
  Tablet,
  Trash2,
} from 'lucide-react';
import { useAppSession } from '@/components/AppSessionProvider';

interface AccountSummary {
  userId: string;
  email: string;
  fullName: string;
  createdAt: string;
  lastLoginAt: string | null;
}

type SessionDeviceType = 'desktop' | 'mobile' | 'tablet' | 'unknown';

interface SessionRecord {
  id: string;
  deviceType: SessionDeviceType;
  deviceLabel: string;
  browser: string;
  os: string;
  ipAddress: string | null;
  signedInAt: string;
  lastActiveAt: string;
  current: boolean;
}

type DeviceGroupKey = 'ios' | 'android' | 'windows' | 'mac' | 'other';

const DEVICE_GROUP_ORDER: DeviceGroupKey[] = ['ios', 'android', 'windows', 'mac', 'other'];

interface SessionsApiSuccess {
  success: true;
  account: AccountSummary;
  currentSession: SessionRecord | null;
  activeSessions: SessionRecord[];
}

interface SessionsApiError {
  success: false;
  error: string;
}

type SessionsApiResponse = SessionsApiSuccess | SessionsApiError;

interface BasicApiResponse {
  success: boolean;
  message?: string;
  error?: string;
  warning?: string | null;
  fieldErrors?: {
    fullName?: string;
    currentPassword?: string;
    newPassword?: string;
    confirmPassword?: string;
  };
  revokedCount?: number;
}

interface PasswordFormState {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

interface ConfirmActionModalProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  loading: boolean;
  destructive?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

function ConfirmActionModal({
  open,
  title,
  description,
  confirmLabel,
  loading,
  destructive = true,
  onCancel,
  onConfirm,
}: ConfirmActionModalProps) {
  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/50 px-4 py-6 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-action-title"
      aria-describedby="confirm-action-description"
    >
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xl dark:border-zinc-700 dark:bg-zinc-900">
        <h4 id="confirm-action-title" className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
          {title}
        </h4>
        <p id="confirm-action-description" className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
          {description}
        </p>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="min-h-11 rounded-xl border border-zinc-200 px-4 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`min-h-11 rounded-xl px-4 text-sm font-medium text-white transition-colors disabled:cursor-not-allowed disabled:opacity-70 ${
              destructive
                ? 'bg-rose-600 hover:bg-rose-500'
                : 'bg-emerald-600 hover:bg-emerald-500'
            }`}
          >
            {loading ? 'Please wait...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function formatDateTime(value: string | null): string {
  if (!value) {
    return 'Not available';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return 'Not available';
  }

  return format(parsed, 'PP p');
}

function getSessionIcon(deviceType: SessionDeviceType) {
  if (deviceType === 'mobile') {
    return <Smartphone size={16} className="text-zinc-500 dark:text-zinc-400" />;
  }

  if (deviceType === 'tablet') {
    return <Tablet size={16} className="text-zinc-500 dark:text-zinc-400" />;
  }

  return <Laptop size={16} className="text-zinc-500 dark:text-zinc-400" />;
}

function getSessionGroupKey(os: string): DeviceGroupKey {
  const normalizedOs = os.toLowerCase();

  if (normalizedOs.includes('ios')) {
    return 'ios';
  }

  if (normalizedOs.includes('android')) {
    return 'android';
  }

  if (normalizedOs.includes('windows')) {
    return 'windows';
  }

  if (normalizedOs.includes('mac')) {
    return 'mac';
  }

  return 'other';
}

function getSessionGroupLabel(groupKey: DeviceGroupKey): string {
  if (groupKey === 'ios') {
    return 'iOS Devices';
  }

  if (groupKey === 'android') {
    return 'Android Devices';
  }

  if (groupKey === 'windows') {
    return 'Windows / Desktop';
  }

  if (groupKey === 'mac') {
    return 'Mac / Desktop';
  }

  return 'Other';
}

function getSessionGroupIcon(groupKey: DeviceGroupKey) {
  if (groupKey === 'ios' || groupKey === 'android') {
    return <Smartphone size={14} className="text-zinc-500 dark:text-zinc-400" />;
  }

  if (groupKey === 'windows' || groupKey === 'mac') {
    return <Monitor size={14} className="text-zinc-500 dark:text-zinc-400" />;
  }

  return <Laptop size={14} className="text-zinc-500 dark:text-zinc-400" />;
}

function parseSessionTimestamp(value: string): number {
  const parsed = new Date(value);
  const timestamp = parsed.getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function getSessionAgeBadge(lastActiveAt: string): { label: string; toneClassName: string } {
  const parsed = new Date(lastActiveAt);
  if (Number.isNaN(parsed.getTime())) {
    return {
      label: 'Unknown',
      toneClassName: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300',
    };
  }

  const now = new Date();
  const minutesAgo = Math.max(differenceInMinutes(now, parsed), 0);

  if (minutesAgo <= 5) {
    return {
      label: 'Active now',
      toneClassName: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
    };
  }

  if (minutesAgo < 24 * 60) {
    return {
      label: 'Today',
      toneClassName: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-200',
    };
  }

  const daysAgo = Math.max(differenceInDays(now, parsed), 1);
  if (daysAgo >= 7) {
    return {
      label: 'Inactive 7+ days',
      toneClassName: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
    };
  }

  return {
    label: `${daysAgo} day${daysAgo === 1 ? '' : 's'} ago`,
    toneClassName: 'bg-zinc-50 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-300',
  };
}

function isLocalIpAddress(ipAddress: string | null): boolean {
  return ipAddress === '::1' || ipAddress === '127.0.0.1';
}

function getPasswordStrengthLabel(score: number): 'Weak' | 'Fair' | 'Good' | 'Strong' {
  if (score <= 1) {
    return 'Weak';
  }

  if (score === 2) {
    return 'Fair';
  }

  if (score === 3) {
    return 'Good';
  }

  return 'Strong';
}

function getPasswordStrengthTone(score: number): string {
  if (score <= 1) {
    return 'bg-rose-500';
  }

  if (score === 2) {
    return 'bg-amber-500';
  }

  if (score === 3) {
    return 'bg-sky-500';
  }

  return 'bg-emerald-500';
}

export default function AccountSecuritySection() {
  const router = useRouter();
  const { handleLoggedOut } = useAppSession();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [account, setAccount] = useState<AccountSummary | null>(null);
  const [currentSession, setCurrentSession] = useState<SessionRecord | null>(null);
  const [activeSessions, setActiveSessions] = useState<SessionRecord[]>([]);
  const [expandedSessionGroups, setExpandedSessionGroups] = useState<Partial<Record<DeviceGroupKey, boolean>>>({});

  const [profileFullName, setProfileFullName] = useState('');
  const [profileError, setProfileError] = useState('');
  const [profileStatus, setProfileStatus] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  const [passwordForm, setPasswordForm] = useState<PasswordFormState>({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [passwordError, setPasswordError] = useState('');
  const [passwordStatus, setPasswordStatus] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [showReloginAction, setShowReloginAction] = useState(false);

  const [securityStatus, setSecurityStatus] = useState('');
  const [securityError, setSecurityError] = useState('');
  const [isLoggingOutOthers, setIsLoggingOutOthers] = useState(false);
  const [showLogoutOthersConfirm, setShowLogoutOthersConfirm] = useState(false);
  const [pendingRevokeSession, setPendingRevokeSession] = useState<SessionRecord | null>(null);
  const [isRevokingSession, setIsRevokingSession] = useState(false);

  const [copyEmailMessage, setCopyEmailMessage] = useState('');

  const loadAccountSecurityData = useCallback(async (showLoading = false) => {
    if (showLoading) {
      setLoading(true);
    }

    setLoadError('');

    try {
      const response = await fetch('/api/auth/sessions', {
        method: 'GET',
        cache: 'no-store',
        credentials: 'include',
      });

      const data = (await response.json().catch(() => null)) as SessionsApiResponse | null;
      if (!response.ok || !data || !data.success) {
        const fallback = 'Unable to load account security settings right now.';
        const message = data && !data.success ? data.error : fallback;
        setLoadError(message);
        return;
      }

      setAccount(data.account);
      setProfileFullName(data.account.fullName);
      setCurrentSession(data.currentSession);
      setActiveSessions(Array.isArray(data.activeSessions) ? data.activeSessions : []);
    } catch {
      setLoadError('Network error. Please check your connection and retry.');
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadAccountSecurityData(true);
  }, [loadAccountSecurityData]);

  const passwordChecks = useMemo(() => {
    const candidate = passwordForm.newPassword;

    return {
      minLength: candidate.length >= 8,
      hasUppercase: /[A-Z]/.test(candidate),
      hasNumber: /[0-9]/.test(candidate),
      hasSymbol: /[^A-Za-z0-9]/.test(candidate),
    };
  }, [passwordForm.newPassword]);

  const passwordScore = useMemo(() => {
    return Object.values(passwordChecks).filter(Boolean).length;
  }, [passwordChecks]);

  const passwordStrengthLabel = useMemo(() => {
    return getPasswordStrengthLabel(passwordScore);
  }, [passwordScore]);

  const otherActiveSessions = activeSessions.filter((session) => !session.current);

  const groupedActiveSessions = useMemo(() => {
    const groupedSessions: Record<DeviceGroupKey, SessionRecord[]> = {
      ios: [],
      android: [],
      windows: [],
      mac: [],
      other: [],
    };

    for (const session of activeSessions) {
      const groupKey = getSessionGroupKey(session.os);
      groupedSessions[groupKey].push(session);
    }

    return DEVICE_GROUP_ORDER.map((groupKey) => {
      const sortedSessions = [...groupedSessions[groupKey]].sort((sessionA, sessionB) => {
        if (sessionA.current && !sessionB.current) {
          return -1;
        }

        if (!sessionA.current && sessionB.current) {
          return 1;
        }

        return parseSessionTimestamp(sessionB.lastActiveAt) - parseSessionTimestamp(sessionA.lastActiveAt);
      });

      return {
        groupKey,
        label: getSessionGroupLabel(groupKey),
        sessions: sortedSessions,
      };
    }).filter((group) => group.sessions.length > 0);
  }, [activeSessions]);

  const handleToggleSessionGroup = useCallback((groupKey: DeviceGroupKey) => {
    setExpandedSessionGroups((previous) => ({
      ...previous,
      [groupKey]: !previous[groupKey],
    }));
  }, []);

  const handleCopyEmail = useCallback(async () => {
    if (!account?.email) {
      return;
    }

    try {
      await navigator.clipboard.writeText(account.email);
      setCopyEmailMessage('Email copied.');
      window.setTimeout(() => setCopyEmailMessage(''), 1800);
    } catch {
      setCopyEmailMessage('Unable to copy email right now.');
      window.setTimeout(() => setCopyEmailMessage(''), 1800);
    }
  }, [account?.email]);

  const handleSaveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const nextName = profileFullName.trim();
    if (!nextName) {
      setProfileError('Full name is required.');
      setProfileStatus('');
      return;
    }

    if (nextName.length > 50) {
      setProfileError('Full name must be 50 characters or fewer.');
      setProfileStatus('');
      return;
    }

    setProfileError('');
    setProfileStatus('');
    setIsSavingProfile(true);

    try {
      const response = await fetch('/api/auth/update-profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          fullName: nextName,
        }),
      });

      const data = (await response.json().catch(() => null)) as BasicApiResponse | null;
      if (!response.ok || !data?.success) {
        const fieldMessage = data?.fieldErrors?.fullName;
        const fallback = 'Unable to update your profile right now.';
        const message = fieldMessage || data?.error || fallback;
        setProfileError(message);
        return;
      }

      setProfileStatus(data.message || 'Profile updated successfully.');
      setProfileFullName(nextName);
      await loadAccountSecurityData();
    } catch {
      setProfileError('Network error. Please check your connection and retry.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handlePasswordFieldChange = (field: keyof PasswordFormState, value: string) => {
    setPasswordForm((previous) => ({
      ...previous,
      [field]: value,
    }));
    setPasswordError('');
    setPasswordStatus('');
    setShowReloginAction(false);
  };

  const handleChangePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const currentPassword = passwordForm.currentPassword;
    const newPassword = passwordForm.newPassword;
    const confirmPassword = passwordForm.confirmPassword;

    if (!currentPassword) {
      setPasswordError('Current password is required.');
      return;
    }

    if (!newPassword) {
      setPasswordError('New password is required.');
      return;
    }

    if (!passwordChecks.minLength || !passwordChecks.hasUppercase || !passwordChecks.hasNumber || !passwordChecks.hasSymbol) {
      setPasswordError('New password does not meet all required rules.');
      return;
    }

    if (confirmPassword !== newPassword) {
      setPasswordError('New passwords do not match.');
      return;
    }

    setPasswordError('');
    setPasswordStatus('');
    setIsChangingPassword(true);

    try {
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          currentPassword,
          newPassword,
          confirmPassword,
        }),
      });

      const data = (await response.json().catch(() => null)) as BasicApiResponse | null;
      if (!response.ok || !data?.success) {
        const fieldError =
          data?.fieldErrors?.currentPassword ||
          data?.fieldErrors?.newPassword ||
          data?.fieldErrors?.confirmPassword;

        const retryAfter = response.headers.get('Retry-After');
        const retryText =
          response.status === 429 && retryAfter
            ? ` Please try again in ${retryAfter} seconds.`
            : '';

        const fallback = 'Unable to change password right now.';
        const message = fieldError || data?.error || `${fallback}${retryText}`;
        setPasswordError(message);
        return;
      }

      setPasswordStatus(
        data.message || 'Password changed successfully. For security, sign out and log in again.'
      );
      setShowReloginAction(true);
      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
    } catch {
      setPasswordError('Network error. Please check your connection and retry.');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleRelogin = async () => {
    setPasswordError('');
    setPasswordStatus('Signing you out...');

    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });

      const data = (await response.json().catch(() => null)) as BasicApiResponse & {
        redirectTo?: string;
      } | null;

      if (!response.ok || !data?.success) {
        setPasswordError(data?.error || 'Unable to sign out right now. Please use the account menu logout action.');
        setPasswordStatus('');
        return;
      }

      await handleLoggedOut();
      router.push(data.redirectTo || '/auth/login');
      router.refresh();
    } catch {
      setPasswordError('Unable to sign out right now. Please use the account menu logout action.');
      setPasswordStatus('');
    }
  };

  const handleLogoutOtherSessions = async () => {
    setSecurityError('');
    setSecurityStatus('');
    setIsLoggingOutOthers(true);

    try {
      const response = await fetch('/api/auth/logout-other-sessions', {
        method: 'POST',
        credentials: 'include',
      });

      const data = (await response.json().catch(() => null)) as BasicApiResponse | null;
      if (!response.ok || !data?.success) {
        const fallback = 'Unable to sign out other sessions right now.';
        setSecurityError(data?.error || fallback);
        return;
      }

      const revokedCount = typeof data.revokedCount === 'number' ? data.revokedCount : null;
      const baseMessage = data.message || 'Other sessions were signed out successfully.';
      const countMessage = revokedCount !== null ? ` (${revokedCount} session${revokedCount === 1 ? '' : 's'})` : '';
      const warningMessage = data.warning ? ` Warning: ${data.warning}` : '';

      setSecurityStatus(`${baseMessage}${countMessage}${warningMessage}`);
      await loadAccountSecurityData();
    } catch {
      setSecurityError('Network error. Please check your connection and retry.');
    } finally {
      setShowLogoutOthersConfirm(false);
      setIsLoggingOutOthers(false);
    }
  };

  const handleRevokeSession = async () => {
    if (!pendingRevokeSession) {
      return;
    }

    setSecurityError('');
    setSecurityStatus('');
    setIsRevokingSession(true);

    try {
      const response = await fetch(`/api/auth/sessions/${pendingRevokeSession.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      const data = (await response.json().catch(() => null)) as BasicApiResponse | null;
      if (!response.ok || !data?.success) {
        const fallback = 'Unable to revoke this session right now.';
        setSecurityError(data?.error || fallback);
        return;
      }

      setSecurityStatus(data.message || 'Session revoked successfully.');
      await loadAccountSecurityData();
    } catch {
      setSecurityError('Network error. Please check your connection and retry.');
    } finally {
      setIsRevokingSession(false);
      setPendingRevokeSession(null);
    }
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 border border-zinc-100 dark:border-zinc-800 mb-4">
        <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
          <Loader2 size={16} className="animate-spin" />
          Loading account security settings...
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 border border-rose-200 dark:border-rose-500/30 mb-4">
        <div className="flex items-start gap-2 text-sm text-rose-700 dark:text-rose-300">
          <AlertTriangle size={16} className="mt-0.5" />
          <div>
            <p className="font-medium">Unable to load account security settings.</p>
            <p className="mt-1">{loadError}</p>
            <button
              type="button"
              onClick={() => void loadAccountSecurityData(true)}
              className="mt-3 min-h-11 rounded-xl bg-emerald-600 px-4 text-sm font-medium text-white transition-colors hover:bg-emerald-500"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 border border-zinc-100 dark:border-zinc-800 mb-4">
        <div className="flex items-center gap-2 mb-4">
          <Shield size={16} className="text-emerald-600 dark:text-emerald-400" />
          <h3 className="font-display text-sm font-semibold text-zinc-900 dark:text-white">Account & Security</h3>
        </div>

        <div className="space-y-3">
          <details open className="group rounded-xl border border-zinc-200 dark:border-zinc-700 [&_summary::-webkit-details-marker]:hidden">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Account Information
              <span className="text-xs text-zinc-400 transition-transform group-open:rotate-180">v</span>
            </summary>

            <div className="space-y-4 border-t border-zinc-200 px-4 py-4 dark:border-zinc-700">
              <form onSubmit={handleSaveProfile} className="space-y-4">
                <div>
                  <label htmlFor="account-full-name" className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                    Full name
                  </label>
                  <input
                    id="account-full-name"
                    type="text"
                    value={profileFullName}
                    onChange={(event) => {
                      setProfileFullName(event.target.value);
                      setProfileError('');
                      setProfileStatus('');
                    }}
                    maxLength={50}
                    className="mt-1 w-full min-h-11 rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                    placeholder="Your full name"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Email address</label>
                  <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-center">
                    <input
                      type="text"
                      value={account?.email ?? ''}
                      readOnly
                      className="w-full min-h-11 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                    />
                    <button
                      type="button"
                      onClick={handleCopyEmail}
                      className="inline-flex min-h-11 items-center justify-center gap-1 rounded-xl border border-zinc-200 px-3 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    >
                      <Copy size={14} />
                      Copy
                    </button>
                  </div>
                  {copyEmailMessage ? (
                    <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{copyEmailMessage}</p>
                  ) : null}
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800">
                    <p className="text-[11px] uppercase tracking-[0.12em] text-zinc-500 dark:text-zinc-400">Account created</p>
                    <p className="mt-1 text-sm font-medium text-zinc-800 dark:text-zinc-100">
                      {formatDateTime(account?.createdAt ?? null)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800">
                    <p className="text-[11px] uppercase tracking-[0.12em] text-zinc-500 dark:text-zinc-400">Last login</p>
                    <p className="mt-1 text-sm font-medium text-zinc-800 dark:text-zinc-100">
                      {formatDateTime(account?.lastLoginAt ?? null)}
                    </p>
                  </div>
                </div>

                {profileError ? (
                  <p className="text-xs text-rose-600 dark:text-rose-400">{profileError}</p>
                ) : null}
                {profileStatus ? (
                  <p className="text-xs text-emerald-700 dark:text-emerald-300">{profileStatus}</p>
                ) : null}

                <button
                  type="submit"
                  disabled={isSavingProfile}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-medium text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isSavingProfile ? <Loader2 size={14} className="animate-spin" /> : null}
                  {isSavingProfile ? 'Saving changes...' : 'Save Changes'}
                </button>
              </form>
            </div>
          </details>

          <details className="group rounded-xl border border-zinc-200 dark:border-zinc-700 [&_summary::-webkit-details-marker]:hidden">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Change Password
              <span className="text-xs text-zinc-400 transition-transform group-open:rotate-180">v</span>
            </summary>

            <div className="space-y-4 border-t border-zinc-200 px-4 py-4 dark:border-zinc-700">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300" title="Passwords must be at least 8 characters and include uppercase, number, and special character.">
                <Info size={12} />
                Password requirements apply
              </div>

              <form onSubmit={handleChangePassword} className="space-y-4">
                <div>
                  <label htmlFor="current-password" className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                    Current password
                  </label>
                  <input
                    id="current-password"
                    type="password"
                    autoComplete="current-password"
                    value={passwordForm.currentPassword}
                    onChange={(event) => handlePasswordFieldChange('currentPassword', event.target.value)}
                    className="mt-1 w-full min-h-11 rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="new-password" className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                    New password
                  </label>
                  <input
                    id="new-password"
                    type="password"
                    autoComplete="new-password"
                    value={passwordForm.newPassword}
                    onChange={(event) => handlePasswordFieldChange('newPassword', event.target.value)}
                    className="mt-1 w-full min-h-11 rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                    required
                  />

                  <div className="mt-2 rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-800/60">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-zinc-600 dark:text-zinc-300">Strength</span>
                      <span className="font-semibold text-zinc-700 dark:text-zinc-200">{passwordStrengthLabel}</span>
                    </div>
                    <div className="mt-2 h-2 w-full rounded-full bg-zinc-200 dark:bg-zinc-700" aria-hidden>
                      <div
                        className={`h-2 rounded-full transition-all ${getPasswordStrengthTone(passwordScore)}`}
                        style={{ width: `${(passwordScore / 4) * 100}%` }}
                      />
                    </div>
                    <ul className="mt-3 grid grid-cols-1 gap-1 text-[11px] text-zinc-600 dark:text-zinc-300 sm:grid-cols-2">
                      <li className={passwordChecks.minLength ? 'text-emerald-700 dark:text-emerald-300' : ''}>At least 8 characters</li>
                      <li className={passwordChecks.hasUppercase ? 'text-emerald-700 dark:text-emerald-300' : ''}>One uppercase letter</li>
                      <li className={passwordChecks.hasNumber ? 'text-emerald-700 dark:text-emerald-300' : ''}>One number</li>
                      <li className={passwordChecks.hasSymbol ? 'text-emerald-700 dark:text-emerald-300' : ''}>One special character</li>
                    </ul>
                  </div>
                </div>

                <div>
                  <label htmlFor="confirm-new-password" className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                    Confirm new password
                  </label>
                  <input
                    id="confirm-new-password"
                    type="password"
                    autoComplete="new-password"
                    value={passwordForm.confirmPassword}
                    onChange={(event) => handlePasswordFieldChange('confirmPassword', event.target.value)}
                    className="mt-1 w-full min-h-11 rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                    required
                  />
                </div>

                {passwordError ? (
                  <p className="text-xs text-rose-600 dark:text-rose-400">{passwordError}</p>
                ) : null}
                {passwordStatus ? (
                  <p className="text-xs text-emerald-700 dark:text-emerald-300">{passwordStatus}</p>
                ) : null}

                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <button
                    type="submit"
                    disabled={isChangingPassword}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-medium text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {isChangingPassword ? <Loader2 size={14} className="animate-spin" /> : null}
                    {isChangingPassword ? 'Changing password...' : 'Update Password'}
                  </button>

                  {showReloginAction ? (
                    <button
                      type="button"
                      onClick={handleRelogin}
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-zinc-200 px-4 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    >
                      <LogOut size={14} />
                      Log out and re-login
                    </button>
                  ) : null}
                </div>
              </form>
            </div>
          </details>

          <details className="group rounded-xl border border-zinc-200 dark:border-zinc-700 [&_summary::-webkit-details-marker]:hidden">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Login & Security
              <span className="text-xs text-zinc-400 transition-transform group-open:rotate-180">v</span>
            </summary>

            <div className="space-y-4 border-t border-zinc-200 px-4 py-4 dark:border-zinc-700">
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-800">
                <p className="text-[11px] uppercase tracking-[0.12em] text-zinc-500 dark:text-zinc-400">Current session</p>
                {currentSession ? (
                  <div className="mt-2 space-y-1 text-sm text-zinc-700 dark:text-zinc-200">
                    <p className="flex items-center gap-1.5 font-medium">
                      {getSessionIcon(currentSession.deviceType)}
                      {currentSession.deviceLabel} (current device)
                    </p>
                    <p>{currentSession.browser} on {currentSession.os}</p>
                    <p>Signed in: {formatDateTime(currentSession.signedInAt)}</p>
                    <p>IP: {currentSession.ipAddress || 'Not available'}</p>
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">Current session details are not available.</p>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowLogoutOthersConfirm(true)}
                  disabled={isLoggingOutOthers || otherActiveSessions.length === 0}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 text-sm font-medium text-white transition-colors hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isLoggingOutOthers ? <Loader2 size={14} className="animate-spin" /> : <LogOut size={14} />}
                  Log out from all other devices
                </button>
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  {otherActiveSessions.length} active session{otherActiveSessions.length === 1 ? '' : 's'} besides this device
                </span>
              </div>

              {securityError ? (
                <p className="text-xs text-rose-600 dark:text-rose-400">{securityError}</p>
              ) : null}
              {securityStatus ? (
                <p className="text-xs text-emerald-700 dark:text-emerald-300">{securityStatus}</p>
              ) : null}

              <div>
                <h4 className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500 dark:text-zinc-400">Active Sessions</h4>
                {groupedActiveSessions.length === 0 ? (
                  <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">No active sessions found.</p>
                ) : (
                  <div className="mt-2 space-y-3">
                    {groupedActiveSessions.map((group) => {
                      const isExpanded = Boolean(expandedSessionGroups[group.groupKey]);
                      const visibleSessions = isExpanded ? group.sessions : group.sessions.slice(0, 3);
                      const hiddenCount = group.sessions.length - visibleSessions.length;

                      return (
                        <div
                          key={group.groupKey}
                          className="rounded-xl border border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900/40"
                        >
                          <div className="flex items-center justify-between border-b border-zinc-200 px-3 py-2.5 dark:border-zinc-700">
                            <p className="flex items-center gap-1.5 text-sm font-semibold text-zinc-800 dark:text-zinc-100">
                              {getSessionGroupIcon(group.groupKey)}
                              {group.label} ({group.sessions.length})
                            </p>
                          </div>

                          <div className="space-y-2 p-3">
                            {visibleSessions.map((session) => {
                              const ageBadge = getSessionAgeBadge(session.lastActiveAt);
                              const localIp = isLocalIpAddress(session.ipAddress);

                              return (
                                <div
                                  key={session.id}
                                  className="flex flex-col gap-2 rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-800 sm:flex-row sm:items-center sm:justify-between"
                                >
                                  <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-1.5">
                                      <p className="text-sm font-medium text-zinc-800 dark:text-zinc-100">
                                        {session.current ? 'Current device' : session.deviceLabel}
                                      </p>
                                      <span
                                        className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${ageBadge.toneClassName}`}
                                      >
                                        {ageBadge.label}
                                      </span>
                                    </div>
                                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                                      {session.browser} on {session.os}
                                    </p>
                                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                                      Last active: {formatDateTime(session.lastActiveAt)}
                                    </p>
                                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                                      <span>IP: {session.ipAddress || 'Not available'}</span>
                                      {localIp ? (
                                        <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
                                          Local
                                        </span>
                                      ) : null}
                                    </div>
                                  </div>

                                  {!session.current ? (
                                    <button
                                      type="button"
                                      onClick={() => setPendingRevokeSession(session)}
                                      className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-rose-200 px-3 text-sm font-medium text-rose-700 transition-colors hover:bg-rose-50 dark:border-rose-500/30 dark:text-rose-300 dark:hover:bg-rose-500/10"
                                    >
                                      <Trash2 size={14} />
                                      Revoke
                                    </button>
                                  ) : null}
                                </div>
                              );
                            })}

                            {group.sessions.length > 3 ? (
                              <button
                                type="button"
                                onClick={() => handleToggleSessionGroup(group.groupKey)}
                                className="inline-flex items-center gap-1 text-xs font-medium text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100"
                              >
                                {isExpanded ? 'Show less' : `Show ${hiddenCount} more`}
                                <span className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                                  v
                                </span>
                              </button>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </details>
        </div>

        <div className="mt-4 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300">
          <CheckCircle2 size={14} className="mt-0.5" />
          <p>
            For security, changing your password may require signing in again on some devices.
          </p>
        </div>
      </div>

      <ConfirmActionModal
        open={showLogoutOthersConfirm}
        title="Log out from all other devices?"
        description="This will end all active sessions except your current device. You can sign in again on those devices anytime."
        confirmLabel="Log out other devices"
        loading={isLoggingOutOthers}
        onCancel={() => setShowLogoutOthersConfirm(false)}
        onConfirm={() => void handleLogoutOtherSessions()}
      />

      <ConfirmActionModal
        open={Boolean(pendingRevokeSession)}
        title="Revoke this session?"
        description="The selected device will lose access after its next session check and need to sign in again."
        confirmLabel="Revoke session"
        loading={isRevokingSession}
        onCancel={() => setPendingRevokeSession(null)}
        onConfirm={() => void handleRevokeSession()}
      />
    </>
  );
}
