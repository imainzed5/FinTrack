'use client';

import { useSearchParams } from 'next/navigation';
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
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Database,
  Download,
  Monitor,
  Moon,
  Palette,
  PiggyBank,
  Plus,
  Settings as SettingsIcon,
  Shield,
  Sun,
  Trash2,
  Upload,
  Wallet,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import AccountSecuritySection from '@/components/settings/AccountSecuritySection';
import AccountsSection, {
  type AccountsSectionSummary,
} from '@/components/settings/AccountsSection';
import BerdeSprite from '@/components/BerdeSprite';
import { useTheme } from '@/components/ThemeProvider';
import type { BerdeState } from '@/lib/berde/berde.types';
import { subscribeBudgetUpdates } from '@/lib/transaction-ws';
import type { AccountWithBalance, Budget, Category, Transaction } from '@/lib/types';
import { CATEGORIES } from '@/lib/types';
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

function resolveSettingsBerdeContext(params: {
  loading: boolean;
  showBudgetComposer: boolean;
  monthBudgets: Budget[];
}): { state: BerdeState; message: string } {
  const { loading, showBudgetComposer, monthBudgets } = params;

  if (loading || showBudgetComposer) {
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
  const searchParams = useSearchParams();
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);
  const [showBudgetComposer, setShowBudgetComposer] = useState(false);
  const [newCategory, setNewCategory] = useState<Category | 'Overall'>('Overall');
  const [newSubCategory, setNewSubCategory] = useState('');
  const [newLimit, setNewLimit] = useState('');
  const [newRollover, setNewRollover] = useState(false);
  const [month, setMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [nextPayday, setNextPayday] = useState('');
  const [paydaySaving, setPaydaySaving] = useState(false);
  const [paydayStatus, setPaydayStatus] = useState<string | null>(null);
  const [online, setOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [importStatus, setImportStatus] = useState<string | null>(null);
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchBudgets = useCallback(async () => {
    try {
      const response = await fetch('/api/budgets');
      const json = await response.json();
      setBudgets(Array.isArray(json) ? json : []);
    } catch {
      setBudgets([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchUserSettings = useCallback(async () => {
    try {
      const response = await fetch('/api/user-settings');
      if (!response.ok) return;
      const json = await response.json();
      setNextPayday(typeof json.next_payday === 'string' ? json.next_payday : '');
    } catch {
      // offline
    }
  }, []);

  const fetchAccountsSummary = useCallback(async () => {
    setAccountsSummaryLoading(true);

    try {
      const response = await fetch('/api/accounts?includeArchived=true', {
        cache: 'no-store',
      });
      const json = await response.json();
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

    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    async function checkPending() {
      try {
        const { getPendingTransactions } = await import('@/lib/indexeddb');
        const pending = await getPendingTransactions();
        setPendingCount(pending.length);
      } catch {
        setPendingCount(0);
      }
    }

    void checkPending();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      unsubscribeRealtime();
    };
  }, [fetchAccountsSummary, fetchBudgets, fetchUserSettings]);

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
      const response = await fetch('/api/user-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ next_payday: nextPayday || null }),
      });

      setPaydayStatus(response.ok ? 'Payday saved.' : 'Failed to save payday.');
    } catch {
      setPaydayStatus('Failed to save payday.');
    } finally {
      setPaydaySaving(false);
      window.setTimeout(() => setPaydayStatus(null), 3000);
    }
  };

  const closeBudgetComposer = () => {
    setShowBudgetComposer(false);
    setNewCategory('Overall');
    setNewSubCategory('');
    setNewLimit('');
    setNewRollover(false);
  };

  const handleAddBudget = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!newLimit || Number.parseFloat(newLimit) <= 0) return;

    const budget: Budget = {
      id: uuidv4(),
      category: newCategory,
      subCategory:
        newCategory === 'Overall' ? undefined : newSubCategory.trim() || undefined,
      monthlyLimit: Number.parseFloat(newLimit),
      month,
      rollover: newRollover,
      alertThresholdsTriggered: [],
    };

    try {
      await fetch('/api/budgets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(budget),
      });
      closeBudgetComposer();
      await fetchBudgets();
    } catch {
      // offline
    }
  };

  const handleDeleteBudget = async (id: string) => {
    try {
      await fetch(`/api/budgets?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      await fetchBudgets();
    } catch {
      // offline
    }
  };

  const handleSync = async () => {
    try {
      const { syncPendingTransactions } = await import('@/lib/indexeddb');
      const result = await syncPendingTransactions();
      setPendingCount((previous) => Math.max(previous - result.synced, 0));
      setLastSyncAt(new Date());
    } catch {
      // failed
    }
  };

  const handleExportJSON = async () => {
    try {
      const response = await fetch('/api/transactions');
      const transactions: Transaction[] = await response.json();
      const blob = new Blob([JSON.stringify(transactions, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `expense-backup-${format(new Date(), 'yyyy-MM-dd')}.json`;
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
    setImportStatus('Importing...');

    try {
      const text = await file.text();
      const transactions: Transaction[] = JSON.parse(text);
      if (!Array.isArray(transactions)) {
        setImportStatus('Invalid file format.');
        return;
      }

      let imported = 0;
      for (const transaction of transactions) {
        if (!transaction.amount || !transaction.category || !transaction.date) continue;

        const response = await fetch('/api/transactions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount: transaction.amount,
            category: transaction.category,
            subCategory: transaction.subCategory,
            merchant: transaction.merchant,
            description: transaction.description,
            date: transaction.date,
            paymentMethod: transaction.paymentMethod ?? 'Cash',
            notes: transaction.notes ?? '',
            tags: transaction.tags ?? [],
            attachmentBase64: transaction.attachmentBase64,
            split: transaction.split,
            recurring: transaction.recurring
              ? {
                  frequency: transaction.recurring.frequency,
                  interval: transaction.recurring.interval,
                  endDate: transaction.recurring.endDate,
                }
              : undefined,
          }),
        });

        if (response.ok) imported += 1;
      }

      setImportStatus(
        `Imported ${imported} transaction${imported === 1 ? '' : 's'} successfully.`
      );
      setLastImportAt(new Date());
    } catch {
      setImportStatus('Failed to import. Make sure the file is a valid JSON export.');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
      window.setTimeout(() => setImportStatus(null), 5000);
    }
  };

  const monthBudgets = useMemo(() => {
    return budgets
      .filter((budget) => budget.month === month)
      .sort((first, second) => {
        if (first.category === 'Overall' && second.category !== 'Overall') return -1;
        if (first.category !== 'Overall' && second.category === 'Overall') return 1;
        return `${first.category}:${first.subCategory || ''}`.localeCompare(
          `${second.category}:${second.subCategory || ''}`
        );
      });
  }, [budgets, month]);

  const nextPaydayDate = parseDateValue(nextPayday);
  const formattedBudgetMonth = format(new Date(`${month}-01`), 'MMMM yyyy');
  const berdeSettingsContext = resolveSettingsBerdeContext({
    loading,
    showBudgetComposer,
    monthBudgets,
  });
  const overallBudget = monthBudgets.find(
    (budget) => budget.category === 'Overall' && !budget.subCategory
  );
  const rolloverBudgetCount = monthBudgets.filter((budget) => budget.rollover).length;
  const syncStatusText = online
    ? pendingCount > 0
      ? `${pendingCount} pending`
      : 'All synced'
    : 'Offline mode';
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
        monthBudgets.length === 0
          ? 'No monthly budgets configured'
          : monthBudgets.length === 1
            ? '1 monthly budget configured'
            : `${monthBudgets.length} monthly budgets configured`,
      status: overallBudget ? 'Overall cap ready' : 'Needs overall cap',
      description:
        'Monthly guardrails belong here, but heavier setup stays inside a dedicated composer instead of an always-open form.',
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
      summary: 'Password and account protection',
      description:
        'Profile, password, and session controls stay clear and trustworthy, with room to grow into stronger device security later.',
      eyebrow: 'Security & Sync',
      group: 'Security & Sync',
      icon: Shield,
    },
    {
      id: 'sync-data',
      title: 'Sync & Data',
      summary: 'Backup, export, and import',
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
              value={loading ? '...' : String(monthBudgets.length)}
              helper={formattedBudgetMonth}
              loading={loading}
            />
            <SummaryTile
              label="Overall budget"
              value={loading ? '...' : overallBudget ? formatCurrency(overallBudget.monthlyLimit) : 'Missing'}
              helper={overallBudget ? 'Main monthly cap is active' : 'Add an Overall budget first'}
              loading={loading}
              accent={Boolean(overallBudget)}
            />
            <SummaryTile
              label="Rollover"
              value={loading ? '...' : String(rolloverBudgetCount)}
              helper="Budgets carrying unused room forward"
              loading={loading}
            />
          </div>

          <SettingsSurface
            eyebrow="Budgets"
            title={`Budget rules for ${formattedBudgetMonth}`}
            description="Budget setup stays clean here: browse the month, scan what is already configured, and add new rules inside a dedicated composer."
            action={
              <div className="flex flex-col gap-2 sm:flex-row">
                <select
                  value={month}
                  onChange={(event) => setMonth(event.target.value)}
                  className="min-h-11 rounded-full border border-[#ddd6c8] bg-[#fbf8f1] px-4 text-sm text-zinc-700 outline-none transition focus:border-[#1D9E75]"
                >
                  {Array.from({ length: 6 }).map((_, index) => {
                    const date = new Date();
                    date.setMonth(date.getMonth() - index);
                    const value = format(date, 'yyyy-MM');

                    return (
                      <option key={value} value={value}>
                        {format(date, 'MMMM yyyy')}
                      </option>
                    );
                  })}
                </select>
                <button
                  type="button"
                  onClick={() => setShowBudgetComposer(true)}
                  className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full bg-[#1D9E75] px-4 text-sm font-medium text-white transition-colors hover:bg-[#187f5d]"
                >
                  <Plus size={14} />
                  Add budget
                </button>
              </div>
            }
          >
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div
                    key={index}
                    className="h-24 animate-pulse rounded-[24px] border border-[#ebe3d5] bg-[#fbf8f1]"
                  />
                ))}
              </div>
            ) : monthBudgets.length === 0 ? (
              <div className="rounded-[24px] border border-dashed border-[#d9d1c2] bg-[#fbf8f1] px-4 py-6 text-sm text-zinc-500">
                No budgets configured for {formattedBudgetMonth} yet. Start with an Overall limit so the month has a clear ceiling.
              </div>
            ) : (
              <div className="space-y-3">
                {monthBudgets.map((budget) => (
                  <div
                    key={budget.id}
                    className="rounded-[26px] border border-[#e8dfd0] bg-[#fbf8f1] p-4"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                            {budget.category}
                          </p>
                          {budget.subCategory ? (
                            <span className="inline-flex rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-zinc-600">
                              {budget.subCategory}
                            </span>
                          ) : null}
                          {budget.rollover ? (
                            <span className="inline-flex rounded-full bg-[#eef7f0] px-2 py-0.5 text-[11px] font-medium text-[#1D9E75]">
                              Rollover
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-2 text-xs uppercase tracking-[0.12em] text-zinc-500">
                          Monthly limit
                        </p>
                        <p className="mt-1 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                          {formatCurrency(budget.monthlyLimit)}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => void handleDeleteBudget(budget.id)}
                        className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-full border border-rose-200 px-4 text-sm font-medium text-rose-700 transition-colors hover:bg-rose-50"
                      >
                        <Trash2 size={14} />
                        Delete budget
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
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
      return <AccountSecuritySection />;
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
                        {online ? 'Connected' : 'Offline mode active'}
                      </p>
                    </div>
                    <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                      {pendingCount > 0
                        ? `${pendingCount} transaction${pendingCount === 1 ? '' : 's'} waiting to sync.`
                        : 'Everything local is caught up right now.'}
                    </p>
                    <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                      {lastSyncAt
                        ? `Last manual sync: ${format(lastSyncAt, 'PP p')}`
                        : 'No recent manual sync yet'}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => void handleSync()}
                    className="inline-flex min-h-10 items-center justify-center rounded-full border border-[#d9d1c2] bg-white px-4 text-sm font-medium text-zinc-700 transition-colors hover:bg-[#f5f1e8]"
                  >
                    Sync now
                  </button>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <SummaryTile
                  label="Pending"
                  value={String(pendingCount)}
                  helper="Queued locally"
                  accent={pendingCount === 0}
                />
                <SummaryTile
                  label="Mode"
                  value={online ? 'Online' : 'Offline'}
                  helper={online ? 'Ready to sync' : 'Changes stay local until reconnected'}
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
                <p className="font-medium text-zinc-900 dark:text-zinc-50">Portable transaction backup</p>
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
                  Use a Moneda JSON export. Imported transactions are added one by one and invalid rows are skipped.
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
                    Choose JSON file
                  </button>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">
                    Import stays separate from export for a calmer, safer data workflow.
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
        open={showBudgetComposer}
        eyebrow="Budgets"
        title="Add budget"
        description={`Create a focused budget for ${formattedBudgetMonth} without cluttering the main settings view.`}
        icon={PiggyBank}
        onClose={closeBudgetComposer}
      >
        <form onSubmit={handleAddBudget} className="space-y-4">
          <div className="rounded-[24px] border border-[#e8dfd0] bg-white/80 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
              Budget month
            </p>
            <p className="mt-2 text-sm font-medium text-zinc-900 dark:text-zinc-50">
              {formattedBudgetMonth}
            </p>
          </div>

          <div>
            <label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
              Category
            </label>
            <select
              value={newCategory}
              onChange={(event) => setNewCategory(event.target.value as Category | 'Overall')}
              className="mt-2 min-h-11 w-full rounded-2xl border border-[#ddd6c8] bg-white px-4 text-sm text-zinc-700 outline-none transition focus:border-[#1D9E75]"
            >
              <option value="Overall">Overall</option>
              {CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>

          {newCategory !== 'Overall' ? (
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
                Subcategory
              </label>
              <input
                value={newSubCategory}
                onChange={(event) => setNewSubCategory(event.target.value)}
                placeholder="Optional detail, like groceries"
                className="mt-2 min-h-11 w-full rounded-2xl border border-[#ddd6c8] bg-white px-4 text-sm text-zinc-700 outline-none transition focus:border-[#1D9E75]"
              />
            </div>
          ) : null}

          <div>
            <label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
              Monthly limit
            </label>
            <input
              type="number"
              step="0.01"
              value={newLimit}
              onChange={(event) => setNewLimit(event.target.value)}
              placeholder="0.00"
              className="mt-2 min-h-11 w-full rounded-2xl border border-[#ddd6c8] bg-white px-4 text-sm text-zinc-700 outline-none transition focus:border-[#1D9E75]"
            />
          </div>

          <label className="flex items-start gap-3 rounded-[24px] border border-[#e8dfd0] bg-white/80 px-4 py-4">
            <input
              type="checkbox"
              checked={newRollover}
              onChange={(event) => setNewRollover(event.target.checked)}
              className="mt-1 h-4 w-4 rounded border-[#cfc6b8] text-[#1D9E75] focus:ring-[#1D9E75]"
            />
            <span>
              <span className="block text-sm font-medium text-zinc-900 dark:text-zinc-50">
                Carry unused budget forward
              </span>
              <span className="mt-1 block text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                Helpful when a category should flex month to month instead of resetting hard.
              </span>
            </span>
          </label>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={closeBudgetComposer}
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-[#ddd6c8] px-4 text-sm font-medium text-zinc-700 transition-colors hover:bg-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full bg-[#1D9E75] px-5 text-sm font-medium text-white transition-colors hover:bg-[#187f5d]"
            >
              <Plus size={14} />
              Save budget
            </button>
          </div>
        </form>
      </SettingsDialog>
    </>
  );
}
