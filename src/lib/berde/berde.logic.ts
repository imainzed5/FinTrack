import type { BerdeContext, BerdeInputs, BerdeState, BerdeTrigger } from '@/lib/berde/berde.types';

// Priority order: celebratory > excited > hype > worried > motivational > proud > sarcastic > helper > neutral
const QUOTES: Record<BerdeState, string[]> = {
  celebratory: [
    'Debt cleared. Budget alive. Savings up. Berde is throwing invisible confetti.',
    'Major milestone unlocked. Today we celebrate. Tomorrow we keep the streak.',
    'You did the hard thing and it worked. Big win. Big smile. Big energy.',
  ],
  excited: [
    'Momentum is real. Berde is fully awake now.',
    'Good energy on the board today. Keep it moving.',
    'This is the kind of day Berde remembers for the right reasons.',
  ],
  hype: [
    'Fresh month. Clean slate. Keep it clean.',
    'Energy is useful. Discipline is better. Berde wants both.',
    'Momentum counts most when the month is still young.',
    'This is the part where good habits are still cheap to keep.',
    'Strong start energy. Use it well.',
    'Berde sees a reset window. Those do not stay open forever.',
    'The month is still listening. Set the tone early.',
    'Calm start, strong finish. That is the assignment.',
    'Fresh budget. Fewer excuses. Let us work.',
  ],
  worried: [
    "Budget's getting tight and the month isn't over. Breathe. Plan. Stop spending.",
    'You overspent a category. It happens. But now you know.',
    'Payday is still far away and your wallet is already sweating.',
    "Three high-spend days in a row. The streak you didn't want.",
    "Budget's thinning and the month isn't done with you yet. Take it easy.",
    'Mahirap talaga. But the numbers still need to work out.',
    'You overspent. It happens to everyone. What matters is what you do now.',
    "Three high-spend days. The trifecta you didn't want. Time to slow down.",
    'Payday is far. Budget is close. Classic combination.',
  ],
  proud: [
    'Budget under control. Quietly impressive.',
    'Calm money habits. Berde approves.',
    'You are making boring look strong. That is a compliment.',
    'Low drama. Solid control. Good.',
    'This is what steady looks like.',
    'You are giving Berde fewer reasons to worry. Keep it that way.',
    'Under control is underrated. Berde notices.',
    'Numbers are behaving. So are you, apparently.',
    'Grabe ka talaga. In a good way.',
  ],
  sarcastic: [
    "Food again? It's over 50% of your spending. Mukhang masarap. Sige lang.",
    'Third time this week at the same place. Loyalty points better be worth it.',
    "Impulse buy logged. Bold strategy. Let's see how it plays out.",
    "Impulse buy detected. No comment. (There's a comment.)",
    'Half your budget went to food. Living well. Saving poorly.',
    'Apat na beses na doon this week. Siguradong masarap. O nanloloko ka na sa sarili mo.',
    "That's the same merchant again. At this point just pay them a salary.",
    'Malaki ang ginastos mo ngayon. Sana masaya ka naman.',
  ],
  motivational: [
    'Progress is progress. Small steps still count. Keep going.',
    'You are doing the hard reset. One tracked choice at a time.',
    'Not perfect. Still improving. Berde is with you on this one.',
  ],
  helper: [
    'Need a setup hand? Berde can guide you through budgets and settings.',
    'Quick tune-up time. Set limits first, then let your month breathe.',
    'I am in assistant mode. Tell me what you want to fix first.',
  ],
  neutral: [
    "Spending's under control. Nothing to complain about... yet.",
    "You haven't done anything stupid today. I'm watching.",
    'All good. Suspiciously good.',
    'No drama. Enjoy it while it lasts.',
    'Everything\'s within range. Berde has nothing to say. Enjoy the silence.',
    'Month is moving along. Budget is holding. Berde is watching from a distance.',
    'Wala namang masyadong nangyayari. Which is fine.',
    'No surprises. No wins. No losses. Just a Tuesday.',
    "You're doing okay. Not good, not bad. Just okay. Berde will take it.",
  ],
};

function pickQuote(state: BerdeState, seed: number = Date.now()): string {
  const pool = QUOTES[state];
  return pool[seed % pool.length];
}

export function getBerdeQuote(state: BerdeState, seed: number = Date.now()): string {
  return pickQuote(state, seed);
}

export function getBerdeDailySeed(userId: string, state: BerdeState): number {
  const day = Math.floor(Date.now() / 86400000);
  const userHash = userId.split('').reduce((acc, c) => acc ^ c.charCodeAt(0), 0);
  return (day ^ userHash) + state.length;
}

export function resolveBerdeState(inputs: BerdeInputs, userId?: string): BerdeContext {
  const buildContext = (
    state: BerdeState,
    trigger: BerdeTrigger,
    triggerReason: string,
  ): BerdeContext => {
    const seed = userId ? getBerdeDailySeed(userId, state) : Date.now();
    return {
      state,
      trigger,
      quote: pickQuote(state, seed),
      triggerReason,
    };
  };

  const carriesMomentumFromLastMonth =
    inputs.hasHistory &&
    inputs.isNewMonthWindow &&
    (
      inputs.previousMonthStatus === 'strong' ||
      inputs.savingsTrend === 'up' ||
      inputs.savingsStreakMonths >= 2
    );

  const needsFreshMonthRecovery =
    inputs.hasHistory &&
    inputs.isNewMonthWindow &&
    (
      inputs.previousMonthStatus === 'overspent' ||
      inputs.spendTrend === 'up'
    );

  if (inputs.savingsMilestoneHit) {
    return buildContext('excited', 'savings_milestone', 'Savings streak or milestone momentum');
  }
  if (inputs.savingsGoalHit) {
    return buildContext('celebratory', 'savings_goal', 'Major savings goal hit');
  }
  if (inputs.isFirstTransaction) {
    return buildContext('hype', 'first_transaction_logged', 'First tracked transaction logged');
  }
  if (inputs.daysUntilPayday === 0) {
    return buildContext('excited', 'payday_today', 'Payday today');
  }
  if (inputs.monthSpend === 0) {
    if (carriesMomentumFromLastMonth) {
      return buildContext('proud', 'month_start_carryover', 'New month starts with strong carry-over momentum');
    }
    if (needsFreshMonthRecovery) {
      return buildContext('motivational', 'month_start_reset', 'New month reset after a rough close');
    }
    return buildContext('hype', 'month_start_empty', 'Month starts at P0');
  }

  if (inputs.budgetUsedPercent >= 80) {
    return buildContext('worried', 'budget_high_usage', 'Budget over 80% used');
  }
  if (inputs.categoryOverspent) {
    return buildContext('worried', 'category_overspent', 'Category overspent');
  }
  if (inputs.highSpendDaysInRow >= 3) {
    return buildContext('worried', 'high_spend_streak', '3+ high-spend days in a row');
  }
  if (inputs.daysUntilPayday > 14) {
    return buildContext('worried', 'payday_far', 'Payday still 2+ weeks away');
  }

  if (needsFreshMonthRecovery) {
    return buildContext('motivational', 'fresh_month_recovery', 'Fresh month recovery window after overspending');
  }

  if (inputs.budgetUsedPercent >= 55 && inputs.budgetUsedPercent < 80) {
    return buildContext('motivational', 'budget_recoverable', 'Budget under pressure but recoverable');
  }

  if (carriesMomentumFromLastMonth) {
    return buildContext('proud', 'carryover_momentum', 'Strong previous month momentum is still carrying over');
  }

  if (inputs.savingsRate >= 70) {
    return buildContext('proud', 'savings_rate_high', 'Savings rate >= 70%');
  }
  if (inputs.budgetUsedPercent < 50) {
    return buildContext('proud', 'budget_under_control', 'Budget under 50% used');
  }
  if (inputs.lowSpendStreakDays >= 3) {
    return buildContext('proud', 'low_spend_streak', `${inputs.lowSpendStreakDays}-day low spend streak`);
  }

  if (inputs.foodSpendPercent >= 50) {
    return buildContext('sarcastic', 'food_dominant', 'Food is 50%+ of spending');
  }
  if (inputs.sameMerchantCount >= 3) {
    return buildContext('sarcastic', 'repeat_merchant', 'Same merchant 3x this week');
  }
  if (inputs.impulseLogged) {
    return buildContext('sarcastic', 'impulse_purchase', 'Impulse purchase logged');
  }

  return buildContext('neutral', 'no_strong_signal', 'No strong signal');
}
