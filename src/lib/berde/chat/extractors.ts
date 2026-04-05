import {
  type AliasEntry,
  buildAccountAliasEntries,
  buildGoalAliasEntries,
  findAliasMatch,
} from '@/lib/berde/chat/aliases';
import {
  EXPENSE_VERBS,
  INCOME_VERBS,
  STOP_WORDS,
  TYPE_REPLY_ALIASES,
  WEEKDAY_INDEX,
} from '@/lib/berde/chat/config';
import {
  escapeRegExp,
  normalizeForReply,
  normalizeWhitespace,
  toTitleCase,
} from '@/lib/berde/chat/normalize';
import type { TransactionEntryType } from '@/lib/berde/chat/config';
import type { Account, Category, IncomeCategory, SavingsGoal } from '@/lib/types';

export function buildDateIso(baseDate: Date, dayOffset: number): string {
  const nextDate = new Date(baseDate);
  nextDate.setHours(12, 0, 0, 0);
  nextDate.setDate(nextDate.getDate() + dayOffset);
  return nextDate.toISOString();
}

export function resolvePreviousWeekday(baseDate: Date, targetWeekday: number): string {
  const nextDate = new Date(baseDate);
  nextDate.setHours(12, 0, 0, 0);
  const currentWeekday = nextDate.getDay();
  let delta = (currentWeekday - targetWeekday + 7) % 7;
  if (delta === 0) {
    delta = 7;
  }
  nextDate.setDate(nextDate.getDate() - delta);
  return nextDate.toISOString();
}

export function extractAmount(message: string): { amount?: number; stripped: string } {
  const normalizedMessage = normalizeWhitespace(
    message.replace(/\b(?:mga|around|about|roughly|approximately|approx|halos)\b/gi, ' '),
  );
  const amountPattern =
    /(?:^|[\s(])(?:\u20b1|php|p)?\s*(\d{1,3}(?:,\d{3})*(?:\.\d+)?|\d+(?:\.\d+)?)(\s*k)?(?:\s*lang)?(?=$|[\s,!.?])/i;
  const match = normalizedMessage.match(amountPattern);

  if (!match) {
    return { stripped: normalizedMessage };
  }

  const numericRaw = match[1]?.replace(/,/g, '');
  const parsed = numericRaw ? Number.parseFloat(numericRaw) : Number.NaN;
  if (!Number.isFinite(parsed)) {
    return { stripped: normalizedMessage };
  }

  return {
    amount: Number((parsed * (match[2] ? 1000 : 1)).toFixed(2)),
    stripped: normalizeWhitespace(normalizedMessage.replace(match[0], ' ')),
  };
}

export function extractDate(message: string, now: Date): { date?: string; stripped: string } {
  let stripped = message;

  if (/\byesterday\b/i.test(stripped) || /\blast night\b/i.test(stripped) || /\bkahapon\b/i.test(stripped)) {
    stripped = normalizeWhitespace(
      stripped
        .replace(/\byesterday\b/gi, ' ')
        .replace(/\blast night\b/gi, ' ')
        .replace(/\bkahapon\b/gi, ' '),
    );
    return { date: buildDateIso(now, -1), stripped };
  }

  if (/\bkagabi\b/i.test(stripped)) {
    stripped = normalizeWhitespace(stripped.replace(/\bkagabi\b/gi, ' '));
    return { date: buildDateIso(now, -1), stripped };
  }

  if (/\b(?:nung|isang)\s+araw\b/i.test(stripped) || /\bnoong isang araw\b/i.test(stripped)) {
    stripped = normalizeWhitespace(
      stripped
        .replace(/\bnung isang araw\b/gi, ' ')
        .replace(/\bnoong isang araw\b/gi, ' ')
        .replace(/\bisang araw\b/gi, ' '),
    );
    return { date: buildDateIso(now, -2), stripped };
  }

  if (/\btoday\b/i.test(stripped) || /\bthis morning\b/i.test(stripped) || /\bkanina\b/i.test(stripped)) {
    stripped = normalizeWhitespace(
      stripped
        .replace(/\btoday\b/gi, ' ')
        .replace(/\bthis morning\b/gi, ' ')
        .replace(/\bkanina\b/gi, ' '),
    );
    return { date: buildDateIso(now, 0), stripped };
  }

  const weekdayMatch = stripped.match(
    /\b(?:last|noong|nung)\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday|linggo|lunes|martes|miyerkules|mierkules|huwebes|biyernes|sabado)\b/i,
  );
  if (weekdayMatch?.[1]) {
    stripped = normalizeWhitespace(stripped.replace(weekdayMatch[0], ' '));
    return { date: resolvePreviousWeekday(now, WEEKDAY_INDEX[weekdayMatch[1].toLowerCase()]), stripped };
  }

  return { stripped };
}

export function detectTransactionType(
  message: string,
  category?: Category,
  incomeCategory?: IncomeCategory,
): TransactionEntryType | undefined {
  const normalized = normalizeForReply(message);

  if (TYPE_REPLY_ALIASES.expense.includes(normalized)) {
    return 'expense';
  }
  if (TYPE_REPLY_ALIASES.income.includes(normalized)) {
    return 'income';
  }
  if (incomeCategory) {
    return 'income';
  }
  if (category) {
    return 'expense';
  }
  if (INCOME_VERBS.some((verb) => new RegExp(`(^|\\W)${escapeRegExp(verb)}(?=$|\\W)`, 'i').test(normalized))) {
    return 'income';
  }
  if (EXPENSE_VERBS.some((verb) => new RegExp(`(^|\\W)${escapeRegExp(verb)}(?=$|\\W)`, 'i').test(normalized))) {
    return 'expense';
  }
  return undefined;
}

export function extractContextualAccount(
  message: string,
  keyword: 'from' | 'to',
  entries: Array<AliasEntry<Account>>,
): { account?: Account; stripped: string } {
  let stripped = message;

  for (const entry of entries) {
    for (const alias of entry.aliases) {
      const pattern = new RegExp(`\\b${keyword}\\s+${escapeRegExp(alias)}(?=$|\\W)`, 'i');
      const match = stripped.match(pattern);
      if (!match) {
        continue;
      }

      stripped = normalizeWhitespace(stripped.replace(match[0], ' '));
      return { account: entry.value, stripped };
    }
  }

  return { stripped };
}

export function extractGoalMention(
  message: string,
  goals: SavingsGoal[],
): { goal?: SavingsGoal; stripped: string } {
  let stripped = message;
  const goalMatch = findAliasMatch(stripped, buildGoalAliasEntries(goals));
  if (!goalMatch.value || !goalMatch.alias) {
    return { stripped };
  }

  const pattern = new RegExp(`(^|\\W)(?:to|from|into)?\\s*${escapeRegExp(goalMatch.alias)}(?=$|\\W)`, 'i');
  stripped = normalizeWhitespace(stripped.replace(pattern, ' '));
  return { goal: goalMatch.value, stripped };
}

export function extractAccountMention(
  message: string,
  accounts: Account[],
): { account?: Account; stripped: string } {
  let stripped = message;
  const accountMatch = findAliasMatch(stripped, buildAccountAliasEntries(accounts));
  if (!accountMatch.value || !accountMatch.alias) {
    return { stripped };
  }

  const pattern = new RegExp(`(^|\\W)(?:from|by|using|via|through|sa)?\\s*${escapeRegExp(accountMatch.alias)}(?=$|\\W)`, 'i');
  stripped = normalizeWhitespace(stripped.replace(pattern, ' '));
  return { account: accountMatch.value, stripped };
}

export function extractMerchantFromTail(message: string): { merchant?: string; stripped: string } {
  const merchantMatch = message.match(/\bat\s+([a-z0-9][a-z0-9\s&'.-]*)$/i);
  if (!merchantMatch?.[1]) {
    return { stripped: message };
  }

  return {
    merchant: toTitleCase(normalizeWhitespace(merchantMatch[1])),
    stripped: normalizeWhitespace(message.replace(merchantMatch[0], ' ')),
  };
}

export function extractDescription(message: string): string | undefined {
  const cleaned = normalizeWhitespace(
    message
      .split(/\s+/)
      .filter((part) => {
        const normalizedPart = part.toLowerCase().replace(/[^a-z0-9.-]/g, '');
        if (!normalizedPart) {
          return false;
        }
        if (STOP_WORDS.has(normalizedPart)) {
          return false;
        }
        if (/^(?:\u20b1|php|p)?\d/.test(normalizedPart)) {
          return false;
        }
        return true;
      })
      .join(' '),
  );

  return cleaned ? toTitleCase(cleaned) : undefined;
}

export function inferMerchant(description?: string, category?: Category): string | undefined {
  if (!description) {
    return undefined;
  }
  if (category === 'Food' || category === 'Health' || category === 'Shopping') {
    return description;
  }
  return undefined;
}
