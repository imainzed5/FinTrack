import type { BerdeState } from '@/lib/berde/berde.types';
import { getBerdeDailySeed } from '@/lib/berde/berde.logic';

type BerdePageContext = 'debts' | 'savings';

const BERDE_PAGE_MESSAGE_POOLS: Record<BerdePageContext, Partial<Record<BerdeState, string[]>>> = {
  debts: {
    celebratory: [
      'All debt entries are settled. Big win. Protect this momentum with a small weekly buffer.',
      "Debt-free feels good, doesn't it? Celebrate, then set your next savings goal.",
      'Zero utang. Zero stress. Keep it that way!',
      'You did it! No more debts to track. Time to build up your savings.',
      "Clean slate. Berde is proud, don't forget to treat yourself responsibly.",
    ],
    worried: [
      'You have pending pressure on debt. Prioritize oldest balances first, then snowball the rest.',
      'Some debts are overdue. Make a plan and tackle them one at a time.',
      'High debt alert! Focus on the biggest balance first, then work your way down.',
      "Don't let debts pile up. Even small payments help.",
      'Utang is growing. Time for a quick review and a payment push.',
    ],
    motivational: [
      'You are paying things down. Keep a steady cadence and clear the smallest active balance next.',
      'Progress is progress. Every payment counts.',
      'Keep chipping away. Berde sees your effort.',
      "Small wins add up. Stay consistent and you'll be debt-free soon.",
      "You're on the right track. Don't stop now!",
    ],
    helper: [
      'No debt logs yet. Add one entry so Berde can help you track who owes who clearly.',
      'Start tracking debts to avoid confusion later.',
      'Berde can help you remember every utang, just add your first entry.',
      "No debts? Or just not tracked yet? Let's get organized!",
      'Add your first debt and let Berde do the remembering.',
    ],
    neutral: [
      'Debts are stable right now. Stay consistent and review balances every week.',
      'No changes in your debts. Keep monitoring for peace of mind.',
      "Everything's calm on the debt front. Nice!",
      "No drama in your utang list. That's a win.",
      "Steady as she goes. Berde's keeping watch.",
    ],
  },
  savings: {
    proud: [
      'Goal reached. Strong work. Lock this in by setting your next target while momentum is high.',
      'You hit your savings goal! Berde is impressed.',
      'Consistency pays off, literally. Celebrate your savings win!',
      "You're building a great habit. Keep it up!",
      'Savings on track. Berde approves.',
    ],
    excited: [
      'Fresh milestone hit. Keep this streak alive with a small recurring deposit this week.',
      'New savings streak! Momentum is your friend.',
      'Another milestone down. Next stop: your big goal!',
      "Berde's bouncing, your savings are growing fast!",
      "Streak unlocked! Don't break it.",
    ],
    motivational: [
      'Slow progress is still progress. Start with one realistic amount and repeat it consistently.',
      'Every peso saved is a step forward.',
      "Don't get discouraged, small deposits add up.",
      "Progress may be slow, but you're moving in the right direction.",
      "Keep saving, even if it's just a little at a time.",
    ],
    helper: [
      'No savings goals yet. Set one and let Berde cheer you on!',
      'Start your first goal, Berde will help you track every step.',
      "Ready to save? Add a goal and let's begin.",
      'Berde can help you plan for anything, just set a target.',
      "No goals, no problem. Let's make your first one today.",
    ],
    neutral: [
      'Savings are moving steadily. Review one goal today and fine-tune the monthly contribution.',
      'No big changes, but steady progress is good progress.',
      'Your savings are stable. Keep reviewing and adjusting.',
      'Nothing dramatic, just good, consistent saving.',
      "Berde's watching your savings grow, one step at a time.",
    ],
  },
};

interface DailyPageMessageParams {
  page: BerdePageContext;
  state: BerdeState;
  userId?: string;
  fallbackMessage: string;
}

export function getDailyPageBerdeMessage({
  page,
  state,
  userId,
  fallbackMessage,
}: DailyPageMessageParams): string {
  const pool = BERDE_PAGE_MESSAGE_POOLS[page][state];
  if (!pool || pool.length === 0) {
    return fallbackMessage;
  }

  const safeUserId = userId && userId.trim() ? userId : 'anonymous';
  const seed = getBerdeDailySeed(safeUserId, state);
  return pool[Math.abs(seed) % pool.length] ?? fallbackMessage;
}
