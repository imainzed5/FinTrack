import { analyzeSpendingPatterns, detectSpendingSpikes } from './src/lib/insights-engine.ts';
import { getBerdeInsightsForMood } from './src/lib/berde-messages.ts';
import type { BudgetStatus, Transaction } from './src/lib/types.ts';

const now = new Date();
const iso = now.toISOString();

const thinTransactions: Transaction[] = [
  {
    id: 't1',
    amount: 120,
    type: 'expense',
    category: 'Food',
    merchant: 'Mini Stop',
    date: iso,
    paymentMethod: 'Cash',
    createdAt: iso,
    updatedAt: iso,
  },
];

const budgetStatuses: BudgetStatus[] = [
  {
    budgetId: 'b1',
    category: 'Overall',
    baseLimit: 5000,
    limit: 5000,
    incomeBoost: 0,
    effectiveLimit: 5000,
    rolloverCarry: 0,
    spent: 120,
    remaining: 4880,
    percentage: 2.4,
    projectedSpent: 360,
    projectedOverage: 0,
    status: 'safe',
  },
];

const enginePattern = analyzeSpendingPatterns(thinTransactions, now);
const engineSpikes = detectSpendingSpikes(thinTransactions, now);

const berde = getBerdeInsightsForMood('warning', {
  budgetStatuses,
  transactions: thinTransactions,
  insights: [...engineSpikes, ...enginePattern],
});

console.log('PATTERN_COUNT', enginePattern.length);
console.log('SPIKE_COUNT', engineSpikes.length);
console.log('BERDE_TYPES', berde.map((x) => x.type).join(','));
console.log('BERDE_MESSAGES', JSON.stringify(berde.map((x) => x.message)));
