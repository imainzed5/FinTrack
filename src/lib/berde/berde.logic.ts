import type { BerdeContext, BerdeInputs, BerdeState } from '@/lib/berde/berde.types';

// Priority order: celebratory > excited > hype > worried > motivational > proud > sarcastic > helper > neutral
const QUOTES: Record<BerdeState, string[]> = {
  celebratory: [
    'Debt cleared. Budget alive. Savings up. Berde is throwing invisible confetti.',
    'Major milestone unlocked. Today we celebrate. Tomorrow we keep the streak.',
    'You did the hard thing and it worked. Big win. Big smile. Big energy.',
  ],
  excited: [
    'New streak. New momentum. Berde is bouncing and cannot be stopped.',
    'Unexpected win logged. Keep the energy, keep the discipline.',
    'This is the kind of update that makes Berde do tiny victory jumps.',
  ],
  hype: [
    "PAYDAY. You earned it. Now please don't spend it all in one weekend.",
    'NEW MONTH. Clean slate. You know what to do. GO.',
    'Savings milestone unlocked! Berde is vibrating with excitement.',
    'First transaction logged. The journey of a thousand pesos starts with one receipt.',
    "Payday hits different when you've been tracking. Welcome back to having money.",
    'New month, new budget. This one could be the one. Berde believes in you.',
    "You logged that. Most people don't even get this far.",
    "You saved something. Even a little. That's not nothing.",
    'Sweldo day. Pera na. Huwag nang mag-isip. I-track muna bago mag-spend.',
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
    "Savings rate above 70%. That's actually impressive. Don't let it get to your head.",
    'Budget under 50% used. Mid-month you. Berde approves.',
    "You hit your savings goal. I'm proud. Don't tell anyone I said that.",
    'Low spend streak going strong. Boring is beautiful.',
    'You hit your goal. That\'s real. Berde acknowledges this moment.',
    "Low spend streak intact. Whatever you're doing - keep doing it.",
    "Under budget, mid-month. You're not who they said you were.",
    'Savings rate looking good. Berde is taking notes. Positive ones, for once.',
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
  const buildContext = (state: BerdeState, triggerReason: string): BerdeContext => {
    const seed = userId ? getBerdeDailySeed(userId, state) : Date.now();
    return {
      state,
      quote: pickQuote(state, seed),
      triggerReason,
    };
  };

  if (inputs.savingsMilestoneHit) {
    return buildContext('excited', 'Savings streak or milestone momentum');
  }
  if (inputs.savingsGoalHit) {
    return buildContext('celebratory', 'Major savings goal hit');
  }
  if (inputs.isFirstTransaction) {
    return buildContext('hype', 'First transaction of the month');
  }
  if (inputs.daysUntilPayday === 0) {
    return buildContext('excited', 'Payday today');
  }
  if (inputs.monthSpend === 0) {
    return buildContext('hype', 'Month starts at P0');
  }

  if (inputs.budgetUsedPercent >= 80) {
    return buildContext('worried', 'Budget over 80% used');
  }
  if (inputs.categoryOverspent) {
    return buildContext('worried', 'Category overspent');
  }
  if (inputs.highSpendDaysInRow >= 3) {
    return buildContext('worried', '3+ high-spend days in a row');
  }
  if (inputs.daysUntilPayday > 14) {
    return buildContext('worried', 'Payday still 2+ weeks away');
  }

  if (inputs.budgetUsedPercent >= 55 && inputs.budgetUsedPercent < 80) {
    return buildContext('motivational', 'Budget under pressure but recoverable');
  }

  if (inputs.savingsRate >= 70) {
    return buildContext('proud', 'Savings rate >= 70%');
  }
  if (inputs.budgetUsedPercent < 50) {
    return buildContext('proud', 'Budget under 50% used');
  }
  if (inputs.lowSpendStreakDays >= 3) {
    return buildContext('proud', `${inputs.lowSpendStreakDays}-day low spend streak`);
  }

  if (inputs.foodSpendPercent >= 50) {
    return buildContext('sarcastic', 'Food is 50%+ of spending');
  }
  if (inputs.sameMerchantCount >= 3) {
    return buildContext('sarcastic', 'Same merchant 3x this week');
  }
  if (inputs.impulseLogged) {
    return buildContext('sarcastic', 'Impulse purchase logged');
  }

  return buildContext('neutral', 'No strong signal');
}
