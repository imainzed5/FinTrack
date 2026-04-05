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
  'bayad',
] as const;

const INCOME_VERBS = [
  'received',
  'earned',
  'got',
  'made',
  'allowance',
  'sweldo',
  'sahod',
  'raket',
  'sideline',
  'padala',
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
  linggo: 0,
  monday: 1,
  lunes: 1,
  tuesday: 2,
  martes: 2,
  wednesday: 3,
  miyerkules: 3,
  mierkules: 3,
  thursday: 4,
  huwebes: 4,
  friday: 5,
  biyernes: 5,
  saturday: 6,
  sabado: 6,
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
      'pamasahe ko',
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
    aliases: ['bill', 'bills', 'wifi', 'internet', 'electricity', 'water', 'utilities', 'rent', 'upa', 'load', 'mobile load', 'data', 'kuryente', 'tubig'],
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
    aliases: ['medicine', 'meds', 'watsons', 'clinic', 'doctor', 'health', 'hospital', 'pharmacy', 'gamot'],
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
  { value: 'Freelance', aliases: ['freelance', 'client work', 'raket', 'client', 'bayad ni client'] },
  { value: 'Side Job', aliases: ['sideline', 'side job', 'side hustle', 'raket extra'] },
  { value: 'Part-time', aliases: ['part time', 'part-time'] },
  { value: 'Bonus', aliases: ['bonus', 'incentive'] },
  { value: 'Refund', aliases: ['refund', 'reimbursement', 'binalik'] },
  { value: 'Gift', aliases: ['gift', 'allowance', 'baon', 'padala'] },
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
  'lang',
  'mga',
  'around',
  'about',
  'roughly',
  'approximately',
  'halos',
  'approx',
  'may',
  'utang',
  'kay',
  'ki',
  'si',
  'ni',
  'sakin',
  'akin',
  'sa',
  'akin',
  'ng',
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

function normalizeChatMessage(value: string): string {
  return normalizeWhitespace(
    value
      .replace(/\bsa akin\b/gi, ' sakin ')
      .replace(/\bnoong\b/gi, ' nung ')
      .replace(/\bsa'kin\b/gi, ' sakin ')
      .replace(/\bnakabayad\b/gi, ' nagbayad '),
  );
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
  const transferLike =
    /\b(transfer|move|send|lipat|nilipat)\b/i.test(normalized) || /\bfrom\b.*\bto\b/i.test(normalized);
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
    /\b(save|saved|deposit|add|hulog|dagdag)\b/i.test(normalized) ||
    /\b(withdraw|take out|pull out|kuha)\b/i.test(normalized) ||
    /\b(savings|ipon)\b/i.test(normalized);
  if (!savingsLike && !existing) {
    return null;
  }

  const now = context.now ?? new Date();
  const { amount, stripped: withoutAmount } = extractAmount(message);
  const { date, stripped: withoutDate } = extractDate(withoutAmount, now);
  const { goal, stripped: withoutGoal } = extractGoalMention(withoutDate, context.savingsGoals ?? []);
  const savingsType = /\b(withdraw|take out|pull out|kuha)\b/i.test(normalized)
    ? 'withdrawal'
    : /\b(save|saved|deposit|add|hulog|dagdag)\b/i.test(normalized)
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

function findDebtCandidatesByPerson(personName: string | undefined, debts: Debt[]): Debt[] {
  if (!personName) {
    return [];
  }

  const normalized = normalizeForReply(personName);
  return debts.filter((debt) => normalizeForReply(debt.personName) === normalized);
}

function extractPersonFromDebtReply(message: string): string | undefined {
  const normalized = normalizeWhitespace(message);
  if (!normalized) {
    return undefined;
  }

  const cleaned = normalized
    .replace(/^(?:si|kay|ki|ni|from|to)\s+/i, '')
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

function inferDebtMode(
  message: string,
  debts: Debt[],
  existing?: Extract<BerdeParsedAction, { kind: 'debt' }>,
): 'create' | 'settle' | undefined {
  const normalized = normalizeForReply(message);
  if (
    /\b(paid me back|paid back|settle|settled|nagbayad|bayad utang|debt payment)\b/i.test(normalized)
    || /\bpaid\b/i.test(normalized)
  ) {
    return 'settle';
  }

  if (
    /\b(lent|loaned|borrowed|utang|pinahiram|may utang|i owe)\b/i.test(normalized)
    || debts.some((debt) => new RegExp(`(^|\\W)${escapeRegExp(normalizeForReply(debt.personName))}(?=$|\\W)`, 'i').test(normalized))
  ) {
    return 'create';
  }

  return existing?.debtMode;
}

function inferDebtDirection(
  message: string,
  existing?: Extract<BerdeParsedAction, { kind: 'debt' }>,
): { direction?: DebtDirection; source?: 'explicit' | 'inferred' } {
  const normalized = normalizeForReply(message);

  if (
    /\b(they owe me|siya may utang sakin|siya may utang sa akin)\b/i.test(normalized)
    || /\b(?:[a-z][a-z\s'.-]+)\s+may utang sakin\b/i.test(normalized)
    || /\b(?:[a-z][a-z\s'.-]+)\s+may utang sa akin\b/i.test(normalized)
    || /\bmay utang(?:\s+si)?\s+[a-z][a-z\s'.-]+\s+(?:sakin|sa akin)\b/i.test(normalized)
    || /\b(lent|loaned|pinahiram)\b/i.test(normalized)
  ) {
    return { direction: 'owed', source: 'explicit' };
  }

  if (
    /\b(i owe|i owe them|may utang ako|utang ko|borrowed|umutang)\b/i.test(normalized)
    || /\butang\s+(?:kay|ki)\b/i.test(normalized)
    || /\bnagbayad ako kay\b/i.test(normalized)
  ) {
    return { direction: 'owing', source: 'explicit' };
  }

  if (/\bmay utang\b/i.test(normalized) || /\butang\b/i.test(normalized)) {
    return { direction: undefined, source: 'inferred' };
  }

  return {
    direction: existing?.direction,
    source: existing?.directionSource,
  };
}

function extractPersonFromDebtMessage(message: string, mode?: 'create' | 'settle'): string | undefined {
  const patterns = [
    /\b(?:lent|loaned)\s+([a-z][a-z\s'.-]+?)\s*(?:\d|$)/i,
    /\b(?:borrowed|i owe|utang)\s+(?:kay|ki|from)\s+([a-z][a-z\s'.-]+?)(?=(?:\s+(?:ng\s+)?(?:\u20b1|php|p)?\s*\d)|$|\s+(?:for|dahil|para)\b)/i,
    /\b(?:borrowed)\s+\d+(?:\.\d+)?(?:\s*k)?\s+from\s+([a-z][a-z\s'.-]+)$/i,
    /\b(?:may utang ako|umutang ako)\s+(?:kay|ki)\s+([a-z][a-z\s'.-]+?)(?=(?:\s+(?:ng\s+)?(?:\u20b1|php|p)?\s*\d)|$|\s+(?:for|dahil|para)\b)/i,
    /\b(?:pinahiram(?: ko)?)\s+(?:si\s+)?([a-z][a-z\s'.-]+?)(?=(?:\s+(?:ng\s+)?(?:\u20b1|php|p)?\s*\d)|$|\s+(?:for|dahil|para)\b)/i,
    /\b(?:si\s+)?([a-z][a-z\s'.-]+?)\s+may utang\s+(?:sakin|sa akin)\b/i,
    /\bmay utang\s+(?:si\s+)?([a-z][a-z\s'.-]+?)\s+(?:sakin|sa akin)\b/i,
    /\b([a-z][a-z\s'.-]+?)\s+paid me back\b/i,
    /\b([a-z][a-z\s'.-]+?)\s+paid back\b/i,
    /\bnagbayad\s+(?:si\s+)?([a-z][a-z\s'.-]+?)(?=(?:\s+(?:ng\s+)?(?:\u20b1|php|p)?\s*\d)|$)/i,
    /\b(?:si\s+)?([a-z][a-z\s'.-]+?)\s+nagbayad\b/i,
    /\b(?:paid me back|bayad utang|settle(?:d)?(?: debt)?(?: with)?)\s+(?:kay|ki|with)?\s*([a-z][a-z\s'.-]+)$/i,
    /\bnagbayad ako\s+(?:kay|ki)\s+([a-z][a-z\s'.-]+)$/i,
    /\bbinayaran ako ni\s+([a-z][a-z\s'.-]+)$/i,
  ];

  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match?.[1]) {
      return toTitleCase(normalizeWhitespace(match[1]));
    }
  }

  if (mode === 'create') {
    const kayMatch = message.match(/\butang\s+(?:kay|ki)\s+([a-z][a-z\s'.-]+)$/i);
    if (kayMatch?.[1]) {
      return toTitleCase(normalizeWhitespace(kayMatch[1]));
    }

    const mayUtangMatch = message.match(/\b([a-z][a-z\s'.-]+?)\s+may utang\s+(?:sakin|sa akin)$/i);
    if (mayUtangMatch?.[1]) {
      return toTitleCase(normalizeWhitespace(mayUtangMatch[1]));
    }

    const ambiguousCreateMatch = message.match(/\b([a-z][a-z\s'.-]+?)\s+utang\s+(?:(?:\u20b1|php|p)?\s*\d|\w)/i);
    if (ambiguousCreateMatch?.[1]) {
      return toTitleCase(normalizeWhitespace(ambiguousCreateMatch[1]));
    }
  }

  if (mode === 'settle') {
    const paidMatch = message.match(/\b([a-z][a-z\s'.-]+?)\s+paid\b/i);
    if (paidMatch?.[1]) {
      return toTitleCase(normalizeWhitespace(paidMatch[1]));
    }
  }

  return undefined;
}

function inferDebtReason(message: string, personName?: string): string | undefined {
  let normalized = normalizeWhitespace(
    message
      .replace(/\b(?:lent|loaned|borrowed|utang|pinahiram|may utang|paid me back|paid back|settle|settled|nagbayad|bayad utang|i owe)\b/gi, ' ')
      .replace(/\b(?:ako|ko|si|ni|kay|ki|from|to|with|sakin|sa akin|me|them)\b/gi, ' ')
      .replace(/\b(?:for|dahil sa|dahil|para sa|para)\b/gi, ' ')
      .replace(/\b(?:lang|mga|around|about|roughly|approximately|approx|halos)\b/gi, ' '),
  );

  if (personName) {
    normalized = normalizeWhitespace(normalized.replace(new RegExp(`(^|\\W)${escapeRegExp(personName)}(?=$|\\W)`, 'i'), ' '));
  }

  return extractDescription(normalized);
}

function isMeaningfulDebtReason(reason: string | undefined, personName?: string): boolean {
  if (!reason) {
    return false;
  }

  const normalizedReason = normalizeForReply(reason);
  if (!normalizedReason || normalizedReason === 'chat entry') {
    return false;
  }

  if (personName && normalizedReason === normalizeForReply(personName)) {
    return false;
  }

  if (normalizedReason.includes('utang') && (!personName || normalizedReason === `${normalizeForReply(personName)} utang`)) {
    return false;
  }

  return true;
}

function buildDebtChoiceLabel(debt: Debt): string {
  const dateLabel = new Date(debt.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${debt.personName} · ${debt.reason || 'No note'} · ${dateLabel}`;
}

function findDebtByReplyValue(message: string, debts: Debt[]): Debt | undefined {
  const normalizedMessage = normalizeForReply(message);
  const labelMatch = debts.find((debt) => normalizeForReply(buildDebtChoiceLabel(debt)) === normalizedMessage);
  if (labelMatch) {
    return labelMatch;
  }

  const personName = extractPersonFromDebtReply(message);
  if (!personName) {
    return undefined;
  }

  return debts.find((debt) => normalizeForReply(debt.personName) === normalizeForReply(personName));
}

function parseDebtAction(
  message: string,
  context: BerdeChatParserContext,
  existing?: Extract<BerdeParsedAction, { kind: 'debt' }>,
): Extract<BerdeParsedAction, { kind: 'debt' }> | null {
  const normalized = normalizeForReply(message);
  const debts = (context.debts ?? []).filter((debt) => debt.status === 'active');
  const debtLike = /\b(lent|loaned|borrowed|utang|paid me back|settle|settled|pinahiram|may utang|nagbayad|paid)\b/i.test(normalized);
  if (!debtLike && !existing) {
    return null;
  }

  const now = context.now ?? new Date();
  const { amount } = extractAmount(message);
  const debtMode = inferDebtMode(message, debts, existing);
  const personName = extractPersonFromDebtMessage(message, debtMode) ?? existing?.personName;
  const debtCandidates = findDebtCandidatesByPerson(personName, debts);
  const matchingDebt = debtCandidates[0];
  const inferredDirection = inferDebtDirection(message, existing);

  if (debtMode === 'settle') {
    if (amount && matchingDebt && debtCandidates.length === 1) {
      if (amount < matchingDebt.amount - 0.009) {
        return {
          id: existing?.id ?? createActionId('debt'),
          kind: 'debt',
          debtMode: 'settle',
          settlementType: 'partial',
          debtId: matchingDebt.id,
          debtCandidateIds: [matchingDebt.id],
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
          debtCandidateIds: debtCandidates.map((debt) => debt.id),
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
        debtCandidateIds: debtCandidates.map((debt) => debt.id),
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
      debtId: debtCandidates.length === 1 ? matchingDebt?.id ?? existing?.debtId : existing?.debtId,
      debtCandidateIds: debtCandidates.length > 0 ? debtCandidates.map((debt) => debt.id) : existing?.debtCandidateIds,
      personName,
      amount: amount ?? matchingDebt?.amount ?? existing?.amount,
      reason: matchingDebt?.reason ?? existing?.reason,
      direction: matchingDebt?.direction ?? existing?.direction,
      remainingAmount:
        amount && matchingDebt && amount < matchingDebt.amount - 0.009
          ? Number((matchingDebt.amount - amount).toFixed(2))
          : existing?.remainingAmount,
      date: buildDateIso(now, 0),
      sourceText: existing ? `${existing.sourceText} ${message}`.trim() : message,
    };
  }

  return {
    id: existing?.id ?? createActionId('debt'),
    kind: 'debt',
    debtMode: 'create',
    personName,
    direction: inferredDirection.direction,
    directionSource: inferredDirection.source,
    amount: amount ?? existing?.amount,
    reason: (() => {
      const candidateReason = inferDebtReason(message, personName) ?? existing?.reason;
      return isMeaningfulDebtReason(candidateReason, personName) ? candidateReason : undefined;
    })(),
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

  if (/\b(transfer|move|send|lipat|nilipat)\b/i.test(normalized) || /\bfrom\b.*\bto\b/i.test(normalized)) {
    return parseTransferAction(message, context);
  }
  if (/\b(save|saved|deposit|add|withdraw|take out|pull out|savings|hulog|dagdag|ipon|kuha)\b/i.test(normalized)) {
    const savingsAction = parseSavingsAction(message, context);
    if (savingsAction) {
      return savingsAction;
    }
  }
  if (/\b(lent|loaned|borrowed|utang|paid me back|settle|settled|pinahiram|may utang|nagbayad|paid)\b/i.test(normalized)) {
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
    return ['Food', 'Transportation', 'Utilities', 'Health', 'Miscellaneous'];
  }
  if (field === 'incomeCategory') {
    return ['Salary', 'Freelance', 'Side Job', 'Gift', 'Other Income'];
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
      .map((debt) => buildDebtChoiceLabel(debt));
  }
  if (field === 'amount') {
    return ['100', '250', '500', '1000'];
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
  if (field === 'person') return `${prefix}, sino ang person sa utang na ito?`;
  if (field === 'reason') return `${prefix}, para saan ito kung gusto mong lagyan ng note?`;
  if (field === 'debt') return `${prefix}, aling active utang ang gagalaw dito?`;
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

function resolveAmountReply(message: string): number | undefined {
  return extractAmount(message).amount;
}

function resolveDateReply(message: string, now: Date): string | undefined {
  return extractDate(message, now).date;
}

function resolveCategoryReply(message: string): Category | undefined {
  return findAliasMatch(message, CATEGORY_ALIASES).value;
}

function resolveIncomeCategoryReply(message: string): IncomeCategory | undefined {
  return findAliasMatch(message, INCOME_CATEGORY_ALIASES).value;
}

function resolveAccountReply(message: string, accounts: Account[]): Account | undefined {
  return extractAccountMention(message, accounts).account;
}

function resolveGoalReply(message: string, goals: SavingsGoal[]): SavingsGoal | undefined {
  return extractGoalMention(message, goals).goal;
}

function resolveDebtDirectionReply(message: string): DebtDirection | undefined {
  const normalized = normalizeForReply(message);
  if (
    normalized === 'they owe me'
    || normalized === 'me'
    || normalized === 'mine'
    || normalized === 'siya may utang sakin'
    || normalized === 'may utang siya sakin'
    || normalized === 'sila may utang sakin'
    || normalized === 'ako'
    || normalized === 'sakin'
  ) {
    return 'owed';
  }
  if (
    normalized === 'i owe them'
    || normalized === 'may utang ako'
    || normalized === 'utang ko'
    || normalized === 'ako may utang'
  ) {
    return 'owing';
  }
  return undefined;
}

function mergeFollowUpIntoAction(
  action: BerdeParsedAction,
  message: string,
  context: BerdeChatParserContext,
  expectedField?: BerdeActionMissingField,
): BerdeParsedAction {
  const now = context.now ?? new Date();

  if (action.kind === 'transaction') {
    if (expectedField === 'amount') {
      const amount = resolveAmountReply(message);
      if (typeof amount === 'number') {
        return { ...action, amount, sourceText: `${action.sourceText} ${message}`.trim() };
      }
    }
    if (expectedField === 'category') {
      const category = resolveCategoryReply(message);
      if (category) {
        return { ...action, category, sourceText: `${action.sourceText} ${message}`.trim() };
      }
    }
    if (expectedField === 'incomeCategory') {
      const incomeCategory = resolveIncomeCategoryReply(message);
      if (incomeCategory) {
        return { ...action, incomeCategory, sourceText: `${action.sourceText} ${message}`.trim() };
      }
    }
    if (expectedField === 'type') {
      const entryType = detectTransactionType(message);
      if (entryType) {
        return { ...action, entryType, sourceText: `${action.sourceText} ${message}`.trim() };
      }
    }
    return mergeTransactionAction(action, message, context) ?? action;
  }
  if (action.kind === 'transfer') {
    if (expectedField === 'amount') {
      const amount = resolveAmountReply(message);
      if (typeof amount === 'number') {
        return { ...action, amount, sourceText: `${action.sourceText} ${message}`.trim() };
      }
    }
    if (expectedField === 'fromAccount') {
      const account = resolveAccountReply(message, context.accounts);
      if (account) {
        return {
          ...action,
          fromAccountId: account.id,
          fromAccountName: account.name,
          sourceText: `${action.sourceText} ${message}`.trim(),
        };
      }
    }
    if (expectedField === 'toAccount') {
      const account = resolveAccountReply(message, context.accounts);
      if (account) {
        return {
          ...action,
          toAccountId: account.id,
          toAccountName: account.name,
          sourceText: `${action.sourceText} ${message}`.trim(),
        };
      }
    }
    return parseTransferAction(message, context, action) ?? action;
  }
  if (action.kind === 'savings') {
    if (expectedField === 'amount') {
      const amount = resolveAmountReply(message);
      if (typeof amount === 'number') {
        return { ...action, amount, sourceText: `${action.sourceText} ${message}`.trim() };
      }
    }
    if (expectedField === 'goal') {
      const goal = resolveGoalReply(message, context.savingsGoals ?? []);
      if (goal) {
        return {
          ...action,
          goalId: goal.id,
          goalName: goal.name,
          sourceText: `${action.sourceText} ${message}`.trim(),
        };
      }
    }
    const savingsAction = parseSavingsAction(message, context, action) ?? action;
    const normalized = normalizeForReply(message);
    if (savingsAction.kind === 'savings' && !savingsAction.savingsType) {
      if (normalized === 'deposit') savingsAction.savingsType = 'deposit';
      if (normalized === 'withdrawal') savingsAction.savingsType = 'withdrawal';
    }
    return savingsAction;
  }
  if (action.kind === 'debt') {
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
      const activeDebts = (context.debts ?? []).filter((debt) => debt.status === 'active');
      const matchingDebt = findDebtByReplyValue(message, activeDebts);
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
      const direction = resolveDebtDirectionReply(message);
      if (direction === 'owed') {
        return {
          ...action,
          direction: 'owed',
          directionSource: 'explicit',
          sourceText: `${action.sourceText} ${message}`.trim(),
        };
      }
      if (direction === 'owing') {
        return {
          ...action,
          direction: 'owing',
          directionSource: 'explicit',
          sourceText: `${action.sourceText} ${message}`.trim(),
        };
      }
    }

    if (expectedField === 'amount') {
      const amount = resolveAmountReply(message);
      if (typeof amount === 'number') {
        return {
          ...action,
          amount,
          remainingAmount:
            action.debtMode === 'settle' && action.debtId
              ? undefined
              : action.remainingAmount,
          sourceText: `${action.sourceText} ${message}`.trim(),
        };
      }
    }

    if (expectedField === 'reason' && action.debtMode === 'create') {
      const reason = inferDebtReason(message, action.personName) ?? extractDescription(message);
      if (reason) {
        return {
          ...action,
          reason,
          sourceText: `${action.sourceText} ${message}`.trim(),
        };
      }
    }

    const date = resolveDateReply(message, now);
    if (date) {
      return {
        ...action,
        date,
        sourceText: `${action.sourceText} ${message}`.trim(),
      };
    }
  }

  const debtAction = parseDebtAction(message, context, action) ?? action;
  if (debtAction.kind === 'debt' && debtAction.debtMode === 'create' && !debtAction.direction) {
    const direction = resolveDebtDirectionReply(message);
    if (direction) {
      debtAction.direction = direction;
      debtAction.directionSource = 'explicit';
    }
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
  const sourceText = normalizeChatMessage(message);
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
