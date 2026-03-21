import type { BerdeState } from '@/lib/berde/berde.types';
import type { BudgetStatus, Insight, Transaction } from '@/lib/types';
import { getTodayDateKeyInManila } from '@/lib/utils';

export type BerdeMood = 'good' | 'sarcastic' | 'hype' | 'warning' | 'dry';

export interface BerdeInsight {
  message: string;
  boldPhrase?: string;
  dataLine: string;
  mood: BerdeMood;
  type: string;
}

interface BerdeMessageTemplate {
  message: string;
  boldPhrase?: string;
  dataLine: string;
}

interface BerdePool {
  mood: BerdeMood;
  messages: BerdeMessageTemplate[];
}

interface BerdeSignalData {
  spent: number;
  limit: number;
  remaining: number;
  saved: number;
  over: number;
  rate: number;
  pctUsed: number;
  projected: number;
  projectedSavings: number;
  overBy: number;
  daysLeft: number;
  daysElapsed: number;
  foodAmount: number;
  foodPct: number;
  mondayTotal: number;
  mondayAvg: number;
  dailyAvg: number;
  transactionCount: number;
  sameMerchantCount: number;
  highSpendStreakDays: number;
  category: string;
  billName: string;
  dueDate: string;
  dueAmount: number;
  dueCategory: string;
}

const pools = {
  hype_general: {
    mood: 'hype' as BerdeMood,
    messages: [
      {
        message: "Payday energy. Let's not blow it all at once.",
        boldPhrase: 'Berde believes in you. Mostly.',
        dataLine: 'New month, fresh budget',
      },
      {
        message: 'First transaction of the month logged.',
        boldPhrase: 'The journey of a thousand pesos begins.',
        dataLine: 'Transaction recorded',
      },
      {
        message: 'Savings milestone hit.',
        boldPhrase: "I don't say this often but - well done.",
        dataLine: 'P{saved} saved this month',
      },
      {
        message: "You're on a roll this month.",
        boldPhrase: "Whatever you're doing, keep doing it.",
        dataLine: '{rate}% savings rate',
      },
      {
        message: 'Good financial energy today.',
        boldPhrase: 'Berde is cautiously excited.',
        dataLine: 'Spending pace: healthy',
      },
      {
        message: "Sweldo day. Let's make it count this time.",
        boldPhrase: 'Berde is cautiously optimistic about your choices.',
        dataLine: 'Fresh budget loaded',
      },
      {
        message: "You logged your first transaction. That's the hardest part.",
        boldPhrase: 'Most people never start. You did.',
        dataLine: 'Transaction recorded',
      },
      {
        message: 'A savings milestone. For real this time.',
        boldPhrase: "Berde is genuinely proud. Don't make it weird.",
        dataLine: '₱{saved} saved this month',
      },
    ],
  },
  warning_general: {
    mood: 'warning' as BerdeMood,
    messages: [
      {
        message: "You're getting close to your budget limit.",
        boldPhrase: 'Just a heads up. No panic yet.',
        dataLine: '{pctUsed}% of budget used',
      },
      {
        message: 'Spending this month is running high.',
        boldPhrase: 'Might be worth slowing down.',
        dataLine: 'P{spent} of P{limit} used',
      },
      {
        message: 'A category went over budget.',
        boldPhrase: 'Berde has noticed.',
        dataLine: 'Over limit in {category}',
      },
      {
        message: 'High spend streak detected.',
        boldPhrase: 'Three days in a row. Pattern recognized.',
        dataLine: 'Above average spend: {days} days',
      },
      {
        message: "Budget's under pressure this month.",
        boldPhrase: 'Still recoverable. Just be mindful.',
        dataLine: 'P{remaining} left of P{limit}',
      },
      {
        message: 'The budget is feeling the pressure.',
        boldPhrase: 'You can still course-correct. But soon.',
        dataLine: '{pctUsed}% used - ₱{remaining} left',
      },
      {
        message: 'Spending is running a little fast this month.',
        boldPhrase: "Berde is not panicking. You shouldn't either. Yet.",
        dataLine: '₱{spent} of ₱{limit} used',
      },
      {
        message: "You've been spending above average for a few days now.",
        boldPhrase: 'Nothing alarming. Worth being aware of.',
        dataLine: 'Above average spend: {days} days running',
      },
    ],
  },
  sarcastic_general: {
    mood: 'sarcastic' as BerdeMood,
    messages: [
      {
        message: 'You ordered from the same place three times this week.',
        boldPhrase: 'Loyalty points better be worth it.',
        dataLine: 'Repeat merchant detected',
      },
      {
        message: 'That was a quick transaction.',
        boldPhrase: 'Impulse buy energy. Berde sees you.',
        dataLine: 'Transaction flagged as impulse pattern',
      },
      {
        message: 'Food is doing a lot of heavy lifting in this budget.',
        boldPhrase: 'Eating well is important. So is saving.',
        dataLine: '{pct}% of spending on food',
      },
      {
        message: 'Spending pattern looks familiar.',
        boldPhrase: 'Same time, same place, same amount. Creature of habit.',
        dataLine: 'Recurring pattern detected',
      },
      {
        message: 'That category is creeping up.',
        boldPhrase: 'Not a problem yet. Just saying.',
        dataLine: '{category} up {pct}% vs last month',
      },
      {
        message: 'That category is carrying a lot of weight this month.',
        boldPhrase: 'Sige lang. Berde is just noting things.',
        dataLine: '{category} up {pct}% vs last month',
      },
      {
        message: 'Same place, same time, again.',
        boldPhrase: 'Creature of habit. At least it\'s consistent.',
        dataLine: 'Repeat merchant: {sameMerchantCount}x this week',
      },
      {
        message: 'Impulse buy logged. Berde sees all.',
        boldPhrase: 'No judgment. Just documentation.',
        dataLine: 'Transaction flagged as impulse pattern',
      },
    ],
  },
  neutral_general: {
    mood: 'dry' as BerdeMood,
    messages: [
      {
        message: 'Things look stable this month.',
        boldPhrase: 'No alarms. No drama. Berde approves.',
        dataLine: 'Spending within normal range',
      },
      {
        message: 'Nothing unusual to report.',
        boldPhrase: 'Which is honestly the best thing I can say.',
        dataLine: 'All categories within budget',
      },
      {
        message: 'Month is progressing normally.',
        boldPhrase: 'Berde is watching. As always.',
        dataLine: 'No anomalies detected',
      },
      {
        message: 'Budget is holding steady.',
        boldPhrase: 'Boring. In the best way.',
        dataLine: 'P{spent} spent - P{remaining} remaining',
      },
      {
        message: 'No major signals this month.',
        boldPhrase: "Keep it up. Or don't. Up to you.",
        dataLine: 'Spending pace: normal',
      },
      {
        message: 'Nothing to flag this month.',
        boldPhrase: 'Wala namang masyadong nangyayari. Which is the point.',
        dataLine: 'All categories within budget',
      },
      {
        message: "Budget's holding steady.",
        boldPhrase: 'Berde is watching. No alarms. For now.',
        dataLine: '₱{spent} spent - ₱{remaining} remaining',
      },
      {
        message: 'Month is progressing as expected.',
        boldPhrase: 'Boring. Berde is not complaining.',
        dataLine: 'Spending pace: normal',
      },
    ],
  },
  savings_good: {
    mood: 'good' as BerdeMood,
    messages: [
      {
        message: "You hit your savings goal. I'm proud.",
        boldPhrase: "Don't tell anyone I said that.",
        dataLine: '{rate}% of your budget saved this month',
      },
      {
        message: 'Savings goal? Done.',
        boldPhrase: "You're kind of killing it right now.",
        dataLine: '{rate}% saved - P{saved} set aside',
      },
      {
        message: 'You actually saved money this month.',
        boldPhrase: "I wasn't sure you had it in you. Respect.",
        dataLine: 'P{saved} saved of P{limit} budget',
      },
      {
        message: 'Budget intact. Savings up.',
        boldPhrase: 'Berde is pleased.',
        dataLine: '{rate}% savings rate this month',
      },
      {
        message: "You're under budget and over expectations.",
        boldPhrase: "Honestly didn't see that coming.",
        dataLine: 'P{saved} remaining - {rate}% savings rate',
      },
      {
        message: 'You actually did it.',
        boldPhrase: "Berde didn't think you had it in you. Respect.",
        dataLine: '{rate}% saved - ₱{saved} set aside',
      },
      {
        message: 'Savings goal cleared. Month not even over.',
        boldPhrase: 'Whatever you did differently this month - write it down.',
        dataLine: '₱{saved} saved of ₱{limit} budget',
      },
      {
        message: 'Under budget. Over expectations.',
        boldPhrase: 'Berde is taking this personally. In a good way.',
        dataLine: '{rate}% savings rate this month',
      },
    ],
  },
  savings_bad: {
    mood: 'dry' as BerdeMood,
    messages: [
      {
        message: "You've gone over budget.",
        boldPhrase: "I'm not judging. I'm just... keeping notes.",
        dataLine: 'P{over} over your P{limit} limit',
      },
      {
        message: "Budget's blown.",
        boldPhrase: "We don't have to talk about it.",
        dataLine: 'Spent P{spent} of P{limit} budget',
      },
      {
        message: 'So we went over budget this month.',
        boldPhrase: 'New month soon. Fresh start.',
        dataLine: 'P{over} over limit - {rate}% over',
      },
      {
        message: "The budget didn't make it.",
        boldPhrase: 'Pour one out. Then stop spending.',
        dataLine: 'Over by P{over} this month',
      },
      {
        message: 'Spending exceeded budget.',
        boldPhrase: 'Berde has entered concerned mode.',
        dataLine: 'P{spent} spent vs P{limit} planned',
      },
    ],
  },
  food_high: {
    mood: 'sarcastic' as BerdeMood,
    messages: [
      {
        message: 'Almost half your money went to food.',
        boldPhrase: 'No judgment. Have you seen the price of kbowl though.',
        dataLine: 'P{amount} on food - {pct}% of total spending',
      },
      {
        message: 'Food is your biggest expense this month.',
        boldPhrase: 'Meal prep is free, just saying.',
        dataLine: '{pct}% of spending on food - P{amount} total',
      },
      {
        message: 'You really committed to eating well this month.',
        boldPhrase: 'Berde respects the dedication.',
        dataLine: 'P{amount} on food - {pct}% of budget',
      },
      {
        message: 'Food spending is running high.',
        boldPhrase: 'Not a crime. Just a pattern.',
        dataLine: 'P{amount} on food this month',
      },
      {
        message: 'Significant chunk going to food.',
        boldPhrase: "At least you're eating. That's something.",
        dataLine: '{pct}% food - P{amount} spent',
      },
    ],
  },
  monday_spender: {
    mood: 'sarcastic' as BerdeMood,
    messages: [
      {
        message: 'You spend most of your money on Mondays.',
        boldPhrase: 'Meal prep on Sunday might help. Or not. Your call.',
        dataLine: 'Monday avg: P{mondayAvg} vs daily avg P{dailyAvg}',
      },
      {
        message: 'Mondays are expensive for you specifically.',
        boldPhrase: 'Something to think about.',
        dataLine: 'P{mondayTotal} spent on Mondays this month',
      },
      {
        message: 'Peak spending day: Monday.',
        boldPhrase: 'The week starts and so does the damage.',
        dataLine: 'Monday avg spend: P{mondayAvg}',
      },
      {
        message: 'You have a Monday spending habit.',
        boldPhrase: 'Berde sees you.',
        dataLine: 'P{mondayAvg} avg on Mondays vs P{dailyAvg} daily avg',
      },
      {
        message: 'Mondays hit different for your wallet.',
        boldPhrase: 'Consider this a gentle heads up.',
        dataLine: 'Highest avg spend day: Monday at P{mondayAvg}',
      },
    ],
  },
  forecast_good: {
    mood: 'hype' as BerdeMood,
    messages: [
      {
        message: '{daysLeft} days left in the month and you are still way under budget.',
        boldPhrase: 'At this pace I might actually brag about you.',
        dataLine: 'Projected spend: ~P{projected} of P{limit}',
      },
      {
        message: "You're on track to end the month with money left over.",
        boldPhrase: 'Wild concept. You are doing it.',
        dataLine: 'P{remaining} still available - {daysLeft} days left',
      },
      {
        message: 'Pace is looking healthy.',
        boldPhrase: 'Keep doing whatever this is.',
        dataLine: 'Projected end-of-month: P{projected} spent',
      },
      {
        message: 'Budget pace: excellent.',
        boldPhrase: 'Berde is cautiously optimistic.',
        dataLine: '{daysLeft} days left - P{remaining} remaining',
      },
      {
        message: "You're spending less than expected this month.",
        boldPhrase: 'Future you is going to appreciate this.',
        dataLine: 'On track to save P{projectedSavings} this month',
      },
    ],
  },
  forecast_bad: {
    mood: 'warning' as BerdeMood,
    messages: [
      {
        message: 'At this pace you will hit your budget limit before the month ends.',
        boldPhrase: 'Might want to slow down a little.',
        dataLine: 'Projected spend: ~P{projected} of P{limit}',
      },
      {
        message: 'Spending is running a bit fast this month.',
        boldPhrase: 'Still fixable. Just heads up.',
        dataLine: '{daysLeft} days left - P{remaining} remaining',
      },
      {
        message: 'Budget runway is getting short.',
        boldPhrase: 'Berde is watching the numbers.',
        dataLine: 'Projected to exceed limit by P{overBy}',
      },
      {
        message: 'You are on pace to overspend.',
        boldPhrase: 'Not there yet but trending that way.',
        dataLine: 'P{projected} projected vs P{limit} limit',
      },
      {
        message: 'The month is not over but the budget is feeling it.',
        boldPhrase: 'Tread carefully.',
        dataLine: '{pctUsed}% of budget used with {daysLeft} days left',
      },
    ],
  },
  bill_due: {
    mood: 'warning' as BerdeMood,
    messages: [
      {
        message: '{billName} is due today.',
        boldPhrase: 'I am not your mom but. P{amount} does not pay itself.',
        dataLine: 'Due: {date} - P{amount} - {category}',
      },
      {
        message: 'Heads up - {billName} is due.',
        boldPhrase: 'Just making sure you know.',
        dataLine: 'P{amount} due {date}',
      },
      {
        message: '{billName} due date is here.',
        boldPhrase: 'Do not ghost your subscriptions.',
        dataLine: 'P{amount} - {category} - due today',
      },
      {
        message: 'You have got a bill due today.',
        boldPhrase: '{billName} - P{amount}. Handle it.',
        dataLine: 'Due: {date} - {category}',
      },
      {
        message: 'Recurring charge incoming.',
        boldPhrase: '{billName} is expecting P{amount} from you today.',
        dataLine: 'Due today - P{amount} - {category}',
      },
    ],
  },
} satisfies Record<string, BerdePool>;

const subtitlePools: Record<BerdeMood, string[]> = {
  good: [
    'You are doing better than you think.',
    'Calm money habits. Keep that momentum.',
    'This is a solid month so far.',
  ],
  sarcastic: [
    'Pattern spotted. I had to mention it.',
    'This is me being helpful and mildly dramatic.',
    'Just saying what the numbers are saying.',
  ],
  hype: [
    'Momentum is on your side right now.',
    'Energy is good. Keep this pace.',
    'Looking sharp. Keep stacking wins.',
  ],
  warning: [
    'Small tweak now beats stress later.',
    'Not a crisis. Just a heads up.',
    'You can still recover this month.',
  ],
  dry: [
    'I am tracking the facts for you.',
    'Neutral mode. Just clean observations.',
    'No drama. Just notes and trends.',
  ],
};

function roundMoney(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.round(value);
}

function getStableIndex(seed: string, size: number): number {
  if (size <= 0) {
    return 0;
  }

  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }

  return hash % size;
}

function formatInterpolationValue(key: string, value: unknown): string {
  if (typeof value === 'number') {
    const rounded = roundMoney(value);
    const percentLike = /(pct|rate|daysLeft|daysElapsed|days)/i.test(key);
    if (percentLike) {
      return `${rounded}`;
    }

    return rounded.toLocaleString('en-PH');
  }

  if (typeof value === 'string') {
    return value;
  }

  if (value === null || value === undefined) {
    return '';
  }

  return String(value);
}

function interpolate(template: string, data: Record<string, unknown>): string {
  return template.replace(/\{(\w+)\}/g, (_match, key: string) => {
    if (!(key in data)) {
      return `{${key}}`;
    }

    return formatInterpolationValue(key, data[key]);
  });
}

function pickRandom(pool: BerdePool, data: Record<string, unknown>, type: string): BerdeInsight {
  const daySeed = new Date().toISOString().slice(0, 10);
  const variabilitySeed = Object.keys(data)
    .sort()
    .map((key) => `${key}:${String(data[key])}`)
    .join('|');
  const index = getStableIndex(`${type}:${daySeed}:${variabilitySeed}`, pool.messages.length);
  const selected = pool.messages[index];

  return {
    mood: pool.mood,
    message: interpolate(selected.message, data),
    boldPhrase: selected.boldPhrase ? interpolate(selected.boldPhrase, data) : undefined,
    dataLine: interpolate(selected.dataLine, data),
    type,
  };
}

function parseDate(value: string): Date {
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) {
    return new Date(0);
  }

  return parsed;
}

function resolveMoodFromInsight(insight: Insight): BerdeMood {
  if (insight.severity === 'critical') {
    return 'warning';
  }
  if (insight.severity === 'warning') {
    return 'sarcastic';
  }
  if (insight.insightType === 'saving') {
    return 'good';
  }
  return 'dry';
}

function buildSignalData(data: {
  budgetStatuses: BudgetStatus[];
  transactions: Transaction[];
}): BerdeSignalData {
  const { budgetStatuses, transactions } = data;
  const now = new Date();
  const todayKey = getTodayDateKeyInManila();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysElapsed = Math.max(1, now.getDate());
  const daysLeft = Math.max(0, daysInMonth - daysElapsed);

  const expenseTransactions = transactions.filter((transaction) => transaction.type !== 'income');
  const overall =
    budgetStatuses.find((budget) => budget.category === 'Overall' && !budget.subCategory) ??
    budgetStatuses.find((budget) => budget.category === 'Overall');

  const spent =
    overall?.spent ?? expenseTransactions.reduce((sum, transaction) => sum + transaction.amount, 0);
  const limit = overall?.effectiveLimit ?? overall?.limit ?? 0;
  const remaining = limit - spent;
  const saved = Math.max(0, remaining);
  const over = Math.max(0, spent - limit);
  const rate = limit > 0 ? Math.round((saved / limit) * 100) : 0;
  const pctUsed = limit > 0 ? Math.round((spent / limit) * 100) : 0;

  const dailyRate = spent / Math.max(1, daysElapsed);
  const projected = Math.round(dailyRate * daysInMonth);
  const projectedSavings = limit - projected;
  const overBy = Math.max(0, projected - limit);

  const foodBudget =
    budgetStatuses.find((budget) => budget.category === 'Food' && !budget.subCategory) ??
    budgetStatuses.find((budget) => budget.category === 'Food');
  const foodAmount =
    foodBudget?.spent ??
    expenseTransactions
      .filter((transaction) => transaction.category === 'Food')
      .reduce((sum, transaction) => sum + transaction.amount, 0);
  const foodPct = spent > 0 ? Math.round((foodAmount / spent) * 100) : 0;

  const mondayTransactions = expenseTransactions.filter(
    (transaction) => parseDate(transaction.date).getDay() === 1,
  );
  const mondayTotal = mondayTransactions.reduce((sum, transaction) => sum + transaction.amount, 0);
  const mondayAvg =
    mondayTransactions.length > 0 ? Math.round(mondayTotal / mondayTransactions.length) : 0;
  const dailyAvg = spent > 0 ? Math.round(spent / Math.max(1, daysElapsed)) : 0;

  const weeklyTransactions = expenseTransactions.filter((transaction) => {
    const diffDays = (now.getTime() - parseDate(transaction.date).getTime()) / (1000 * 60 * 60 * 24);
    return diffDays >= 0 && diffDays <= 7;
  });
  const merchantCounts = weeklyTransactions.reduce<Record<string, number>>((counts, transaction) => {
    if (transaction.merchant) {
      counts[transaction.merchant] = (counts[transaction.merchant] ?? 0) + 1;
    }
    return counts;
  }, {});
  const sameMerchantCount = Math.max(0, ...Object.values(merchantCounts));

  const dailyTotalsByDate = expenseTransactions.reduce<Record<string, number>>((totals, transaction) => {
    const dateKey = transaction.date.split('T')[0];
    totals[dateKey] = (totals[dateKey] ?? 0) + transaction.amount;
    return totals;
  }, {});

  const recentDailyTotals = Object.entries(dailyTotalsByDate)
    .sort(([left], [right]) => left.localeCompare(right))
    .slice(-7)
    .map(([, total]) => total);
  const recentDailyAverage =
    recentDailyTotals.length > 0
      ? recentDailyTotals.reduce((sum, total) => sum + total, 0) / recentDailyTotals.length
      : 0;

  let highSpendStreakDays = 0;
  for (let index = recentDailyTotals.length - 1; index >= 0; index -= 1) {
    if (recentDailyTotals[index] > recentDailyAverage * 1.3) {
      highSpendStreakDays += 1;
    } else {
      break;
    }
  }

  const overspentCategory =
    budgetStatuses.find(
      (status) => status.category !== 'Overall' && (status.percentage >= 100 || status.status === 'critical'),
    )?.category ??
    budgetStatuses.find((status) => status.category !== 'Overall')?.category ??
    'Overall';

  const dueTodayBill = expenseTransactions.find((transaction) => {
    const nextRunDate = transaction.recurring?.nextRunDate?.split('T')[0];
    const transactionDate = transaction.date.split('T')[0];
    return Boolean(transaction.recurring) && (nextRunDate === todayKey || transactionDate === todayKey);
  });

  return {
    spent,
    limit,
    remaining,
    saved,
    over,
    rate,
    pctUsed,
    projected,
    projectedSavings,
    overBy,
    daysLeft,
    daysElapsed,
    foodAmount,
    foodPct,
    mondayTotal,
    mondayAvg,
    dailyAvg,
    transactionCount: expenseTransactions.length,
    sameMerchantCount,
    highSpendStreakDays,
    category: overspentCategory,
    billName:
      dueTodayBill?.merchant || dueTodayBill?.description || dueTodayBill?.notes || 'A bill',
    dueDate: todayKey,
    dueAmount: dueTodayBill?.amount ?? 0,
    dueCategory: dueTodayBill?.category ?? 'Miscellaneous',
  };
}

function toTemplateData(signalData: BerdeSignalData): Record<string, unknown> {
  return {
    spent: signalData.spent,
    limit: signalData.limit,
    remaining: signalData.remaining,
    saved: signalData.saved,
    over: signalData.over,
    rate: signalData.rate,
    pctUsed: signalData.pctUsed,
    projected: signalData.projected,
    projectedSavings: signalData.projectedSavings,
    overBy: signalData.overBy,
    daysLeft: signalData.daysLeft,
    daysElapsed: signalData.daysElapsed,
    amount: signalData.foodAmount,
    pct: signalData.foodPct,
    mondayTotal: signalData.mondayTotal,
    mondayAvg: signalData.mondayAvg,
    dailyAvg: signalData.dailyAvg,
    category: signalData.category,
    billName: signalData.billName,
    date: signalData.dueDate,
    days: signalData.highSpendStreakDays,
  };
}

function toEngineInsight(insight: Insight): BerdeInsight {
  return {
    message: insight.message,
    boldPhrase:
      insight.severity === 'critical'
        ? 'This one needs attention.'
        : insight.severity === 'warning'
          ? 'Worth a quick check.'
          : 'Logged for your trend history.',
    dataLine: insight.category
      ? `Category in focus: ${insight.category}`
      : 'Pattern detected from recent entries',
    mood: resolveMoodFromInsight(insight),
    type: `engine_${insight.insightType}`,
  };
}

function getPrimaryInsight(mood: BerdeMood, signalData: BerdeSignalData): BerdeInsight {
  const data = toTemplateData(signalData);

  switch (mood) {
    case 'hype':
      return pickRandom(pools.hype_general, data, 'hype_general');
    case 'warning':
      return pickRandom(pools.warning_general, data, 'warning_general');
    case 'good':
      return pickRandom(pools.savings_good, data, 'savings_good');
    case 'sarcastic':
      return pickRandom(pools.sarcastic_general, data, 'sarcastic_general');
    case 'dry':
    default:
      return pickRandom(pools.neutral_general, data, 'neutral_general');
  }
}

function getSupportingInsights(input: {
  signalData: BerdeSignalData;
  insights: Insight[];
  primaryType: string;
}): BerdeInsight[] {
  const { signalData, insights, primaryType } = input;
  const data = toTemplateData(signalData);
  const supporting: BerdeInsight[] = [];

  if (signalData.limit > 0) {
    supporting.push(
      pickRandom(
        signalData.projected <= signalData.limit ? pools.forecast_good : pools.forecast_bad,
        data,
        signalData.projected <= signalData.limit ? 'forecast_good' : 'forecast_bad',
      ),
    );
  }

  if (
    signalData.foodAmount > 0 &&
    signalData.foodPct >= 35 &&
    signalData.transactionCount >= 5
  ) {
    supporting.push(pickRandom(pools.food_high, data, 'food_high'));
  }

  if (
    signalData.mondayAvg > 0 &&
    signalData.mondayAvg > signalData.dailyAvg * 1.3 &&
    signalData.transactionCount >= 8
  ) {
    supporting.push(pickRandom(pools.monday_spender, data, 'monday_spender'));
  }

  if (signalData.billName !== 'A bill' && signalData.dueAmount > 0) {
    supporting.push(
      pickRandom(
        pools.bill_due,
        {
          ...data,
          amount: signalData.dueAmount,
          category: signalData.dueCategory,
        },
        'bill_due',
      ),
    );
  }

  if (signalData.limit > 0) {
    supporting.push(
      pickRandom(
        signalData.over > 0 ? pools.savings_bad : pools.savings_good,
        data,
        signalData.over > 0 ? 'savings_bad' : 'savings_good',
      ),
    );
  }

  supporting.push(...insights.slice(0, 2).map(toEngineInsight));

  const deduped: BerdeInsight[] = [];
  const seenTypes = new Set<string>([primaryType]);

  for (const insight of supporting) {
    if (seenTypes.has(insight.type)) {
      continue;
    }
    deduped.push(insight);
    seenTypes.add(insight.type);
  }

  return deduped;
}

export function mapStateToMood(state: BerdeState): BerdeMood {
  switch (state) {
    case 'hype':
      return 'hype';
    case 'worried':
      return 'warning';
    case 'proud':
      return 'good';
    case 'sarcastic':
      return 'sarcastic';
    case 'neutral':
    default:
      return 'dry';
  }
}

export function getBerdeSubtitle(mood: BerdeMood): string {
  const options = subtitlePools[mood];
  const monthSeed = new Date().toISOString().slice(0, 7);
  const index = getStableIndex(`${mood}:${monthSeed}`, options.length);
  return options[index];
}

export function getBerdeInsightsForMood(
  mood: BerdeMood,
  data: {
    budgetStatuses: BudgetStatus[];
    transactions: Transaction[];
    insights: Insight[];
  },
): BerdeInsight[] {
  const signalData = buildSignalData({
    budgetStatuses: data.budgetStatuses,
    transactions: data.transactions,
  });

  const primary = getPrimaryInsight(mood, signalData);
  const supporting = getSupportingInsights({
    signalData,
    insights: data.insights,
    primaryType: primary.type,
  }).slice(0, 2);

  const results = [primary, ...supporting];
  if (results.length > 0) {
    return results;
  }

  return [
    {
      message: 'No strong signals yet, but I am watching your month.',
      boldPhrase: 'Keep logging and I will keep tracking.',
      dataLine: 'Berde baseline mode',
      mood: 'dry',
      type: 'baseline',
    },
  ];
}
