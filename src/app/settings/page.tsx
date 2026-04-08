'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { format } from 'date-fns';
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Database,
  Download,
  Eraser,
  Monitor,
  Moon,
  Palette,
  PiggyBank,
  Settings as SettingsIcon,
  Shield,
  Sun,
  Upload,
  Wallet,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import AccountSecuritySection from '@/components/settings/AccountSecuritySection';
import AccountsSection, {
  type AccountsSectionSummary,
} from '@/components/settings/AccountsSection';
import { useAppSession } from '@/components/AppSessionProvider';
import BerdeSprite from '@/components/BerdeSprite';
import ConfirmModal from '@/components/ConfirmModal';
import { useTheme } from '@/components/ThemeProvider';
import type { BerdeState } from '@/lib/berde/berde.types';
import {
  getLocalAppSnapshotSummary,
  parseImportedLocalSnapshot,
  type LocalAppSnapshot,
} from '@/lib/local-first';
import {
  exportLocalSnapshot,
  getAccountsWithBalances,
  getBudgets,
  getLocalUserSettings,
  getPendingSyncCount,
  replaceLocalSnapshot,
  saveLocalUserSettings,
} from '@/lib/local-store';
import {
  isSyncStateRealtimeUpdate,
  subscribeAppUpdates,
  subscribeBudgetUpdates,
} from '@/lib/transaction-ws';
import type { AccountWithBalance, Budget } from '@/lib/types';
import { buildBudgetMonthSummary, compareBudgetScopes } from '@/lib/budgeting';
import { formatCurrency } from '@/lib/utils';

type SettingsSectionKey =
  | 'accounts'
  | 'budgets'
  | 'payday'
  | 'security'
  | 'sync-data'
  | 'appearance';

type SettingsGroup = 'Accounts & Money' | 'Security & Sync' | 'Data & Appearance';

interface SettingsNavItem {
  id: SettingsSectionKey;
  title: string;
  summary: string;
  status?: string;
  description: string;
  eyebrow: string;
  group: SettingsGroup;
  icon: ComponentType<{ size?: number; className?: string }>;
}

function parseDateValue(value: string): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function buildRecentMonthOptions(count: number): Array<{ value: string; label: string }> {
  const now = new Date();

  return Array.from({ length: count }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - index, 1);

    return {
      value: format(date, 'yyyy-MM'),
      label: format(date, 'MMMM yyyy'),
    };
  });
}

function formatPendingChanges(count: number): string {
  return `${count} change${count === 1 ? '' : 's'}`;
}

function resolveSettingsBerdeContext(params: {
  loading: boolean;
  monthBudgets: Budget[];
}): { state: BerdeState; message: string } {
  const { loading, monthBudgets } = params;

  if (loading) {
    return {
      state: 'helper',
      message:
        'Need a setup hand? Berde can help you shape a realistic budget for this month.',
    };
  }

  if (monthBudgets.length === 0) {
    return {
      state: 'worried',
      message:
        'No budget set yet. Add an Overall budget first so your spending has a clear limit.',
    };
  }

  if (monthBudgets.some((budget) => budget.category === 'Overall' && !budget.subCategory)) {
    return {
      state: 'proud',
      message: 'Great setup. You already have an Overall budget in place.',
    };
  }

  return {
    state: 'neutral',
    message:
      'Your categories are in place. Consider adding an Overall cap for stronger guardrails.',
  };
}

function SummaryTile({
  label,
  value,
  helper,
  loading = false,
  accent = false,
}: {
  label: string;
  value: string;
  helper: string;
  loading?: boolean;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-[24px] border px-4 py-4 shadow-[0_10px_28px_rgba(42,42,28,0.04)] ${
        accent
          ? 'border-emerald-200/80 bg-emerald-50/90'
          : 'border-[#e5ddcf] bg-white/88'
      }`}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
        {label}
      </p>
      {loading ? (
        <div className="mt-2 space-y-2">
          <div className="h-5 w-20 animate-pulse rounded bg-zinc-200/80" />
          <div className="h-3 w-24 animate-pulse rounded bg-zinc-200/60" />
        </div>
      ) : (
        <>
          <p className="mt-2 text-base font-semibold text-zinc-900 dark:text-zinc-50">{value}</p>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{helper}</p>
        </>
      )}
    </div>
  );
}

function DesktopNavButton({
  item,
  active,
  onClick,
}: {
  item: SettingsNavItem;
  active: boolean;
  onClick: () => void;
}) {
  const Icon = item.icon;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-[22px] border px-3 py-3 text-left transition-all ${
        active
          ? 'border-emerald-300 bg-[#edf7f1] shadow-[0_10px_26px_rgba(29,158,117,0.08)]'
          : 'border-transparent bg-transparent hover:border-[#ebe3d5] hover:bg-[#f8f3ea]'
      }`}
      aria-current={active ? 'page' : undefined}
    >
      <div className="flex items-start gap-3">
        <span
          className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${
            active ? 'bg-white text-[#1D9E75]' : 'bg-[#f6f1e7] text-zinc-600'
          }`}
        >
          <Icon size={18} />
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            {item.title}
          </span>
          <span className="mt-1 block text-xs leading-5 text-zinc-500 dark:text-zinc-400">
            {item.summary}
          </span>
          {item.status ? (
            <span className="mt-2 inline-flex rounded-full bg-white/80 px-2 py-1 text-[11px] font-medium text-[#1D9E75]">
              {item.status}
            </span>
          ) : null}
        </span>
      </div>
    </button>
  );
}

function MobileIndexRow({
  item,
  onClick,
}: {
  item: SettingsNavItem;
  onClick: () => void;
}) {
  const Icon = item.icon;

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-[28px] border border-[#e3dbc9] bg-white/92 px-4 py-4 text-left shadow-[0_12px_30px_rgba(42,42,28,0.05)] transition-transform hover:-translate-y-0.5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#f5efe4] text-zinc-700">
            <Icon size={18} />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                {item.title}
              </p>
              {item.status ? (
                <span className="inline-flex rounded-full bg-[#eef7f0] px-2 py-0.5 text-[11px] font-medium text-[#1D9E75]">
                  {item.status}
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
              {item.summary}
            </p>
          </div>
        </div>
        <ChevronRight size={16} className="mt-1 shrink-0 text-zinc-400" />
      </div>
    </button>
  );
}


function SettingsSurface({
  eyebrow,
  title,
  description,
  action,
  children,
  className = '',
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-[30px] border border-[#e1d8ca] bg-white/92 p-4 shadow-[0_12px_34px_rgba(42,42,28,0.05)] sm:p-5 ${className}`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#1D9E75]">
            {eyebrow}
          </p>
          <h3 className="mt-2 font-display text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            {title}
          </h3>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-zinc-500 dark:text-zinc-400">
            {description}
          </p>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function SettingsSheet({
  open,
  eyebrow,
  title,
  description,
  icon: Icon,
  onClose,
  children,
}: {
  open: boolean;
  eyebrow: string;
  title: string;
  description: string;
  icon: ComponentType<{ size?: number; className?: string }>;
  onClose: () => void;
  children: ReactNode;
}) {
  const [mounted] = useState(() => typeof window !== 'undefined');
  const [visible, setVisible] = useState(false);
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    let showTimer: number | null = null;
    let hideTimer: number | null = null;
    let firstFrame = 0;
    let secondFrame = 0;

    if (open) {
      showTimer = window.setTimeout(() => {
        setVisible(true);
        firstFrame = window.requestAnimationFrame(() => {
          secondFrame = window.requestAnimationFrame(() => setAnimating(true));
        });
      }, 0);
    } else {
      showTimer = window.setTimeout(() => setAnimating(false), 0);
      hideTimer = window.setTimeout(() => setVisible(false), 320);
    }

    return () => {
      if (showTimer !== null) window.clearTimeout(showTimer);
      if (hideTimer !== null) window.clearTimeout(hideTimer);
      if (firstFrame) window.cancelAnimationFrame(firstFrame);
      if (secondFrame) window.cancelAnimationFrame(secondFrame);
    };
  }, [open]);

  useEffect(() => {
    if (!visible) return;

    const previousOverflow = document.body.style.overflow;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleEscape);
    };
  }, [visible, onClose]);

  if (!mounted || !visible) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-40 flex items-end lg:hidden"
      style={{
        backgroundColor: animating ? 'rgba(24, 24, 22, 0.38)' : 'rgba(24, 24, 22, 0)',
        transition: 'background-color 280ms cubic-bezier(0.4, 0, 0.2, 1)',
      }}
      onClick={onClose}
    >
      <div
        className="modal-shell flex w-full max-h-[92dvh] flex-col rounded-t-[32px] border-x border-t border-[#ddd6c8] bg-[#f7f2e8]"
        style={{
          transform: animating ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 320ms cubic-bezier(0.4, 0, 0.2, 1)',
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mx-auto mt-2.5 h-1.5 w-12 rounded-full bg-zinc-300" />
        <div className="shrink-0 flex items-start justify-between gap-3 border-b border-[#e8dfd0] px-4 pb-4 pt-4">
          <div className="flex min-w-0 items-start gap-3">
            <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/85 text-[#1D9E75] shadow-[0_10px_24px_rgba(29,158,117,0.08)]">
              <Icon size={18} />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#1D9E75]">
                {eyebrow}
              </p>
              <h2 className="mt-1 font-display text-xl font-semibold text-zinc-900 dark:text-zinc-50">
                {title}
              </h2>
              <p className="mt-1 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                {description}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={`Close ${title}`}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#ddd6c8] bg-white/80 text-zinc-500 transition-colors hover:bg-white"
          >
            <X size={16} />
          </button>
        </div>
        <div className="modal-content-scroll min-h-0 flex-1 overflow-y-auto px-4 py-4 pb-[calc(env(safe-area-inset-bottom)+1.5rem)]">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}

function SettingsDialog({
  open,
  eyebrow,
  title,
  description,
  icon: Icon,
  onClose,
  children,
}: {
  open: boolean;
  eyebrow: string;
  title: string;
  description: string;
  icon: ComponentType<{ size?: number; className?: string }>;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleEscape);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-zinc-950/45 px-4 py-6 backdrop-blur-sm sm:items-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-dialog-title"
    >
      <div
        className="w-full max-w-lg rounded-[30px] border border-[#ddd6c8] bg-[#f7f2e8] p-5 shadow-[0_20px_60px_rgba(26,26,20,0.2)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/90 text-[#1D9E75]">
              <Icon size={18} />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#1D9E75]">
                {eyebrow}
              </p>
              <h2
                id="settings-dialog-title"
                className="mt-1 font-display text-xl font-semibold text-zinc-900 dark:text-zinc-50"
              >
                {title}
              </h2>
              <p className="mt-1 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                {description}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={`Close ${title}`}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#ddd6c8] bg-white/85 text-zinc-500 transition-colors hover:bg-white"
          >
            <X size={16} />
          </button>
        </div>
        <div className="mt-5">{children}</div>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { theme, resolvedTheme, setTheme } = useTheme();
  const {
    authSession,
    clearLocalData,
    cloudSyncError,
    cloudSyncStatus,
    pendingSyncCount: sessionPendingSyncCount,
    syncing,
    triggerCloudSync,
    viewer,
  } = useAppSession();
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [nextPayday, setNextPayday] = useState('');
  const [paydaySaving, setPaydaySaving] = useState(false);
  const [paydayStatus, setPaydayStatus] = useState<string | null>(null);
  const [online, setOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [importPreview, setImportPreview] = useState<{
    fileName: string;
    snapshot: LocalAppSnapshot;
  } | null>(null);
  const [importAcknowledged, setImportAcknowledged] = useState(false);
  const [importing, setImporting] = useState(false);
  const [showDeleteLocalDataConfirm, setShowDeleteLocalDataConfirm] = useState(false);
  const [deletingLocalData, setDeletingLocalData] = useState(false);
  const monthOptions = useMemo(() => buildRecentMonthOptions(6), []);
  const [activeSection, setActiveSection] = useState<SettingsSectionKey>('accounts');
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  const [accountsSummary, setAccountsSummary] = useState<AccountsSectionSummary>({
    activeCount: 0,
    archivedCount: 0,
    cashWalletName: null,
  });
  const [accountsSummaryLoading, setAccountsSummaryLoading] = useState(true);
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);
  const [lastExportAt, setLastExportAt] = useState<Date | null>(null);
  const [lastImportAt, setLastImportAt] = useState<Date | null>(null);
  const [syncNotice, setSyncNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refreshPendingCount = useCallback(async () => {
    setPendingCount(await getPendingSyncCount());
  }, []);

  const fetchBudgets = useCallback(async () => {
    try {
      const json = await getBudgets();
      setBudgets(Array.isArray(json) ? json : []);
    } catch {
      setBudgets([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchUserSettings = useCallback(async () => {
    try {
      const json = await getLocalUserSettings();
      setNextPayday(typeof json.nextPayday === 'string' ? json.nextPayday : '');
    } catch {
      setNextPayday('');
    }
  }, []);

  const fetchAccountsSummary = useCallback(async () => {
    setAccountsSummaryLoading(true);

    try {
      const json = await getAccountsWithBalances({ includeArchived: true });
      const accounts = Array.isArray(json) ? (json as AccountWithBalance[]) : [];
      const activeAccounts = accounts.filter((account) => !account.isArchived);
      const archivedAccounts = accounts.filter((account) => account.isArchived);
      const cashWalletAccount =
        activeAccounts.find((account) => account.isSystemCashWallet) ?? null;

      setAccountsSummary({
        activeCount: activeAccounts.length,
        archivedCount: archivedAccounts.length,
        cashWalletName: cashWalletAccount?.name ?? null,
      });
    } catch {
      setAccountsSummary({ activeCount: 0, archivedCount: 0, cashWalletName: null });
    } finally {
      setAccountsSummaryLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchBudgets();
    void fetchUserSettings();
    void fetchAccountsSummary();
    setOnline(navigator.onLine);

    const unsubscribeRealtime = subscribeBudgetUpdates(() => {
      void fetchBudgets();
    });
    const unsubscribeApp = subscribeAppUpdates((message) => {
      void refreshPendingCount();

      if (isSyncStateRealtimeUpdate(message)) {
        return;
      }

      void fetchBudgets();
      void fetchAccountsSummary();
    });

    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    void refreshPendingCount();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      unsubscribeRealtime();
      unsubscribeApp();
    };
  }, [fetchAccountsSummary, fetchBudgets, fetchUserSettings, refreshPendingCount]);

  useEffect(() => {
    setPendingCount(sessionPendingSyncCount);
  }, [sessionPendingSyncCount]);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(min-width: 1024px)');
    const handleChange = (event: MediaQueryListEvent) => {
      if (event.matches) setMobileSheetOpen(false);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  useEffect(() => {
    const requestedSection = searchParams.get('section');
    if (
      requestedSection === 'accounts' ||
      requestedSection === 'budgets' ||
      requestedSection === 'payday' ||
      requestedSection === 'security' ||
      requestedSection === 'sync-data' ||
      requestedSection === 'appearance'
    ) {
      setActiveSection(requestedSection);
    }
  }, [searchParams]);

  const handleSavePayday = async () => {
    setPaydaySaving(true);
    setPaydayStatus(null);

    try {
      await saveLocalUserSettings({ nextPayday: nextPayday || null });
      setPaydayStatus('Payday saved.');
    } catch {
      setPaydayStatus('Failed to save payday.');
    } finally {
      setPaydaySaving(false);
      window.setTimeout(() => setPaydayStatus(null), 3000);
    }
  };

  const handleSync = async () => {
    if (!authSession.authenticated) {
      return;
    }

    try {
      setSyncNotice(null);
      await triggerCloudSync();
      await refreshPendingCount();
      setLastSyncAt(new Date());
      setSyncNotice({ tone: 'success', text: 'Backup completed.' });
    } catch (error) {
      setSyncNotice({
        tone: 'error',
        text: error instanceof Error ? error.message : 'Failed to back up changes.',
      });
    } finally {
      window.setTimeout(() => setSyncNotice(null), 5000);
    }
  };

  const handleExportJSON = async () => {
    try {
      const snapshot = await exportLocalSnapshot();
      const blob = new Blob([JSON.stringify(snapshot, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `moneda-device-backup-${format(new Date(), 'yyyy-MM-dd')}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      setLastExportAt(new Date());
    } catch {
      // offline
    }
  };

  const handleImportJSON = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setImportStatus('Reading backup...');
    setImportPreview(null);
    setImportAcknowledged(false);

    try {
      const text = await file.text();
      const snapshot = parseImportedLocalSnapshot(JSON.parse(text));
      if (!snapshot) {
        setImportStatus('Invalid file format.');
        return;
      }

      setImportPreview({ fileName: file.name, snapshot });
      setImportStatus('Backup ready to review.');
    } catch {
      setImportStatus('Failed to read the file. Make sure it is a valid JSON export.');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleConfirmImport = async () => {
    if (!importPreview) {
      return;
    }

    setImporting(true);
    setImportStatus('Importing...');

    try {
      await replaceLocalSnapshot(importPreview.snapshot, {
        preserveDeviceIdentity: true,
        source: 'device',
      });
      await Promise.all([fetchBudgets(), fetchUserSettings(), fetchAccountsSummary()]);
      await refreshPendingCount();
      if (authSession.authenticated) {
        await triggerCloudSync({ quiet: true });
        setLastSyncAt(new Date());
      }

      setImportStatus('Backup restored on this device.');
      setLastImportAt(new Date());
      setImportPreview(null);
      setImportAcknowledged(false);
    } catch {
      setImportStatus('Failed to import. Make sure the file is a valid JSON export.');
    } finally {
      setImporting(false);
      window.setTimeout(() => setImportStatus(null), 5000);
    }
  };

  const importPreviewSummary = useMemo(
    () => (importPreview ? getLocalAppSnapshotSummary(importPreview.snapshot) : null),
    [importPreview],
  );

  const importPreviewDate = useMemo(() => {
    if (!importPreview) {
      return null;
    }

    return parseDateValue(importPreview.snapshot.exportedAt);
  }, [importPreview]);

  const clearImportPreview = useCallback(() => {
    if (importing) {
      return;
    }

    setImportPreview(null);
    setImportAcknowledged(false);
    setImportStatus(null);
  }, [importing]);

  const handleDeleteLocalData = useCallback(async () => {
    if (deletingLocalData) {
      return;
    }

    setDeletingLocalData(true);

    try {
      await clearLocalData();
      setShowDeleteLocalDataConfirm(false);
      router.replace('/');
    } finally {
      setDeletingLocalData(false);
    }
  }, [clearLocalData, deletingLocalData, router]);

  const monthBudgets = useMemo(() => {
    return budgets
      .filter((budget) => budget.month === month)
      .sort(compareBudgetScopes);
  }, [budgets, month]);

  const nextPaydayDate = parseDateValue(nextPayday);
  const formattedBudgetMonth = format(new Date(`${month}-01`), 'MMMM yyyy');
  const berdeSettingsContext = resolveSettingsBerdeContext({
    loading,
    monthBudgets,
  });
  const rolloverBudgetCount = monthBudgets.filter((budget) => budget.rollover).length;
  const budgetSummary = useMemo(
    () => buildBudgetMonthSummary([], budgets, month),
    [budgets, month]
  );
  const lastCloudBackupAt = useMemo(() => {
    const serverTimestamp = parseDateValue(cloudSyncStatus?.lastUpdatedAt ?? '');
    return serverTimestamp ?? lastSyncAt;
  }, [cloudSyncStatus?.lastUpdatedAt, lastSyncAt]);
  const backupStorageAvailable = cloudSyncStatus?.backupStorageAvailable !== false;
  const backupAlert = syncNotice
    ? syncNotice
    : authSession.authenticated && (cloudSyncStatus?.issueMessage || cloudSyncError)
      ? {
          tone: 'error' as const,
          text: cloudSyncStatus?.issueMessage ?? cloudSyncError ?? 'Cloud backup is unavailable.',
        }
      : null;
  const syncHeadline = !online
    ? 'Offline mode active'
    : !authSession.authenticated
      ? 'Device-only mode'
      : backupStorageAvailable
        ? 'Connected'
        : 'Connected, backup unavailable';
  const syncSummaryText = authSession.authenticated
    ? !backupStorageAvailable
      ? 'Your account is connected, but cloud backup writes are unavailable until the backup storage is installed.'
      : pendingCount > 0
        ? `${formatPendingChanges(pendingCount)} waiting to back up.`
        : cloudSyncStatus?.hasBackup
          ? 'Your latest cloud backup is up to date.'
          : 'No cloud backup has been saved yet.'
    : 'Everything stays on this device until you connect backup and sync.';
  const syncDetailText = authSession.authenticated
    ? lastCloudBackupAt
      ? `Last cloud backup: ${format(lastCloudBackupAt, 'PP p')}`
      : 'No cloud backup yet'
    : 'Stored only on this device right now';
  const pendingTileHelper = authSession.authenticated
    ? pendingCount > 0
      ? 'Waiting to back up'
      : backupStorageAvailable
        ? 'All changes backed up'
        : 'Changes stay local for now'
    : 'Local-only changes';
  const backupTile = !authSession.authenticated
    ? { value: 'Device only', helper: 'No account linked', accent: false }
    : !online
      ? { value: 'Offline', helper: 'Backups resume when reconnected', accent: false }
      : !backupStorageAvailable
        ? { value: 'Unavailable', helper: 'Server backup storage needs setup', accent: false }
        : syncing
          ? { value: 'Syncing', helper: 'Uploading your latest device snapshot', accent: true }
          : cloudSyncStatus?.hasBackup
            ? {
                value: 'Backed up',
                helper: lastCloudBackupAt
                  ? `Updated ${format(lastCloudBackupAt, 'MMM d, p')}`
                  : 'Cloud snapshot saved',
                accent: true,
              }
            : {
                value: pendingCount > 0 ? 'Needs backup' : 'Ready',
                helper: pendingCount > 0 ? 'Manual backup available now' : 'No cloud snapshot saved yet',
                accent: false,
              };
  const syncStatusText = authSession.authenticated
    ? !online
      ? 'Offline mode'
      : !backupStorageAvailable
        ? 'Backup unavailable'
        : pendingCount > 0
          ? `${pendingCount} pending`
          : syncing
            ? 'Syncing now'
            : cloudSyncStatus?.hasBackup
              ? 'Backed up'
              : 'Needs backup'
    : viewer.storageCopy;
  const appearanceSummaryText =
    theme === 'system'
      ? 'System theme'
      : theme === 'dark'
        ? 'Dark theme'
        : 'Light theme';

  const navItems: SettingsNavItem[] = [
    {
      id: 'accounts',
      title: 'Accounts',
      summary:
        accountsSummary.activeCount === 1
          ? '1 active account'
          : `${accountsSummary.activeCount} active accounts`,
      status:
        accountsSummary.archivedCount > 0
          ? `${accountsSummary.archivedCount} archived hidden`
          : 'Active first',
      description:
        'Keep everyday wallets front and center here. Archived accounts stay tucked away until you need them.',
      eyebrow: 'Accounts & Money',
      group: 'Accounts & Money',
      icon: Wallet,
    },
    {
      id: 'budgets',
      title: 'Budgets',
      summary:
        budgetSummary.scopedBudgetCount === 0
          ? 'No monthly budgets configured'
          : budgetSummary.scopedBudgetCount === 1
            ? '1 monthly budget configured'
            : `${budgetSummary.scopedBudgetCount} monthly budgets configured`,
      status: budgetSummary.hasOverallBudget ? 'Overall cap ready' : 'Needs overall cap',
      description:
        'Budgets now live in a dedicated workspace, while Settings keeps a lighter summary and handoff.',
      eyebrow: 'Accounts & Money',
      group: 'Accounts & Money',
      icon: PiggyBank,
    },
    {
      id: 'payday',
      title: 'Payday',
      summary: nextPaydayDate ? `Next payday: ${format(nextPaydayDate, 'MMM d')}` : 'No payday scheduled yet',
      status: nextPaydayDate ? 'Scheduled' : 'Needs setup',
      description:
        'Keep payday light and useful so you can quickly confirm what date anchors the next planning cycle.',
      eyebrow: 'Accounts & Money',
      group: 'Accounts & Money',
      icon: CalendarDays,
    },
    {
      id: 'security',
      title: 'Security',
      summary: authSession.authenticated ? 'Password and account protection' : 'Optional cloud account',
      status: authSession.authenticated ? 'Cloud account linked' : 'Local only',
      description:
        'Profile, password, and session controls stay clear and trustworthy, with room to grow into stronger device security later.',
      eyebrow: 'Security & Sync',
      group: 'Security & Sync',
      icon: Shield,
    },
    {
      id: 'sync-data',
      title: 'Sync & Data',
      summary: authSession.authenticated ? 'Backup, export, and import' : 'Export, import, and optional backup',
      status: syncStatusText,
      description:
        'Sync health, backups, exports, and imports are grouped together, with risky data moves kept visually separate.',
      eyebrow: 'Security & Sync',
      group: 'Security & Sync',
      icon: Database,
    },
    {
      id: 'appearance',
      title: 'Appearance',
      summary: appearanceSummaryText,
      status: `Currently ${resolvedTheme}`,
      description:
        'Appearance stays lightweight so it feels polished without competing with your financial controls.',
      eyebrow: 'Data & Appearance',
      group: 'Data & Appearance',
      icon: Palette,
    },
  ];

  const groupedNavItems: Array<{ group: SettingsGroup; items: SettingsNavItem[] }> = [
    { group: 'Accounts & Money', items: navItems.filter((item) => item.group === 'Accounts & Money') },
    { group: 'Security & Sync', items: navItems.filter((item) => item.group === 'Security & Sync') },
    { group: 'Data & Appearance', items: navItems.filter((item) => item.group === 'Data & Appearance') },
  ];

  const activeItem = navItems.find((item) => item.id === activeSection) ?? navItems[0];
  const openSection = (section: SettingsSectionKey) => {
    setActiveSection(section);
    if (window.matchMedia('(min-width: 1024px)').matches) {
      setMobileSheetOpen(false);
      return;
    }
    setMobileSheetOpen(true);
  };

  const handleAccountsSummaryChange = useCallback((summary: AccountsSectionSummary) => {
    setAccountsSummary((current) => {
      if (
        current.activeCount === summary.activeCount &&
        current.archivedCount === summary.archivedCount &&
        current.cashWalletName === summary.cashWalletName
      ) {
        return current;
      }

      return summary;
    });
    setAccountsSummaryLoading(false);
  }, []);

  const renderSectionContent = (section: SettingsSectionKey) => {
    if (section === 'accounts') {
      return <AccountsSection onSummaryChange={handleAccountsSummaryChange} />;
    }

    if (section === 'budgets') {
      return (
        <div className="space-y-5">
          <div className="grid gap-3 md:grid-cols-3">
            <SummaryTile
              label="Configured"
              value={loading ? '...' : String(budgetSummary.scopedBudgetCount)}
              helper={formattedBudgetMonth}
              loading={loading}
            />
            <SummaryTile
              label="Overall budget"
              value={
                loading
                  ? '...'
                  : budgetSummary.hasOverallBudget
                    ? formatCurrency(budgetSummary.overallConfiguredLimit)
                    : 'Missing'
              }
              helper={
                budgetSummary.hasOverallBudget
                  ? 'Main monthly cap is active'
                  : 'Add an Overall budget first'
              }
              loading={loading}
              accent={budgetSummary.hasOverallBudget}
            />
            <SummaryTile
              label="Category plan"
              value={loading ? '...' : formatCurrency(budgetSummary.additiveCategoryPlannedTotal)}
              helper={
                budgetSummary.hasPlanningMismatch
                  ? `${formatCurrency(budgetSummary.planningMismatchAmount)} above the Overall cap`
                  : 'Additive total after overlap rules'
              }
              loading={loading}
              accent={budgetSummary.hasPlanningMismatch}
            />
          </div>

          <SettingsSurface
            eyebrow="Budgets"
            title={`Budget workspace for ${formattedBudgetMonth}`}
            description="Budget planning now lives in one dedicated workspace, so Settings only keeps a light summary and the jump-off point."
            action={
              <div className="flex flex-col gap-2 sm:flex-row">
                <select
                  value={month}
                  onChange={(event) => setMonth(event.target.value)}
                  className="min-h-11 rounded-full border border-[#ddd6c8] bg-[#fbf8f1] px-4 text-sm text-zinc-700 outline-none transition focus:border-[#1D9E75]"
                >
                  {monthOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <Link
                  href={`/budgets?month=${month}`}
                  className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full bg-[#1D9E75] px-4 text-sm font-medium text-white transition-colors hover:bg-[#187f5d]"
                >
                  Open budget workspace
                  <ChevronRight size={14} />
                </Link>
              </div>
            }
          >
            <div className="rounded-[24px] border border-[#e8dfd0] bg-[#fbf8f1] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
                This month at a glance
              </p>
              <div className="mt-4 grid gap-3 text-sm text-zinc-600 sm:grid-cols-2">
                <div className="flex items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3">
                  <span>Month</span>
                  <span className="font-medium text-zinc-900">{formattedBudgetMonth}</span>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3">
                  <span>Overall budget</span>
                  <span className="font-medium text-zinc-900">
                    {loading
                      ? '...'
                      : budgetSummary.hasOverallBudget
                        ? formatCurrency(budgetSummary.overallConfiguredLimit)
                        : 'Missing'}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3">
                  <span>Rollover enabled</span>
                  <span className="font-medium text-zinc-900">{loading ? '...' : rolloverBudgetCount}</span>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3">
                  <span>Overlap warnings</span>
                  <span className="font-medium text-zinc-900">{loading ? '...' : budgetSummary.overlapCount}</span>
                </div>
              </div>

              <p className="mt-4 text-sm leading-6 text-zinc-500">
                The budgets page now handles month switching, copy-forward planning, overlap warnings,
                and category coverage, so people can understand the whole budget model without digging
                through Settings first.
              </p>
            </div>
          </SettingsSurface>
        </div>
      );
    }

    if (section === 'payday') {
      return (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <SettingsSurface
            eyebrow="Payday"
            title={nextPaydayDate ? format(nextPaydayDate, 'EEEE, MMMM d') : 'No payday scheduled'}
            description="Keep this lightweight. A clear date is enough to anchor planning without turning payday into a heavy settings flow."
          >
            <div className="rounded-[24px] border border-[#e8dfd0] bg-[#fbf8f1] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
                Preview
              </p>
              <p className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
                {nextPaydayDate ? format(nextPaydayDate, 'MMM d') : '--'}
              </p>
              <p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                {nextPaydayDate
                  ? 'Your next planning checkpoint is ready.'
                  : 'Choose a payday date so budgets and planning feel anchored to something real.'}
              </p>
            </div>
          </SettingsSurface>

          <SettingsSurface
            eyebrow="Payday editor"
            title="Update the next payday"
            description="A simple date field keeps this section quick to scan on mobile and easy to confirm on desktop."
          >
            <div className="space-y-4 rounded-[26px] border border-[#e8dfd0] bg-[#fbf8f1] p-4">
              <div>
                <label
                  htmlFor="next-payday"
                  className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500"
                >
                  Next payday
                </label>
                <input
                  id="next-payday"
                  type="date"
                  value={nextPayday}
                  onChange={(event) => setNextPayday(event.target.value)}
                  className="mt-2 min-h-11 w-full rounded-2xl border border-[#ddd6c8] bg-white px-4 text-sm text-zinc-700 outline-none transition focus:border-[#1D9E75]"
                />
              </div>

              <div className="rounded-2xl border border-white/90 bg-white/75 px-4 py-3 text-sm text-zinc-600">
                {nextPaydayDate ? (
                  <p>
                    Preview: <span className="font-medium text-zinc-900">{format(nextPaydayDate, 'PPP')}</span>
                  </p>
                ) : (
                  <p>Pick a date to preview the next payday.</p>
                )}
              </div>

              {paydayStatus ? (
                <p className="inline-flex items-center gap-2 rounded-full bg-[#eef7f0] px-3 py-2 text-sm text-[#1D9E75]">
                  <CheckCircle2 size={14} />
                  {paydayStatus}
                </p>
              ) : null}

              <button
                type="button"
                onClick={() => void handleSavePayday()}
                disabled={paydaySaving}
                className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#1D9E75] px-5 text-sm font-medium text-white transition-colors hover:bg-[#187f5d] disabled:opacity-60"
              >
                {paydaySaving ? 'Saving...' : 'Save payday'}
              </button>
            </div>
          </SettingsSurface>
        </div>
      );
    }

    if (section === 'security') {
      if (authSession.authenticated) {
        return <AccountSecuritySection />;
      }

      return (
        <div className="space-y-5">
          <SettingsSurface
            eyebrow="Security"
            title="This device is local-first"
            description="You can keep using Moneda without an account. Sign in only if you want cloud backup, sync, and account-level security controls."
          >
            <div className="rounded-[24px] border border-[#e8dfd0] bg-[#fbf8f1] p-4">
              <p className="text-sm leading-6 text-zinc-600">
                Your data is currently stored on this device. Linking an account adds backup, restore, and multi-device sync without replacing local access.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  href="/auth/login"
                  className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#1D9E75] px-4 text-sm font-medium text-white transition-colors hover:bg-[#187f5d]"
                >
                  Add backup and sync
                </Link>
                <Link
                  href="/auth/signup"
                  className="inline-flex min-h-11 items-center justify-center rounded-full border border-[#d9d1c2] bg-white px-4 text-sm font-medium text-zinc-700 transition-colors hover:bg-[#f5f1e8]"
                >
                  Create account
                </Link>
              </div>
            </div>
          </SettingsSurface>

          <SettingsSurface
            eyebrow="Delete local data"
            title="Remove this device profile"
            description="If you no longer want Moneda data stored on this device, you can wipe the local profile and start fresh."
            className="border-red-200/80 bg-red-50/40"
          >
            <div className="rounded-[24px] border border-red-200 bg-white/85 p-4">
              <p className="text-sm leading-6 text-zinc-600">
                This deletes the local-first profile, accounts, transactions, budgets, savings goals, savings entries, debts, and device settings stored on this device. It does not delete any optional cloud account because none is linked here.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setShowDeleteLocalDataConfirm(true)}
                  className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full bg-red-600 px-4 text-sm font-medium text-white transition-colors hover:bg-red-500"
                >
                  <Eraser size={14} />
                  Delete local device data
                </button>
              </div>
            </div>
          </SettingsSurface>
        </div>
      );
    }

    if (section === 'sync-data') {
      return (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <SettingsSurface
            eyebrow="Sync"
            title="Connection and backup status"
            description="Keep sync readable at a glance, then separate calmer export tasks from the riskier import path."
          >
            <div className="space-y-4">
              <div className="rounded-[24px] border border-[#e8dfd0] bg-[#fbf8f1] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
                      Current state
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      {online ? (
                        <Wifi size={16} className="text-[#1D9E75]" />
                      ) : (
                        <WifiOff size={16} className="text-amber-600" />
                      )}
                      <p className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
                        {syncHeadline}
                      </p>
                    </div>
                    <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                      {syncSummaryText}
                    </p>
                    <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                      {syncDetailText}
                    </p>
                  </div>

                  {authSession.authenticated ? (
                    <button
                      type="button"
                      onClick={() => void handleSync()}
                      disabled={syncing || !online || !backupStorageAvailable}
                      className="inline-flex min-h-10 items-center justify-center rounded-full border border-[#d9d1c2] bg-white px-4 text-sm font-medium text-zinc-700 transition-colors hover:bg-[#f5f1e8]"
                    >
                      {syncing ? 'Backing up...' : 'Backup now'}
                    </button>
                  ) : (
                    <Link
                      href="/auth/login"
                      className="inline-flex min-h-10 items-center justify-center rounded-full border border-[#d9d1c2] bg-white px-4 text-sm font-medium text-zinc-700 transition-colors hover:bg-[#f5f1e8]"
                    >
                      Connect backup
                    </Link>
                  )}
                </div>

                {backupAlert ? (
                  <div
                    className={`mt-4 flex items-start gap-2 rounded-[20px] px-3 py-3 text-sm ${
                      backupAlert.tone === 'success'
                        ? 'bg-emerald-50 text-emerald-800'
                        : 'bg-amber-50 text-amber-900'
                    }`}
                  >
                    {backupAlert.tone === 'success' ? (
                      <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
                    ) : (
                      <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                    )}
                    <p>{backupAlert.text}</p>
                  </div>
                ) : null}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <SummaryTile
                  label="Pending"
                  value={String(pendingCount)}
                  helper={pendingTileHelper}
                  accent={pendingCount === 0 && backupStorageAvailable}
                />
                <SummaryTile
                  label="Backup"
                  value={backupTile.value}
                  helper={backupTile.helper}
                  accent={backupTile.accent}
                />
              </div>
            </div>
          </SettingsSurface>

          <div className="space-y-5">
            <SettingsSurface
              eyebrow="Export"
              title="Create a backup"
              description="Keep exports calm and repeatable so backing up your data never feels hidden."
              action={
                <button
                  type="button"
                  onClick={() => void handleExportJSON()}
                  className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full bg-[#1D9E75] px-4 text-sm font-medium text-white transition-colors hover:bg-[#187f5d]"
                >
                  <Download size={14} />
                  Export JSON
                </button>
              }
            >
              <div className="rounded-[24px] border border-[#e8dfd0] bg-[#fbf8f1] px-4 py-4 text-sm text-zinc-600">
                <p className="font-medium text-zinc-900 dark:text-zinc-50">Portable device backup</p>
                <p className="mt-2 leading-6">
                  Includes your accounts, transactions, budgets, savings goals, savings deposits, debts, and local device settings in one JSON backup.
                </p>
                <p className="mt-2">
                  {lastExportAt
                    ? `Last export: ${format(lastExportAt, 'PP p')}`
                    : 'No export yet in this session'}
                </p>
              </div>
            </SettingsSurface>

            <SettingsSurface
              eyebrow="Import"
              title="Bring in a previous backup"
              description="Imports are intentionally separated so it is obvious that this action changes your data."
              className="border-amber-200/80 bg-[#fffaf1]"
            >
              <div className="rounded-[24px] border border-amber-200/80 bg-white/85 p-4">
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                  JSON import
                </p>
                <p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                  Use a Moneda device backup JSON. Import replaces the current local snapshot on this device.
                </p>
                <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                  {lastImportAt
                    ? `Last import: ${format(lastImportAt, 'PP p')}`
                    : 'No import yet in this session'}
                </p>

                {importStatus ? (
                  <p className="mt-3 rounded-2xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
                    {importStatus}
                  </p>
                ) : null}

                <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full border border-amber-200 px-4 text-sm font-medium text-amber-800 transition-colors hover:bg-amber-50"
                  >
                    <Upload size={14} />
                    {importPreview ? 'Choose another JSON file' : 'Choose JSON file'}
                  </button>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">
                    Review the backup first, then confirm restore when the counts look right.
                  </span>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/json"
                  className="hidden"
                  onChange={handleImportJSON}
                />
              </div>
            </SettingsSurface>
          </div>
        </div>
      );
    }

    if (section === 'appearance') {
      return (
        <div className="space-y-5">
          <SettingsSurface
            eyebrow="Appearance"
            title="Theme preference"
            description="Appearance should feel polished but secondary, with a clear choice between following your device or setting a specific theme."
          >
            <div className="grid gap-3 sm:grid-cols-3">
              {([
                { value: 'system', label: 'System', helper: 'Follow your device', icon: Monitor },
                { value: 'light', label: 'Light', helper: 'Warm daylight surfaces', icon: Sun },
                { value: 'dark', label: 'Dark', helper: 'Low-light focus', icon: Moon },
              ] as const).map((option) => {
                const Icon = option.icon;
                const selected = theme === option.value;

                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setTheme(option.value)}
                    className={`rounded-[24px] border px-4 py-4 text-left transition-colors ${
                      selected
                        ? 'border-[#1D9E75] bg-[#edf7f1]'
                        : 'border-[#e8dfd0] bg-[#fbf8f1] hover:border-[#1D9E75]/40'
                    }`}
                  >
                    <span
                      className={`inline-flex h-10 w-10 items-center justify-center rounded-2xl ${
                        selected ? 'bg-white text-[#1D9E75]' : 'bg-white/85 text-zinc-600'
                      }`}
                    >
                      <Icon size={18} />
                    </span>
                    <p className="mt-3 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                      {option.label}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                      {option.helper}
                    </p>
                  </button>
                );
              })}
            </div>
          </SettingsSurface>

          <div className="grid gap-3 md:grid-cols-2">
            <SummaryTile label="Selected" value={appearanceSummaryText} helper="Your saved preference" />
            <SummaryTile
              label="Applied right now"
              value={resolvedTheme === 'dark' ? 'Dark mode' : 'Light mode'}
              helper={
                theme === 'system'
                  ? 'Resolved from your device preference'
                  : 'Using your saved theme selection'
              }
              accent
            />
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <>
      <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-6">
        <header className="relative overflow-hidden rounded-[36px] border border-[#e2d9c9] bg-[linear-gradient(180deg,rgba(255,250,242,0.98)_0%,rgba(246,238,226,0.96)_100%)] p-5 shadow-[0_20px_60px_rgba(48,41,27,0.08)] sm:p-6">
          <div className="pointer-events-none absolute -right-10 top-0 h-48 w-48 rounded-full bg-amber-200/25 blur-3xl" />
          <div className="pointer-events-none absolute bottom-0 left-0 h-32 w-32 rounded-full bg-emerald-200/20 blur-3xl" />

          <div className="relative z-10">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-2xl">
                <div className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#1D9E75] shadow-[0_8px_20px_rgba(29,158,117,0.08)]">
                  <SettingsIcon size={12} />
                  Moneda settings workspace
                </div>
                <h1 className="mt-4 font-display text-[2rem] font-semibold text-zinc-900 dark:text-zinc-50 sm:text-[2.4rem]">
                  Settings
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-zinc-600 dark:text-zinc-300">
                  A warmer, calmer place for active accounts, budgets, payday rules, security, sync, and appearance. Financial controls stay first. Maintenance stays tidy.
                </p>

              </div>

              <div className="w-full max-w-xl rounded-[28px] border border-white/80 bg-white/65 p-4 backdrop-blur-sm">
                <div className="flex items-start gap-3">
                  <div className="rounded-2xl bg-white/90 p-2 shadow-[0_10px_24px_rgba(29,158,117,0.08)]">
                    <BerdeSprite state={berdeSettingsContext.state} size={38} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#1D9E75]">
                      Berde
                    </p>
                    <p className="mt-1 text-sm leading-6 text-zinc-700 dark:text-zinc-200">
                      {berdeSettingsContext.message}
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <SummaryTile
                    label="Accounts"
                    value={accountsSummaryLoading ? '...' : String(accountsSummary.activeCount)}
                    helper="Active right now"
                    loading={accountsSummaryLoading}
                  />
                  <SummaryTile
                    label="Budgets"
                    value={loading ? '...' : String(monthBudgets.length)}
                    helper={formattedBudgetMonth}
                    loading={loading}
                  />
                  <SummaryTile
                    label="Payday"
                    value={nextPaydayDate ? format(nextPaydayDate, 'MMM d') : '--'}
                    helper={nextPaydayDate ? 'Next payday' : 'Not scheduled'}
                    accent={Boolean(nextPaydayDate)}
                  />
                  <SummaryTile
                    label="Sync"
                    value={syncStatusText}
                    helper={online ? 'Connection looks good' : 'Working locally for now'}
                    accent={online && pendingCount === 0}
                  />
                </div>
              </div>
            </div>
          </div>
        </header>

        <div className="mt-6 hidden gap-5 lg:grid lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside>
            <div className="sticky top-24 rounded-[32px] border border-[#e2d9c9] bg-white/88 p-4 shadow-[0_14px_40px_rgba(42,42,28,0.05)]">
              {groupedNavItems.map((group, groupIndex) => (
                <div
                  key={group.group}
                  className={groupIndex > 0 ? 'mt-5 border-t border-[#efe7d8] pt-5' : ''}
                >
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
                    {group.group}
                  </p>
                  <div className="mt-3 space-y-2">
                    {group.items.map((item) => (
                      <DesktopNavButton
                        key={item.id}
                        item={item}
                        active={item.id === activeSection}
                        onClick={() => openSection(item.id)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </aside>

          <section className="rounded-[32px] border border-[#e2d9c9] bg-[#fbf8f1] shadow-[0_14px_40px_rgba(42,42,28,0.05)]">
            <div className="border-b border-[#ece3d4] px-5 py-5 sm:px-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#1D9E75]">
                    {activeItem.eyebrow}
                  </p>
                  <h2 className="mt-2 font-display text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
                    {activeItem.title}
                  </h2>
                  <p className="mt-2 max-w-2xl text-sm leading-7 text-zinc-500 dark:text-zinc-400">
                    {activeItem.description}
                  </p>
                </div>
                {activeItem.status ? (
                  <span className="inline-flex rounded-full bg-white px-3 py-2 text-sm font-medium text-[#1D9E75]">
                    {activeItem.status}
                  </span>
                ) : null}
              </div>
            </div>

            <div className="p-4 sm:p-6">{renderSectionContent(activeSection)}</div>
          </section>
        </div>

        <div className="mt-6 space-y-6 lg:hidden">
          {groupedNavItems.map((group) => (
            <section key={group.group}>
              <div className="mb-3 px-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
                  {group.group}
                </p>
              </div>
              <div className="space-y-3">
                {group.items.map((item) => (
                  <MobileIndexRow
                    key={item.id}
                    item={item}
                    onClick={() => openSection(item.id)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>

      <SettingsSheet
        open={mobileSheetOpen}
        eyebrow={activeItem.eyebrow}
        title={activeItem.title}
        description={activeItem.description}
        icon={activeItem.icon}
        onClose={() => setMobileSheetOpen(false)}
      >
        {renderSectionContent(activeSection)}
      </SettingsSheet>

      <SettingsDialog
        open={Boolean(importPreview && importPreviewSummary)}
        eyebrow="Import Review"
        title="Review backup before restore"
        description="This backup will replace the current local snapshot on this device. Confirm the counts and acknowledge the replacement before restoring."
        icon={Database}
        onClose={clearImportPreview}
      >
        {importPreview && importPreviewSummary ? (
          <div className="space-y-4">
            <div className="rounded-[24px] border border-amber-200/80 bg-[#fffaf1] p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                    Selected backup
                  </p>
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    {importPreview.fileName}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    {importPreviewDate
                      ? `Exported ${format(importPreviewDate, 'PP p')}`
                      : 'Export date unavailable'}
                  </p>
                </div>
                <span className="inline-flex rounded-full bg-white px-2.5 py-1 text-[11px] font-medium text-amber-800">
                  Local data will be replaced
                </span>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <SummaryTile
                  label="Accounts"
                  value={String(importPreviewSummary.accountCount)}
                  helper="Wallets and account balances"
                />
                <SummaryTile
                  label="Transactions"
                  value={String(importPreviewSummary.transactionCount)}
                  helper="Expenses, income, and savings activity"
                />
                <SummaryTile
                  label="Budgets"
                  value={String(importPreviewSummary.budgetCount)}
                  helper="Monthly limits and rollover rules"
                />
                <SummaryTile
                  label="Savings Goals"
                  value={String(importPreviewSummary.savingsGoalCount)}
                  helper="Goal targets and progress"
                />
                <SummaryTile
                  label="Savings Entries"
                  value={String(importPreviewSummary.savingsDepositCount)}
                  helper="Deposits and withdrawals"
                />
                <SummaryTile
                  label="Debts"
                  value={String(importPreviewSummary.debtCount)}
                  helper="Outstanding and settled debt logs"
                />
              </div>
            </div>

            <div className="rounded-[24px] border border-red-200 bg-red-50/80 p-4">
              <p className="text-sm font-semibold text-red-900">Restore safeguard</p>
              <p className="mt-2 text-sm leading-6 text-red-800">
                Restoring this backup overwrites the current local accounts, transactions, budgets, savings data, and debts stored on this device. This does not merge records.
              </p>
              <label className="mt-4 flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={importAcknowledged}
                  onChange={(event) => setImportAcknowledged(event.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-red-300 text-red-600 focus:ring-red-500"
                  disabled={importing}
                />
                <span className="text-sm text-red-900">
                  I understand this will replace the current local data on this device with the contents of
                  {' '}
                  <strong>{importPreview.fileName}</strong>.
                </span>
              </label>
            </div>

            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={importing}
                className="inline-flex min-h-11 items-center justify-center rounded-full border border-[#ddd6c8] bg-white px-4 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Choose another backup
              </button>
              <button
                type="button"
                onClick={clearImportPreview}
                disabled={importing}
                className="inline-flex min-h-11 items-center justify-center rounded-full border border-[#ddd6c8] bg-white px-4 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmImport()}
                disabled={importing || !importAcknowledged}
                className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full bg-red-600 px-4 text-sm font-medium text-white transition-colors hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Upload size={14} />
                {importing ? 'Restoring backup...' : 'Replace local data with this backup'}
              </button>
            </div>
          </div>
        ) : null}
      </SettingsDialog>

      <ConfirmModal
        open={showDeleteLocalDataConfirm}
        title="Delete local device data?"
        message="This removes the current device profile and all locally stored Moneda data on this device. This action does not merge or archive anything for recovery."
        confirmLabel={deletingLocalData ? 'Deleting...' : 'Delete local data'}
        onConfirm={() => {
          void handleDeleteLocalData();
        }}
        onCancel={() => {
          if (!deletingLocalData) {
            setShowDeleteLocalDataConfirm(false);
          }
        }}
      />
    </>
  );
}
