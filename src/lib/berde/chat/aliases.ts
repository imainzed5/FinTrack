import type { Account, Category, IncomeCategory, SavingsGoal } from '@/lib/types';
import { escapeRegExp, normalizeForReply } from '@/lib/berde/chat/normalize';

export interface AliasEntry<T> {
  value: T;
  aliases: string[];
}

export const CATEGORY_ALIASES: Array<AliasEntry<Category>> = [
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
      'gas',
      'gasoline',
      'fuel',
      'diesel',
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

export const INCOME_CATEGORY_ALIASES: Array<AliasEntry<IncomeCategory>> = [
  { value: 'Salary', aliases: ['salary', 'paycheck', 'sweldo', 'sahod'] },
  { value: 'Freelance', aliases: ['freelance', 'client work', 'raket', 'client', 'bayad ni client'] },
  { value: 'Side Job', aliases: ['sideline', 'side job', 'side hustle', 'raket extra'] },
  { value: 'Part-time', aliases: ['part time', 'part-time'] },
  { value: 'Bonus', aliases: ['bonus', 'incentive'] },
  { value: 'Refund', aliases: ['refund', 'reimbursement', 'binalik'] },
  { value: 'Gift', aliases: ['gift', 'allowance', 'baon', 'padala'] },
  { value: 'Other Income', aliases: ['income'] },
];

export function findAliasMatch<T>(
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

export function buildAccountAliasEntries(accounts: Account[]): Array<AliasEntry<Account>> {
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

export function buildGoalAliasEntries(goals: SavingsGoal[]): Array<AliasEntry<SavingsGoal>> {
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
