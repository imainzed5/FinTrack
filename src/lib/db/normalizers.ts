import type { AccountType, Transaction } from '../types';
import { INCOME_CATEGORIES } from '../types';

export const ACCOUNT_TYPE_SET = new Set<AccountType>(['Cash', 'Bank', 'E-Wallet', 'Other']);

const INCOME_CATEGORY_SET = new Set<string>(INCOME_CATEGORIES);

export function normalizeTransactionType(value: unknown): Transaction['type'] {
  if (value === 'income') return 'income';
  if (value === 'savings') return 'savings';
  return 'expense';
}

export function normalizeIncomeCategory(value: unknown): Transaction['incomeCategory'] {
  if (typeof value !== 'string') {
    return undefined;
  }

  return INCOME_CATEGORY_SET.has(value)
    ? (value as NonNullable<Transaction['incomeCategory']>)
    : undefined;
}

export function normalizeSavingsTransactionMeta(value: unknown): Transaction['savingsMeta'] {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const meta = value as Record<string, unknown>;
  if (
    typeof meta.goalId !== 'string' ||
    typeof meta.goalName !== 'string' ||
    (meta.depositType !== 'deposit' && meta.depositType !== 'withdrawal')
  ) {
    return undefined;
  }

  return {
    goalId: meta.goalId,
    goalName: meta.goalName,
    depositType: meta.depositType,
  };
}

export function normalizeMetadata(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  return value as Record<string, unknown>;
}

export function normalizeAccountType(value: unknown): AccountType {
  if (typeof value === 'string' && ACCOUNT_TYPE_SET.has(value as AccountType)) {
    return value as AccountType;
  }
  return 'Cash';
}
