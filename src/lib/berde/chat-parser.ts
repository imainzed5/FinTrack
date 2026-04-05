import { resolvePaymentMethodForAccount, resolvePreferredDefaultAccount } from '@/lib/accounts-utils';
import type {
  Account,
  Category,
  Debt,
  DebtDirection,
  IncomeCategory,
  SavingsGoal,
} from '@/lib/types';
import type {
  BerdeActionMissingField,
  BerdeChatParserContext,
  BerdeChatResponse,
  BerdeParsedAction,
  BerdeParsedActionBatch,
  BerdeTransactionAction,
} from '@/lib/berde/chat.types';

type TransactionEntryType = NonNullable<BerdeTransactionAction['entryType']>;

interface AliasEntry<T> {
  value: T;
  aliases: string[];
}

interface TransactionSignals {
  amount?: number;
  entryType?: TransactionEntryType;
  category?: Category;
  incomeCategory?: IncomeCategory;
  description?: string;
  merchant?: string;
  date?: string;
  accountId?: string;
  accountName?: string;
}

const EXPENSE_VERBS = [
  'spent',
  'spend',
  'pay',
  'paid',
  'bought',
  'used',
  'ordered',
  'purchased',
  'nag spend',
  'nagspend',
  'nag bayad',
  'nagbayad',
  'gumastos',
  'kumain',
  'binili',
] as const;

const INCOME_VERBS = [
  'received',
  'earned',
  'got',
  'made',
  'allowance',
  'sweldo',
  'sahod',
] as const;

const TYPE_REPLY_ALIASES: Record<TransactionEntryType, string[]> = {
  expense: ['expense', 'log as expense', 'as expense', 'make it expense'],
  income: ['income', 'log as income', 'as income', 'make it income'],
};

const YES_REPLIES = new Set([
  'yes',
  'yeah',
  'yep',
  'confirm',
  'go',
  'log it',
  'save it',
  'okay',
  'ok',
]);

const CONNECTORS = /\s*(?:,|;|\n| then | tapos | plus | & )\s*/i;

const WEEKDAY_INDEX: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

const CATEGORY_ALIASES: Array<AliasEntry<Category>> = [
  {
    value: 'Food',
    aliases: [
      'food',
      'groceries',
      'grocery',
      'lunch',
      'dinner',
      'breakfast',
      'snack',
      'snacks',
      'meal',
      'meals',
      'coffee',
      'starbucks',
      'jollibee',
      'jolibee',
      'mcdo',
      'mcdonalds',
    ],
  },
  {
    value: 'Transportation',
    aliases: [
      'mrt',
      'lrt',
      'grab',
      'fare',
      'pamasahe',
      'transpo',
      'transport',
      'transportation',
      'commute',
      'taxi',
      'bus',
      'jeep',
      'jeepney',
    ],
  },
  {
    value: 'Subscriptions',
    aliases: ['spotify', 'netflix', 'subscription', 'subscriptions', 'youtube premium'],
  },
  {
    value: 'Utilities',
    aliases: ['bill', 'bills', 'wifi', 'internet', 'electricity', 'water', 'utilities', 'rent', 'load', 'mobile load', 'data'],
  },
  {
    value: 'Shopping',
    aliases: ['shopping', 'shopee', 'lazada', 'clothes', 'shirt', 'shoes'],
  },
  {
    value: 'Entertainment',
    aliases: ['movie', 'movies', 'games', 'gaming', 'entertainment', 'concert'],
  },
  {
    value: 'Health',
    aliases: ['medicine', 'meds', 'watsons', 'clinic', 'doctor', 'health', 'hospital', 'pharmacy'],
  },
  {
    value: 'Education',
    aliases: ['school', 'tuition', 'education', 'books', 'book', 'supplies'],
  },
  {
    value: 'Miscellaneous',
    aliases: ['misc', 'miscellaneous', 'other'],
  },
];

const INCOME_CATEGORY_ALIASES: Array<AliasEntry<IncomeCategory>> = [
  { value: 'Salary', aliases: ['salary', 'paycheck', 'sweldo', 'sahod'] },
  { value: 'Freelance', aliases: ['freelance', 'client work'] },
  { value: 'Side Job', aliases: ['sideline', 'side job', 'side hustle'] },
  { value: 'Part-time', aliases: ['part time', 'part-time'] },
  { value: 'Bonus', aliases: ['bonus', 'incentive'] },
  { value: 'Refund', aliases: ['refund', 'reimbursement'] },
  { value: 'Gift', aliases: ['gift', 'allowance', 'baon'] },
  { value: 'Other Income', aliases: ['income'] },
];

const STOP_WORDS = new Set([
  'spent',
  'spend',
  'pay',
  'paid',
  'bought',
  'used',
  'ordered',
  'purchased',
  'received',
  'earned',
  'got',
  'made',
  'expense',
  'income',
  'log',
  'as',
  'on',
  'for',
  'from',
  'my',
  'the',
  'a',
  'an',
  'to',
  'into',
  'at',
  'sa',
  'ako',
  'nag',
  'nagspend',
  'nagbayad',
  'ng',
  'ko',
  'kahapon',
  'kanina',
  'today',
  'yesterday',
  'last',
  'night',
  'this',
  'morning',
  'by',
  'using',
  'via',
  'through',
  'transfer',
  'move',
  'send',
  'save',
  'saved',
  'deposit',
  'withdraw',
  'lent',
  'borrowed',
  'paid',
  'back',
  'me',
]);

const STARTER_QUICK_REPLIES = ['Log expense', 'Log income', 'Move money', 'Track utang'] as const;

function createActionId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function normalizeForReply(value: string): string {
  return normalizeWhitespace(value.toLowerCase());
}

function toTitleCase(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function buildDateIso(baseDate: Date, dayOffset: number): string {
  const nextDate = new Date(baseDate);
  nextDate.setHours(12, 0, 0, 0);
  nextDate.setDate(nextDate.getDate() + dayOffset);
  return nextDate.toISOString();
}

function resolvePreviousWeekday(baseDate: Date, targetWeekday: number): string {
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

function extractAmount(message: string): { amount?: number; stripped: string } {
  const amountPattern =
    /(?:^|[\s(])(?:\u20b1|php|p)?\s*(\d{1,3}(?:,\d{3})*(?:\.\d+)?|\d+(?:\.\d+)?)(\s*k)?(?=$|[\s,!.?])/i;
  const match = message.match(amountPattern);

  if (!match) {
    return { stripped: message };
  }

  const numericRaw = match[1]?.replace(/,/g, '');
  const parsed = numericRaw ? Number.parseFloat(numericRaw) : Number.NaN;
  if (!Number.isFinite(parsed)) {
    return { stripped: message };
  }

  return {
    amount: Number((parsed * (match[2] ? 1000 : 1)).toFixed(2)),
    stripped: normalizeWhitespace(message.replace(match[0], ' ')),
  };
}

function extractDate(message: string, now: Date): { date?: string; stripped: string } {
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

  if (/\btoday\b/i.test(stripped) || /\bthis morning\b/i.test(stripped) || /\bkanina\b/i.test(stripped)) {
    stripped = normalizeWhitespace(
      stripped
        .replace(/\btoday\b/gi, ' ')
        .replace(/\bthis morning\b/gi, ' ')
        .replace(/\bkanina\b/gi, ' '),
    );
    return { date: buildDateIso(now, 0), stripped };
  }

  const weekdayMatch = stripped.match(/\b(?:last|noong|nung)\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i);
  if (weekdayMatch?.[1]) {
    stripped = normalizeWhitespace(stripped.replace(weekdayMatch[0], ' '));
    return { date: resolvePreviousWeekday(now, WEEKDAY_INDEX[weekdayMatch[1].toLowerCase()]), stripped };
  }

  return { stripped };
}

function splitCompositeMessage(message: string): string[] {
  const topLevelParts = normalizeWhitespace(message)
    .split(CONNECTORS)
    .map((part) => normalizeWhitespace(part))
    .filter(Boolean);
  const segments: string[] = [];

  for (const part of topLevelParts) {
    const andParts = part
      .split(/\s+(?:and|tapos|plus|&)\s+/i)
      .map((entry) => normalizeWhitespace(entry))
      .filter(Boolean);
    if (andParts.length > 1 && andParts.every(looksLikeStandaloneSegment)) {
      segments.push(...andParts);
    } else {
      segments.push(part);
    }
  }

  return segments;
}

function looksLikeStandaloneSegment(value: string): boolean {
  return /\d/.test(value) || /\b(spent|salary|received|transfer|save|deposit|withdraw|lent|borrowed|paid me back|kumain|nag|mrt|lrt|fare|pamasahe|load)\b/i.test(value);
}

function findAliasMatch<T>(
  message: string,
  entries: Array<AliasEntry<T>>,
): { value?: T; alias?: string } {
  const normalized = ` ${message.toLowerCase()} `;

  for (const entry of entries) {
    for (const alias of entry.aliases) {
      const pattern = new RegExp(`(^|\\W)${escapeRegExp(alias)}(?=$|\\W)`, 'i');
      if (pattern.test(normalized)) {
        return { value: entry.value, alias };
      }
    }
  }

  return {};
}

function detectTransactionType(
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

function buildAccountAliasEntries(accounts: Account[]): Array<AliasEntry<Account>> {
  const activeAccounts = accounts.filter((account) => !account.isArchived);
  const aliasCounts = new Map<string, number>();
  const entries = activeAccounts.map((account) => {
    const aliases = new Set<string>();
    const normalizedName = normalizeForReply(account.name);

    if (normalizedName) {
      aliases.add(normalizedName);
    }
    if (normalizedName.includes('gcash')) {
      aliases.add('gcash');
    }
    if (normalizedName.includes('maya')) {
      aliases.add('maya');
    }
    if (account.type === 'Cash' || account.isSystemCashWallet || normalizedName === 'cash') {
      aliases.add('cash');
    }
    if (account.type === 'Bank') {
      aliases.add('bank');
    }

    for (const alias of aliases) {
      aliasCounts.set(alias, (aliasCounts.get(alias) ?? 0) + 1);
    }

    return { value: account, aliases: [...aliases] };
  });

  return entries
    .map((entry) => ({
      ...entry,
      aliases: entry.aliases.filter((alias) => (aliasCounts.get(alias) ?? 0) === 1),
    }))
    .filter((entry) => entry.aliases.length > 0);
}

function buildGoalAliasEntries(goals: SavingsGoal[]): Array<AliasEntry<SavingsGoal>> {
  const activeGoals = goals.filter((goal) => goal.status === 'active');
  const entries = activeGoals.map((goal) => ({
    value: goal,
    aliases: [normalizeForReply(goal.name)],
  }));

  if (activeGoals.length === 1) {
    entries.push({
      value: activeGoals[0],
      aliases: ['savings', 'my savings'],
    });
  }

  return entries;
}

function extractContextualAccount(
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

function extractGoalMention(
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

function extractAccountMention(
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

function extractMerchantFromTail(message: string): { merchant?: string; stripped: string } {
  const merchantMatch = message.match(/\bat\s+([a-z0-9][a-z0-9\s&'.-]*)$/i);
  if (!merchantMatch?.[1]) {
    return { stripped: message };
  }

  return {
    merchant: toTitleCase(normalizeWhitespace(merchantMatch[1])),
    stripped: normalizeWhitespace(message.replace(merchantMatch[0], ' ')),
  };
}

function extractDescription(message: string): string | undefined {
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

function inferMerchant(description?: string, category?: Category): string | undefined {
  if (!description) {
    return undefined;
  }
  if (category === 'Food' || category === 'Health' || category === 'Shopping') {
    return description;
  }
  return undefined;
}

function buildTransactionSignals(message: string, context: BerdeChatParserContext): TransactionSignals {
  const now = context.now ?? new Date();
  const { amount, stripped: withoutAmount } = extractAmount(normalizeWhitespace(message));
  const { date, stripped: withoutDate } = extractDate(withoutAmount, now);
  const { account, stripped: withoutAccount } = extractAccountMention(withoutDate, context.accounts);
  const { merchant, stripped: withoutMerchant } = extractMerchantFromTail(withoutAccount);
  const categoryMatch = findAliasMatch(withoutMerchant, CATEGORY_ALIASES);
  const incomeCategoryMatch = findAliasMatch(withoutMerchant, INCOME_CATEGORY_ALIASES);
  const entryType = detectTransactionType(withoutMerchant, categoryMatch.value, incomeCategoryMatch.value);
  const description = extractDescription(withoutMerchant);

  return {
    amount,
    entryType,
    category: categoryMatch.value,
    incomeCategory: incomeCategoryMatch.value,
    description,
    merchant: merchant ?? inferMerchant(description, categoryMatch.value),
    date,
    accountId: account?.id,
    accountName: account?.name,
  };
}

function mergeTransactionAction(
  existing: BerdeTransactionAction | undefined,
  message: string,
  context: BerdeChatParserContext,
): BerdeTransactionAction | null {
  const signals = buildTransactionSignals(message, context);
  const defaultAccount = resolvePreferredDefaultAccount(context.accounts);
  const account = context.accounts.find((entry) => entry.id === signals.accountId)
    ?? context.accounts.find((entry) => entry.id === existing?.accountId)
    ?? defaultAccount
    ?? undefined;

  if (
    !existing &&
    !signals.amount &&
    !signals.entryType &&
    !signals.category &&
    !signals.incomeCategory &&
    !signals.description &&
    !signals.merchant
  ) {
    return null;
  }

  const entryType = signals.entryType ?? existing?.entryType;

  return {
    id: existing?.id ?? createActionId('tx'),
    kind: 'transaction',
    entryType,
    amount: signals.amount ?? existing?.amount,
    category: entryType === 'expense' ? signals.category ?? existing?.category : undefined,
    incomeCategory: entryType === 'income' ? signals.incomeCategory ?? existing?.incomeCategory : undefined,
    description: signals.description ?? existing?.description,
    merchant: signals.merchant ?? existing?.merchant,
    date: signals.date ?? existing?.date ?? buildDateIso(context.now ?? new Date(), 0),
    accountId: signals.accountId ?? existing?.accountId ?? account?.id,
    accountName: signals.accountName ?? existing?.accountName ?? account?.name,
    paymentMethod: resolvePaymentMethodForAccount(account, entryType ?? 'expense'),
    sourceText: existing ? `${existing.sourceText} ${message}`.trim() : message,
  };
}

function parseTransferAction(
  message: string,
  context: BerdeChatParserContext,
  existing?: Extract<BerdeParsedAction, { kind: 'transfer' }>,
): Extract<BerdeParsedAction, { kind: 'transfer' }> | null {
  const normalized = normalizeForReply(message);
  const transferLike = /\b(transfer|move|send)\b/i.test(normalized) || /\bfrom\b.*\bto\b/i.test(normalized);
  if (!transferLike && !existing) {
    return null;
  }

  const now = context.now ?? new Date();
  const entries = buildAccountAliasEntries(context.accounts);
  const { amount, stripped: withoutAmount } = extractAmount(message);
  const { date, stripped: withoutDate } = extractDate(withoutAmount, now);
  const fromResult = extractContextualAccount(withoutDate, 'from', entries);
  const toResult = extractContextualAccount(fromResult.stripped, 'to', entries);

  let fromAccount = fromResult.account
    ?? (existing?.fromAccountId ? context.accounts.find((account) => account.id === existing.fromAccountId) : undefined);
  let toAccount = toResult.account
    ?? (existing?.toAccountId ? context.accounts.find((account) => account.id === existing.toAccountId) : undefined);

  if ((!fromAccount || !toAccount) && !fromResult.account && !toResult.account) {
    const genericMatches = entries.filter((entry) =>
      entry.aliases.some((alias) => new RegExp(`(^|\\W)${escapeRegExp(alias)}(?=$|\\W)`, 'i').test(normalized)),
    );
    if (genericMatches.length >= 2) {
      fromAccount = fromAccount ?? genericMatches[0].value;
      toAccount = toAccount ?? genericMatches[1].value;
    }
  }

  return {
    id: existing?.id ?? createActionId('transfer'),
    kind: 'transfer',
    amount: amount ?? existing?.amount,
    fromAccountId: fromAccount?.id ?? existing?.fromAccountId,
    fromAccountName: fromAccount?.name ?? existing?.fromAccountName,
    toAccountId: toAccount?.id ?? existing?.toAccountId,
    toAccountName: toAccount?.name ?? existing?.toAccountName,
    date: date ?? existing?.date ?? buildDateIso(now, 0),
    notes: extractDescription(toResult.stripped) ?? existing?.notes,
    sourceText: existing ? `${existing.sourceText} ${message}`.trim() : message,
  };
}

function parseSavingsAction(
  message: string,
  context: BerdeChatParserContext,
  existing?: Extract<BerdeParsedAction, { kind: 'savings' }>,
): Extract<BerdeParsedAction, { kind: 'savings' }> | null {
  const normalized = normalizeForReply(message);
  const savingsLike =
    /\b(save|saved|deposit|add)\b/i.test(normalized) ||
    /\b(withdraw|take out|pull out)\b/i.test(normalized) ||
    /\bsavings\b/i.test(normalized);
  if (!savingsLike && !existing) {
    return null;
  }

  const now = context.now ?? new Date();
  const { amount, stripped: withoutAmount } = extractAmount(message);
  const { date, stripped: withoutDate } = extractDate(withoutAmount, now);
  const { goal, stripped: withoutGoal } = extractGoalMention(withoutDate, context.savingsGoals ?? []);
  const savingsType = /\b(withdraw|take out|pull out)\b/i.test(normalized)
    ? 'withdrawal'
    : /\b(save|saved|deposit|add)\b/i.test(normalized)
      ? 'deposit'
      : existing?.savingsType;

  return {
    id: existing?.id ?? createActionId('savings'),
    kind: 'savings',
    amount: amount ?? existing?.amount,
    savingsType,
    goalId: goal?.id ?? existing?.goalId,
    goalName: goal?.name ?? existing?.goalName,
    note: extractDescription(withoutGoal) ?? existing?.note,
    date: date ?? existing?.date ?? buildDateIso(now, 0),
    sourceText: existing ? `${existing.sourceText} ${message}`.trim() : message,
  };
}

function findDebtByPerson(personName: string | undefined, debts: Debt[]): Debt | undefined {
  if (!personName) {
    return undefined;
  }

  const normalized = normalizeForReply(personName);
  return debts.find((debt) => normalizeForReply(debt.personName) === normalized);
}

function extractPersonFromDebtMessage(message: string): string | undefined {
  const lentMatch = message.match(/\b(?:lent|loaned)\s+([a-z][a-z\s'.-]+?)\s*(?:\d|$)/i);
  if (lentMatch?.[1]) {
    return toTitleCase(normalizeWhitespace(lentMatch[1]));
  }

  const borrowedMatch = message.match(/\bborrowed\s+\d+(?:\.\d+)?(?:\s*k)?\s+from\s+([a-z][a-z\s'.-]+)$/i);
  if (borrowedMatch?.[1]) {
    return toTitleCase(normalizeWhitespace(borrowedMatch[1]));
  }

  const paidBackMatch = message.match(/\b([a-z][a-z\s'.-]+?)\s+paid me back\b/i);
  if (paidBackMatch?.[1]) {
    return toTitleCase(normalizeWhitespace(paidBackMatch[1]));
  }

  const paidBackWithoutMeMatch = message.match(/\b([a-z][a-z\s'.-]+?)\s+paid back\b/i);
  if (paidBackWithoutMeMatch?.[1]) {
    return toTitleCase(normalizeWhitespace(paidBackWithoutMeMatch[1]));
  }

  const settleMatch = message.match(/\bsettle(?:d)?\s+(?:debt\s+with\s+)?([a-z][a-z\s'.-]+)$/i);
  if (settleMatch?.[1]) {
    return toTitleCase(normalizeWhitespace(settleMatch[1]));
  }

  return undefined;
}

function extractPersonFromDebtReply(message: string): string | undefined {
  const normalized = normalizeWhitespace(message);
  if (!normalized) {
    return undefined;
  }

  const cleaned = normalized
    .replace(/^(?:si|kay|from)\s+/i, '')
    .replace(/[?.!,]+$/g, '')
    .trim();

  if (!cleaned || /\d/.test(cleaned)) {
    return undefined;
  }

  const normalizedReply = normalizeForReply(cleaned);
  if (['me', 'i', 'ako', 'myself', 'ko'].includes(normalizedReply)) {
    return undefined;
  }

  if (!/^[a-z][a-z\s'.-]*$/i.test(cleaned)) {
    return undefined;
  }

  return toTitleCase(cleaned);
}

function parseDebtAction(
  message: string,
  context: BerdeChatParserContext,
  existing?: Extract<BerdeParsedAction, { kind: 'debt' }>,
): Extract<BerdeParsedAction, { kind: 'debt' }> | null {
  const normalized = normalizeForReply(message);
  const debtLike = /\b(lent|loaned|borrowed|utang|paid me back|settle|settled)\b/i.test(normalized);
  if (!debtLike && !existing) {
    return null;
  }

  const now = context.now ?? new Date();
  const { amount } = extractAmount(message);
  const personName = extractPersonFromDebtMessage(message) ?? existing?.personName;
  const debts = (context.debts ?? []).filter((debt) => debt.status === 'active');
  const matchingDebt = findDebtByPerson(personName, debts);

  if (/\bpaid me back\b/i.test(normalized) || /\b(?:settle|settled)\b/i.test(normalized)) {
    if (amount && matchingDebt) {
      if (amount < matchingDebt.amount - 0.009) {
        return {
          id: existing?.id ?? createActionId('debt'),
          kind: 'debt',
          debtMode: 'settle',
          settlementType: 'partial',
          debtId: matchingDebt.id,
          personName,
          amount,
          remainingAmount: Number((matchingDebt.amount - amount).toFixed(2)),
          reason: matchingDebt.reason ?? existing?.reason,
          direction: matchingDebt.direction ?? existing?.direction,
          date: buildDateIso(now, 0),
          sourceText: existing ? `${existing.sourceText} ${message}`.trim() : message,
        };
      }

      if (amount > matchingDebt.amount + 0.009) {
        return {
          id: existing?.id ?? createActionId('debt'),
          kind: 'debt',
          debtMode: 'settle',
          settlementType: 'partial',
          personName,
          amount,
          remainingAmount: undefined,
          reason: matchingDebt.reason ?? existing?.reason,
          direction: matchingDebt.direction ?? existing?.direction,
          date: buildDateIso(now, 0),
          sourceText: existing ? `${existing.sourceText} ${message}`.trim() : message,
        };
      }
    }

    if (amount && matchingDebt && Math.abs(matchingDebt.amount - amount) > 0.009) {
      return {
        id: existing?.id ?? createActionId('debt'),
        kind: 'debt',
        debtMode: 'settle',
        settlementType: 'partial',
        personName,
        amount,
        reason: matchingDebt.reason ?? existing?.reason,
        date: buildDateIso(now, 0),
        sourceText: existing ? `${existing.sourceText} ${message}`.trim() : message,
      };
    }

    return {
      id: existing?.id ?? createActionId('debt'),
      kind: 'debt',
      debtMode: 'settle',
      settlementType: amount ? 'partial' : 'full',
      debtId: matchingDebt?.id ?? existing?.debtId,
      personName,
      amount: amount ?? matchingDebt?.amount ?? existing?.amount,
      reason: matchingDebt?.reason ?? existing?.reason,
      direction: matchingDebt?.direction ?? existing?.direction,
      date: buildDateIso(now, 0),
      sourceText: existing ? `${existing.sourceText} ${message}`.trim() : message,
    };
  }

  const direction: DebtDirection | undefined =
    /\b(lent|loaned)\b/i.test(normalized)
      ? 'owed'
      : /\b(borrowed|utang)\b/i.test(normalized)
        ? 'owing'
        : existing?.direction;

  return {
    id: existing?.id ?? createActionId('debt'),
    kind: 'debt',
    debtMode: 'create',
    personName,
    direction,
    amount: amount ?? existing?.amount,
    reason: extractDescription(message) ?? existing?.reason ?? 'Chat entry',
    date: buildDateIso(now, 0),
    sourceText: existing ? `${existing.sourceText} ${message}`.trim() : message,
  };
}

function createUnsupportedResponse(message: string): BerdeChatResponse {
  const normalized = normalizeForReply(message);

  if (/^(?:what|how|should|can|could|would|when|where|why)\b/i.test(message)) {
    return {
      intent: {
        kind: 'unsupported',
        stage: 'unsupported',
        confidence: 0,
        confidenceLabel: 'low',
        missingFields: [],
        quickReplies: [...STARTER_QUICK_REPLIES],
      },
      replyText:
        "Gets ko, pero pang-log muna ako dito. Sabihin mo lang kung may ginastos, natanggap, nilipat, o utang na kailangan i-track.",
    };
  }

  if (/\b(?:paid me back|paid back|settle|settled)\b/i.test(normalized)) {
    return {
      intent: {
        kind: 'unsupported',
        stage: 'unsupported',
        confidence: 0,
        confidenceLabel: 'low',
        missingFields: [],
        quickReplies: ['Track utang', 'Log expense', 'Move money'],
      },
      replyText:
        "Mukhang debt update 'yan, pero kulang pa ako sa exact match. Banggitin mo kung sino, magkano ang binayad, at alin sa active utang ang gagalaw.",
    };
  }

  if (/^(?:hi|hello|hey|yo|sup|kamusta|kumusta)\b/i.test(normalized) || normalized.split(/\s+/).length <= 3) {
    return {
      intent: {
        kind: 'unsupported',
        stage: 'unsupported',
        confidence: 0,
        confidenceLabel: 'low',
        missingFields: [],
        quickReplies: [...STARTER_QUICK_REPLIES],
      },
      replyText:
        "Ready ako mag-log. Pwede mong sabihin ang expense, income, transfer, o utang in one line tapos gagawa ako ng draft.",
    };
  }

  return {
    intent: {
      kind: 'unsupported',
      stage: 'unsupported',
      confidence: 0,
      confidenceLabel: 'low',
      missingFields: [],
      quickReplies: [...STARTER_QUICK_REPLIES],
    },
    replyText:
      "Hindi ko pa ma-log 'yan as-is. Try mo sabihin in a direct logging format, then I'll draft it before anything gets saved.",
  };
}

function parseFreshAction(message: string, context: BerdeChatParserContext): BerdeParsedAction | null {
  const normalized = normalizeForReply(message);

  if (/\b(transfer|move|send)\b/i.test(normalized) || /\bfrom\b.*\bto\b/i.test(normalized)) {
    return parseTransferAction(message, context);
  }
  if (/\b(save|saved|deposit|add|withdraw|take out|pull out|savings)\b/i.test(normalized)) {
    const savingsAction = parseSavingsAction(message, context);
    if (savingsAction) {
      return savingsAction;
    }
  }
  if (/\b(lent|loaned|borrowed|utang|paid me back|settle|settled)\b/i.test(normalized)) {
    const debtAction = parseDebtAction(message, context);
    if (debtAction) {
      return debtAction;
    }
  }

  return mergeTransactionAction(undefined, message, context);
}

function getMissingFieldsForAction(action: BerdeParsedAction): BerdeActionMissingField[] {
  switch (action.kind) {
    case 'transaction': {
      const missing: BerdeActionMissingField[] = [];
      if (typeof action.amount !== 'number') {
        missing.push('amount');
      }
      if (!action.entryType) {
        missing.push('type');
        return missing;
      }
      if (action.entryType === 'expense' && !action.category) {
        missing.push('category');
      }
      if (action.entryType === 'income' && !action.incomeCategory) {
        missing.push('incomeCategory');
      }
      return missing;
    }
    case 'transfer': {
      const missing: BerdeActionMissingField[] = [];
      if (typeof action.amount !== 'number') {
        missing.push('amount');
      }
      if (!action.fromAccountId) {
        missing.push('fromAccount');
      }
      if (!action.toAccountId) {
        missing.push('toAccount');
      }
      return missing;
    }
    case 'savings': {
      const missing: BerdeActionMissingField[] = [];
      if (typeof action.amount !== 'number') {
        missing.push('amount');
      }
      if (!action.savingsType) {
        missing.push('savingsType');
      }
      if (!action.goalId) {
        missing.push('goal');
      }
      return missing;
    }
    case 'debt': {
      const missing: BerdeActionMissingField[] = [];
      if (!action.debtMode) {
        missing.push('debt');
        return missing;
      }
      if (action.debtMode === 'settle') {
        if (!action.debtId) {
          missing.push('debt');
        }
        return missing;
      }
      if (!action.personName) {
        missing.push('person');
      }
      if (!action.direction) {
        missing.push('direction');
      }
      if (typeof action.amount !== 'number') {
        missing.push('amount');
      }
      if (!action.reason) {
        missing.push('reason');
      }
      return missing;
    }
  }
}

function getConfidence(batch?: BerdeParsedActionBatch): { score: number; label: 'low' | 'medium' | 'high' } {
  if (!batch || batch.actions.length === 0) {
    return { score: 0, label: 'low' };
  }

  const completionScores = batch.actions.map((action) => {
    const missing = getMissingFieldsForAction(action);
    if (missing.length === 0) {
      return 1;
    }
    if (missing.length === 1) {
      return 0.65;
    }
    return 0.35;
  });

  const score = Number((completionScores.reduce((sum, value) => sum + value, 0) / completionScores.length).toFixed(2));
  if (score >= 0.85) {
    return { score, label: 'high' };
  }
  if (score >= 0.65) {
    return { score, label: 'medium' };
  }
  return { score, label: 'low' };
}

function getQuickReplies(field?: BerdeActionMissingField, context?: BerdeChatParserContext): string[] {
  if (field === 'type') {
    return ['Expense', 'Income'];
  }
  if (field === 'category') {
    return ['Food', 'Transportation', 'Shopping', 'Health', 'Miscellaneous'];
  }
  if (field === 'incomeCategory') {
    return ['Salary', 'Freelance', 'Bonus', 'Gift', 'Other Income'];
  }
  if (field === 'fromAccount' || field === 'toAccount') {
    return (context?.accounts ?? [])
      .filter((account) => !account.isArchived)
      .slice(0, 4)
      .map((account) => account.name);
  }
  if (field === 'savingsType') {
    return ['Deposit', 'Withdrawal'];
  }
  if (field === 'direction') {
    return ['They owe me', 'I owe them'];
  }
  if (field === 'goal') {
    return (context?.savingsGoals ?? [])
      .filter((goal) => goal.status === 'active')
      .slice(0, 4)
      .map((goal) => goal.name);
  }
  if (field === 'debt') {
    return (context?.debts ?? [])
      .filter((debt) => debt.status === 'active')
      .slice(0, 4)
      .map((debt) => debt.personName);
  }
  return [];
}

function getActionReference(action: BerdeParsedAction, index: number, batchSize: number): string {
  if (batchSize > 1) {
    return `For item ${index + 1}`;
  }
  switch (action.kind) {
    case 'transaction':
      return action.description || action.merchant ? `For "${action.description || action.merchant}"` : 'For this entry';
    case 'transfer':
      return 'For this transfer';
    case 'savings':
      return 'For this savings move';
    case 'debt':
      return 'For this debt entry';
  }
}

function getFollowUpPrompt(
  action: BerdeParsedAction,
  field: BerdeActionMissingField,
  index: number,
  batchSize: number,
): string {
  const prefix = getActionReference(action, index, batchSize);
  if (field === 'type') return `${prefix}, should I log it as an expense or income?`;
  if (field === 'category') return `${prefix}, which category should I use?`;
  if (field === 'incomeCategory') return `${prefix}, was that salary, freelance, bonus, gift, or something else?`;
  if (field === 'fromAccount') return `${prefix}, which account is the money coming from?`;
  if (field === 'toAccount') return `${prefix}, which account is the money going to?`;
  if (field === 'goal') return `${prefix}, which savings goal should I use?`;
  if (field === 'savingsType') return `${prefix}, is this a deposit or a withdrawal?`;
  if (field === 'direction') return `${prefix}, do they owe you or do you owe them?`;
  if (field === 'person') return `${prefix}, who is this debt entry for?`;
  if (field === 'reason') return `${prefix}, what is the reason for it?`;
  if (field === 'debt') return `${prefix}, which existing debt should I settle?`;
  return `${prefix}, how much should I log?`;
}

function findFirstIncompleteAction(batch: BerdeParsedActionBatch): { index: number; field: BerdeActionMissingField } | null {
  for (let index = 0; index < batch.actions.length; index += 1) {
    const missingFields = getMissingFieldsForAction(batch.actions[index]);
    if (missingFields.length > 0) {
      return { index, field: missingFields[0] };
    }
  }
  return null;
}

function createBatchResponse(
  batch: BerdeParsedActionBatch,
  context: BerdeChatParserContext,
  replyOverride?: string,
): BerdeChatResponse {
  const incomplete = findFirstIncompleteAction(batch);
  const confidence = getConfidence(batch);

  if (incomplete) {
    return {
      intent: {
        kind: 'ambiguous',
        stage: 'collecting_field',
        confidence: confidence.score,
        confidenceLabel: confidence.label,
        missingFields: getMissingFieldsForAction(batch.actions[incomplete.index]),
        expectedField: incomplete.field,
        quickReplies: getQuickReplies(incomplete.field, context),
        batch: {
          ...batch,
          focusActionIndex: incomplete.index,
        },
      },
      replyText: getFollowUpPrompt(batch.actions[incomplete.index], incomplete.field, incomplete.index, batch.actions.length),
    };
  }

  return {
    intent: {
      kind: 'action_batch',
      stage: 'awaiting_confirmation',
      confidence: confidence.score,
      confidenceLabel: confidence.label,
      missingFields: [],
      quickReplies: ['Yes', 'Cancel'],
      batch,
    },
    replyText:
      replyOverride
      ?? (batch.actions.length > 1
        ? `I parsed ${batch.actions.length} actions. Review them and confirm when you're ready.`
        : "Here's what I understood. Review it and confirm when you're ready."),
  };
}

function interpretDirectConfirmation(message: string, context: BerdeChatParserContext): BerdeChatResponse | null {
  if (!context.pendingBatch || context.pendingIntent?.stage !== 'awaiting_confirmation') {
    return null;
  }
  if (!YES_REPLIES.has(normalizeForReply(message))) {
    return null;
  }

  const confidence = getConfidence(context.pendingBatch);
  return {
    intent: {
      kind: 'confirm',
      stage: 'awaiting_confirmation',
      confidence: confidence.score,
      confidenceLabel: confidence.label,
      missingFields: [],
      quickReplies: ['Yes', 'Cancel'],
      batch: context.pendingBatch,
    },
    replyText: "Locked in. I'll log that now.",
  };
}

function mergeFollowUpIntoAction(
  action: BerdeParsedAction,
  message: string,
  context: BerdeChatParserContext,
  expectedField?: BerdeActionMissingField,
): BerdeParsedAction {
  if (action.kind === 'transaction') {
    return mergeTransactionAction(action, message, context) ?? action;
  }
  if (action.kind === 'transfer') {
    return parseTransferAction(message, context, action) ?? action;
  }
  if (action.kind === 'savings') {
    const savingsAction = parseSavingsAction(message, context, action) ?? action;
    const normalized = normalizeForReply(message);
    if (savingsAction.kind === 'savings' && !savingsAction.savingsType) {
      if (normalized === 'deposit') savingsAction.savingsType = 'deposit';
      if (normalized === 'withdrawal') savingsAction.savingsType = 'withdrawal';
    }
    return savingsAction;
  }
  if (action.kind === 'debt') {
    const normalized = normalizeForReply(message);

    if (expectedField === 'person' && action.debtMode === 'create' && !action.personName) {
      const personName = extractPersonFromDebtReply(message);
      if (personName) {
        return {
          ...action,
          personName,
          sourceText: `${action.sourceText} ${message}`.trim(),
        };
      }
    }

    if (expectedField === 'debt' && action.debtMode === 'settle' && !action.debtId) {
      const personName = extractPersonFromDebtReply(message);
      const matchingDebt = findDebtByPerson(personName, (context.debts ?? []).filter((debt) => debt.status === 'active'));
      if (matchingDebt) {
        const settlementAmount = typeof action.amount === 'number' ? action.amount : matchingDebt.amount;
        const isPartial = settlementAmount < matchingDebt.amount - 0.009;
        return {
          ...action,
          debtId: matchingDebt.id,
          personName: matchingDebt.personName,
          direction: matchingDebt.direction,
          reason: matchingDebt.reason ?? action.reason,
          amount: settlementAmount,
          settlementType: isPartial ? 'partial' : 'full',
          remainingAmount: isPartial ? Number((matchingDebt.amount - settlementAmount).toFixed(2)) : undefined,
          sourceText: `${action.sourceText} ${message}`.trim(),
        };
      }
    }

    if (action.debtMode === 'create' && !action.direction) {
      if (normalized === 'they owe me') {
        return {
          ...action,
          direction: 'owed',
          sourceText: `${action.sourceText} ${message}`.trim(),
        };
      }
      if (normalized === 'i owe them') {
        return {
          ...action,
          direction: 'owing',
          sourceText: `${action.sourceText} ${message}`.trim(),
        };
      }
    }
  }

  const debtAction = parseDebtAction(message, context, action) ?? action;
  if (debtAction.kind === 'debt' && debtAction.debtMode === 'create' && !debtAction.direction) {
    const normalized = normalizeForReply(message);
    if (normalized === 'they owe me') debtAction.direction = 'owed';
    if (normalized === 'i owe them') debtAction.direction = 'owing';
  }
  return debtAction;
}

function applyFollowUp(message: string, context: BerdeChatParserContext): BerdeChatResponse | null {
  if (!context.pendingBatch || context.pendingIntent?.stage !== 'collecting_field') {
    return null;
  }

  const focusIndex = context.pendingBatch.focusActionIndex ?? findFirstIncompleteAction(context.pendingBatch)?.index;
  if (focusIndex === undefined) {
    return null;
  }

  const expectedField = context.pendingIntent.expectedField;
  const nextActions = context.pendingBatch.actions.map((action, index) =>
    index === focusIndex ? mergeFollowUpIntoAction(action, message, context, expectedField) : action,
  );

  return createBatchResponse(
    {
      actions: nextActions,
      focusActionIndex: focusIndex,
    },
    context,
    "Nice, that completes it. Review the draft and confirm when you're ready.",
  );
}

export function parseBerdeChatInput(
  message: string,
  context: BerdeChatParserContext,
): BerdeChatResponse {
  const sourceText = normalizeWhitespace(message);
  const normalizedSource = normalizeForReply(sourceText);
  if (!sourceText) {
    return createUnsupportedResponse(sourceText);
  }

  const directConfirmation = interpretDirectConfirmation(sourceText, context);
  if (directConfirmation) {
    return directConfirmation;
  }

  if (!context.pendingBatch && YES_REPLIES.has(normalizedSource)) {
    return createUnsupportedResponse(sourceText);
  }

  if (!context.pendingBatch && /^(?:hi|hello|hey|yo|sup|kamusta|kumusta)\b/i.test(sourceText)) {
    return createUnsupportedResponse(sourceText);
  }

  if (
    !context.pendingBatch
    && /^(?:what|how|should|can|could|would|when|where|why)\b/i.test(sourceText)
  ) {
    return createUnsupportedResponse(sourceText);
  }

  const followUp = applyFollowUp(sourceText, context);
  if (followUp) {
    return followUp;
  }

  const actions = splitCompositeMessage(sourceText)
    .map((segment) => parseFreshAction(segment, context))
    .filter((action): action is BerdeParsedAction => Boolean(action));

  if (actions.length === 0) {
    return createUnsupportedResponse(sourceText);
  }

  return createBatchResponse({ actions }, context);
}
