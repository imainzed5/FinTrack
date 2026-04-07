import {
  CreditCard,
  Landmark,
  PiggyBank,
  Smartphone,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import type { Account, AccountType, AccountWithBalance, Transaction } from './types';

type AccountPaletteSeed = {
  accent: string;
  surface: string;
  surfaceStrong: string;
  border: string;
  glow: string;
  text: string;
  muted: string;
};

export type AccountPalette = {
  accent: string;
  border: string;
  cardBackground: string;
  cardOverlay: string;
  cardGlow: string;
  iconBackground: string;
  iconColor: string;
  mutedSurface: string;
  mutedText: string;
  pillBackground: string;
  pillText: string;
  primaryText: string;
  secondaryText: string;
  softAccent: string;
};

export type AccountDetailSummary = {
  recentNet: number;
  recentIncome: number;
  recentExpense: number;
  transactionCount: number;
  lastActivityDate: string | null;
};

export type CompactMoneyDisplay = {
  compact: boolean;
  fullText: string;
  text: string;
};

export type WeeklyActivityPoint = {
  label: string;
  net: number;
};

const pesoFormatter = new Intl.NumberFormat('en-PH', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const compactPesoFormatter = new Intl.NumberFormat('en-PH', {
  notation: 'compact',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const ACCOUNT_TYPE_COPY: Record<
  AccountType,
  {
    shortLabel: string;
    longLabel: string;
    boardLabel: string;
  }
> = {
  Cash: {
    shortLabel: 'Cash',
    longLabel: 'Cash wallet',
    boardLabel: 'Cash wallet',
  },
  'E-Wallet': {
    shortLabel: 'Debit',
    longLabel: 'Digital wallet',
    boardLabel: 'Digital wallet',
  },
  Bank: {
    shortLabel: 'Bank',
    longLabel: 'Bank account',
    boardLabel: 'Bank account',
  },
  Other: {
    shortLabel: 'Reserve',
    longLabel: 'Other account',
    boardLabel: 'Other account',
  },
};

const ACCOUNT_TYPE_PALETTES: Record<AccountType, AccountPaletteSeed> = {
  Cash: {
    accent: '#3f8f5c',
    surface: '#4f9362',
    surfaceStrong: '#2f6b46',
    border: '#8bc39d',
    glow: 'rgba(79, 147, 98, 0.22)',
    text: '#effaf2',
    muted: '#d7eddd',
  },
  'E-Wallet': {
    accent: '#1fbcd7',
    surface: '#22c3de',
    surfaceStrong: '#0f92ad',
    border: '#8ae7f3',
    glow: 'rgba(34, 195, 222, 0.24)',
    text: '#f1fdff',
    muted: '#d6f8fc',
  },
  Bank: {
    accent: '#2a7bcc',
    surface: '#2d86db',
    surfaceStrong: '#1d5f99',
    border: '#98c7f1',
    glow: 'rgba(45, 134, 219, 0.22)',
    text: '#f1f7ff',
    muted: '#dcecff',
  },
  Other: {
    accent: '#8c6c3f',
    surface: '#9f7a44',
    surfaceStrong: '#69502b',
    border: '#ddc08f',
    glow: 'rgba(159, 122, 68, 0.18)',
    text: '#fff8ef',
    muted: '#f2e5cf',
  },
};

const CUSTOM_ICON_MAP: Record<string, LucideIcon> = {
  wallet: Wallet,
  cash: Wallet,
  money: Wallet,
  phone: Smartphone,
  mobile: Smartphone,
  gcash: Smartphone,
  maya: Smartphone,
  bank: Landmark,
  landmark: Landmark,
  credit: CreditCard,
  card: CreditCard,
  savings: PiggyBank,
  piggybank: PiggyBank,
};

function clampChannel(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function normalizeHexColor(value?: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (/^#([0-9a-f]{6})$/i.test(trimmed)) {
    return trimmed.toLowerCase();
  }
  return null;
}

function hexToRgb(hex: string) {
  const normalized = hex.replace('#', '');
  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16),
  };
}

function rgba(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function adjustHex(hex: string, amount: number): string {
  const { r, g, b } = hexToRgb(hex);
  const next = {
    r: clampChannel(r + amount),
    g: clampChannel(g + amount),
    b: clampChannel(b + amount),
  };

  return `#${next.r.toString(16).padStart(2, '0')}${next.g.toString(16).padStart(2, '0')}${next.b
    .toString(16)
    .padStart(2, '0')}`;
}

function formatPesoAmount(amount: number, compact = false): string {
  const formatter = compact ? compactPesoFormatter : pesoFormatter;
  const sign = amount < 0 ? '-' : '';

  return `${sign}₱${formatter.format(Math.abs(amount))}`;
}

export function getAccountTypeLabel(type: AccountType): string {
  return ACCOUNT_TYPE_COPY[type].longLabel;
}

export function getAccountTypeBadge(type: AccountType): string {
  return ACCOUNT_TYPE_COPY[type].shortLabel;
}

export function getAccountBoardLabel(type: AccountType): string {
  return ACCOUNT_TYPE_COPY[type].boardLabel;
}

export function getCompactMoneyDisplay(
  amount: number,
  options?: {
    compactThreshold?: number;
    hiddenText?: string;
    visible?: boolean;
  },
): CompactMoneyDisplay {
  const visible = options?.visible ?? true;
  const hiddenText = options?.hiddenText ?? '₱••••••';

  if (!visible) {
    return {
      compact: false,
      fullText: hiddenText,
      text: hiddenText,
    };
  }

  const fullText = formatPesoAmount(amount);
  const compactThreshold = options?.compactThreshold ?? 12;
  const compact = fullText.length > compactThreshold;

  return {
    compact,
    fullText,
    text: compact ? formatPesoAmount(amount, true) : fullText,
  };
}

export function getAccountIconComponent(
  account: Pick<Account, 'type' | 'icon' | 'name'>,
): LucideIcon {
  const iconKey = account.icon?.trim().toLowerCase();

  if (iconKey) {
    const matchedKey = Object.keys(CUSTOM_ICON_MAP).find((candidate) => iconKey.includes(candidate));
    if (matchedKey) {
      return CUSTOM_ICON_MAP[matchedKey];
    }
  }

  const normalizedName = account.name.trim().toLowerCase();

  if (normalizedName.includes('credit') || normalizedName.includes('visa') || normalizedName.includes('mastercard')) {
    return CreditCard;
  }

  if (normalizedName.includes('gcash') || normalizedName.includes('maya')) {
    return Smartphone;
  }

  if (account.type === 'Cash') return Wallet;
  if (account.type === 'E-Wallet') return Smartphone;
  if (account.type === 'Bank') return Landmark;
  return PiggyBank;
}

export function getAccountPalette(account: Pick<Account, 'type' | 'color'>): AccountPalette {
  const palette = ACCOUNT_TYPE_PALETTES[account.type];
  const customAccent = normalizeHexColor(account.color);
  const accent = customAccent ?? palette.accent;
  const accentStrong = customAccent ? adjustHex(customAccent, -28) : palette.surfaceStrong;
  const softAccent = customAccent ? rgba(customAccent, 0.18) : rgba(palette.accent, 0.18);
  const border = customAccent ? rgba(customAccent, 0.34) : palette.border;
  const iconBackground = customAccent ? rgba(customAccent, 0.18) : rgba(palette.text, 0.18);
  const cardBackground = `linear-gradient(145deg, ${customAccent ? adjustHex(customAccent, 18) : palette.surface} 0%, ${accentStrong} 100%)`;
  const cardOverlay = `radial-gradient(circle at top right, ${rgba(accent, 0.28)} 0%, transparent 48%)`;

  return {
    accent,
    border,
    cardBackground,
    cardOverlay,
    cardGlow: customAccent ? rgba(customAccent, 0.22) : palette.glow,
    iconBackground,
    iconColor: palette.text,
    mutedSurface: rgba('#ffffff', 0.14),
    mutedText: rgba(palette.text, 0.7),
    pillBackground: customAccent ? rgba(customAccent, 0.16) : rgba(palette.accent, 0.14),
    pillText: accentStrong,
    primaryText: palette.text,
    secondaryText: rgba(palette.text, 0.82),
    softAccent,
  };
}

function isTransactionInWindow(dateValue: string, cutoff: number, now: Date): boolean {
  const parsed = new Date(dateValue);
  if (Number.isNaN(parsed.getTime())) return false;
  return parsed.getTime() >= now.getTime() - cutoff;
}

export function getAccountDetailSummary(
  accountId: string,
  transactions: Transaction[],
  now = new Date(),
): AccountDetailSummary {
  const recentWindowMs = 1000 * 60 * 60 * 24 * 30;
  const accountTransactions = transactions.filter((transaction) => transaction.accountId === accountId);
  const recentTransactions = accountTransactions.filter((transaction) =>
    isTransactionInWindow(transaction.date, recentWindowMs, now),
  );

  const recentIncome = recentTransactions.reduce((sum, transaction) => {
    if (transaction.type === 'income') {
      return sum + Math.abs(transaction.amount);
    }

    if (transaction.type === 'savings' && transaction.savingsMeta?.depositType === 'withdrawal') {
      return sum + Math.abs(transaction.amount);
    }

    return sum;
  }, 0);

  const recentExpense = recentTransactions.reduce((sum, transaction) => {
    if (transaction.type === 'expense') {
      return sum + Math.abs(transaction.amount);
    }

    if (transaction.type === 'savings' && transaction.savingsMeta?.depositType !== 'withdrawal') {
      return sum + Math.abs(transaction.amount);
    }

    return sum;
  }, 0);

  const sortedTransactions = [...accountTransactions].sort(
    (left, right) => new Date(right.date).getTime() - new Date(left.date).getTime(),
  );

  return {
    recentNet: Number((recentIncome - recentExpense).toFixed(2)),
    recentIncome: Number(recentIncome.toFixed(2)),
    recentExpense: Number(recentExpense.toFixed(2)),
    transactionCount: accountTransactions.length,
    lastActivityDate: sortedTransactions[0]?.date ?? null,
  };
}

export function getLargestAccount(accounts: AccountWithBalance[]): AccountWithBalance | null {
  return accounts.reduce<AccountWithBalance | null>((largest, account) => {
    if (!largest || account.computedBalance > largest.computedBalance) {
      return account;
    }
    return largest;
  }, null);
}

export function getCashflowMixContext(recentIncome: number, recentExpense: number): string {
  if (recentIncome <= 0 && recentExpense <= 0) {
    return 'No recent inflows or outflows tracked here yet.';
  }

  if (recentIncome > 0 && recentExpense <= 0) {
    return 'This account is mostly used for receiving money.';
  }

  if (recentExpense > 0 && recentIncome <= 0) {
    return 'This account is mostly used for spending.';
  }

  const inflowShare = recentIncome / (recentIncome + recentExpense);

  if (inflowShare >= 0.9) {
    return 'Low outflow — mostly inflows tracked here.';
  }

  if (inflowShare <= 0.1) {
    return 'Mostly outflow — this account is doing the spending work.';
  }

  return 'This account is used for both receiving and spending.';
}

export function getWeeklyActivitySummary(points: WeeklyActivityPoint[]): string {
  const activePoints = points.filter((point) => point.net !== 0);

  if (activePoints.length < 3) {
    return 'No significant activity this week.';
  }

  const strongestPoint = activePoints.reduce((largest, point) => {
    if (!largest || Math.abs(point.net) > Math.abs(largest.net)) {
      return point;
    }

    return largest;
  }, activePoints[0]);

  if (strongestPoint.net > 0) {
    return `Highest inflow: ${formatPesoAmount(strongestPoint.net)} on ${strongestPoint.label}`;
  }

  return `Highest spend: ${formatPesoAmount(Math.abs(strongestPoint.net))} on ${strongestPoint.label}`;
}
