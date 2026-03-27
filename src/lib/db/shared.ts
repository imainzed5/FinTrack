import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
  format,
  parseISO,
} from 'date-fns';

import type { RecurringFrequency } from '../types';

export function safeParseDate(value?: string): Date | null {
  if (!value) return null;
  const parsed = parseISO(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function normalizeIsoDate(value: string | undefined, fallback: string): string {
  const parsed = safeParseDate(value);
  if (parsed) return parsed.toISOString();
  const fallbackParsed = safeParseDate(fallback);
  return fallbackParsed ? fallbackParsed.toISOString() : new Date().toISOString();
}

export function addRecurringInterval(
  date: Date,
  frequency: RecurringFrequency,
  interval: number
): Date {
  const steps = Math.max(1, Math.floor(interval));
  if (frequency === 'daily') return addDays(date, steps);
  if (frequency === 'weekly') return addWeeks(date, steps);
  if (frequency === 'yearly') return addYears(date, steps);
  return addMonths(date, steps);
}

export function monthToDate(month: string): string {
  if (/^\d{4}-\d{2}$/.test(month)) {
    return `${month}-01`;
  }
  return `${format(new Date(), 'yyyy-MM')}-01`;
}

export function dateToMonth(value: string): string {
  return value.slice(0, 7);
}

export function toNumber(value: number | string | null | undefined): number {
  if (typeof value === 'number') {
    return Number(value.toFixed(2));
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return Number(parsed.toFixed(2));
    }
  }
  return 0;
}

export function toDateOnly(value: Date): string {
  return format(value, 'yyyy-MM-dd');
}

export function throwIfError(context: string, error: { message: string } | null) {
  if (error) {
    throw new Error(`${context}: ${error.message}`);
  }
}

export function isMissingAccountsSchemaError(
  error: { message?: string } | null | undefined
): boolean {
  const message = (error?.message || '').toLowerCase();
  return (
    message.includes('column accounts.is_system_cash_wallet does not exist') ||
    message.includes('column transactions.metadata does not exist') ||
    message.includes('column transactions.linked_transfer_group_id does not exist') ||
    message.includes('column transactions.account_id does not exist') ||
    message.includes('column transactions.transfer_group_id does not exist') ||
    message.includes('relation "accounts" does not exist') ||
    message.includes('relation "external_withdrawal_requests" does not exist') ||
    (message.includes('could not find the table') && message.includes('accounts'))
  );
}
