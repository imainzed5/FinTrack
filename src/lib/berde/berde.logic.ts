import type { BerdeContext, BerdeInputs, BerdeState } from '@/lib/berde/berde.types';

// Priority order: hype > worried > proud > sarcastic > neutral
const QUOTES: Record<BerdeState, string[]> = {
  hype: [
    "PAYDAY. You earned it. Now please don't spend it all in one weekend.",
    'NEW MONTH. Clean slate. You know what to do. GO.',
    'Savings milestone unlocked! Berde is vibrating with excitement.',
    'First transaction logged. The journey of a thousand pesos starts with one receipt.',
  ],
  worried: [
    "Budget's getting tight and the month isn't over. Breathe. Plan. Stop spending.",
    'You overspent a category. It happens. But now you know.',
    'Payday is still far away and your wallet is already sweating.',
    "Three high-spend days in a row. The streak you didn't want.",
  ],
  proud: [
    "Savings rate above 70%. That's actually impressive. Don't let it get to your head.",
    'Budget under 50% used. Mid-month you. Berde approves.',
    "You hit your savings goal. I'm proud. Don't tell anyone I said that.",
    'Low spend streak going strong. Boring is beautiful.',
  ],
  sarcastic: [
    "Food again? It's over 50% of your spending. Mukhang masarap. Sige lang.",
    'Third time this week at the same place. Loyalty points better be worth it.',
    "Impulse buy logged. Bold strategy. Let's see how it plays out.",
  ],
  neutral: [
    "Spending's under control. Nothing to complain about... yet.",
    "You haven't done anything stupid today. I'm watching.",
    'All good. Suspiciously good.',
    'No drama. Enjoy it while it lasts.',
  ],
};

function pickQuote(state: BerdeState, seed: number = Date.now()): string {
  const pool = QUOTES[state];
  return pool[seed % pool.length];
}

export function getBerdeQuote(state: BerdeState, seed: number = Date.now()): string {
  return pickQuote(state, seed);
}

export function resolveBerdeState(inputs: BerdeInputs): BerdeContext {
  if (inputs.savingsMilestoneHit) {
    return { state: 'hype', quote: pickQuote('hype', 2), triggerReason: 'Savings milestone hit' };
  }
  if (inputs.isFirstTransaction) {
    return { state: 'hype', quote: pickQuote('hype', 3), triggerReason: 'First transaction of the month' };
  }
  if (inputs.daysUntilPayday === 0) {
    return { state: 'hype', quote: pickQuote('hype', 0), triggerReason: 'Payday today' };
  }
  if (inputs.monthSpend === 0) {
    return { state: 'hype', quote: pickQuote('hype', 1), triggerReason: 'Month starts at P0' };
  }

  if (inputs.budgetUsedPercent >= 80) {
    return { state: 'worried', quote: pickQuote('worried', 0), triggerReason: 'Budget over 80% used' };
  }
  if (inputs.categoryOverspent) {
    return { state: 'worried', quote: pickQuote('worried', 1), triggerReason: 'Category overspent' };
  }
  if (inputs.highSpendDaysInRow >= 3) {
    return { state: 'worried', quote: pickQuote('worried', 3), triggerReason: '3+ high-spend days in a row' };
  }
  if (inputs.daysUntilPayday > 14) {
    return { state: 'worried', quote: pickQuote('worried', 2), triggerReason: 'Payday still 2+ weeks away' };
  }

  if (inputs.savingsGoalHit) {
    return { state: 'proud', quote: pickQuote('proud', 2), triggerReason: 'Savings goal hit' };
  }
  if (inputs.savingsRate >= 70) {
    return { state: 'proud', quote: pickQuote('proud', 0), triggerReason: 'Savings rate >= 70%' };
  }
  if (inputs.budgetUsedPercent < 50) {
    return { state: 'proud', quote: pickQuote('proud', 1), triggerReason: 'Budget under 50% used' };
  }
  if (inputs.lowSpendStreakDays >= 3) {
    return {
      state: 'proud',
      quote: pickQuote('proud', 3),
      triggerReason: `${inputs.lowSpendStreakDays}-day low spend streak`,
    };
  }

  if (inputs.foodSpendPercent >= 50) {
    return { state: 'sarcastic', quote: pickQuote('sarcastic', 0), triggerReason: 'Food is 50%+ of spending' };
  }
  if (inputs.sameMerchantCount >= 3) {
    return { state: 'sarcastic', quote: pickQuote('sarcastic', 1), triggerReason: 'Same merchant 3x this week' };
  }
  if (inputs.impulseLogged) {
    return { state: 'sarcastic', quote: pickQuote('sarcastic', 2), triggerReason: 'Impulse purchase logged' };
  }

  return {
    state: 'neutral',
    quote: pickQuote('neutral', Math.floor(Date.now() / 86400000)),
    triggerReason: 'No strong signal',
  };
}
