import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveBerdeState } from './berde/berde.logic';
import type { BerdeInputs } from './berde/berde.types';
import { getBerdeInsightsForContext } from './berde-messages';
import type { BerdeMemory, BudgetStatus, Transaction } from './types';

function createInputs(overrides: Partial<BerdeInputs> = {}): BerdeInputs {
  return {
    savingsRate: 0,
    budgetUsedPercent: 0,
    savingsGoalHit: false,
    lowSpendStreakDays: 0,
    categoryOverspent: false,
    highSpendDaysInRow: 0,
    daysUntilPayday: 12,
    savingsMilestoneHit: false,
    isFirstTransaction: false,
    monthSpend: 0,
    foodSpendPercent: 0,
    sameMerchantCount: 0,
    impulseLogged: false,
    hasHistory: true,
    isNewMonthWindow: true,
    previousMonthStatus: 'steady',
    spendTrend: 'flat',
    savingsTrend: 'flat',
    savingsStreakMonths: 0,
    ...overrides,
  };
}

function createBerdeMemory(overrides: Partial<BerdeMemory> = {}): BerdeMemory {
  return {
    hasHistory: true,
    isNewMonthWindow: true,
    trackedMonthCount: 2,
    lifetimeTransactionCount: 6,
    previousMonth: '2026-03',
    previousMonthSpent: 1800,
    previousMonthSaved: 1200,
    previousMonthSavingsRate: 40,
    previousMonthTransactionCount: 4,
    previousMonthStatus: 'strong',
    rolling30DaySpend: 900,
    rolling90DayAverageSpend: 1200,
    spendTrend: 'down',
    savingsTrend: 'up',
    savingsStreakMonths: 2,
    ...overrides,
  };
}

function createBudgetStatus(overrides: Partial<BudgetStatus> = {}): BudgetStatus {
  return {
    budgetId: 'budget-1',
    category: 'Overall',
    baseLimit: 4000,
    limit: 4000,
    incomeBoost: 0,
    effectiveLimit: 4000,
    rolloverCarry: 0,
    spent: 150,
    remaining: 3850,
    percentage: 3.75,
    projectedSpent: 2250,
    projectedOverage: 0,
    status: 'safe',
    ...overrides,
  };
}

function createTransaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'tx-1',
    amount: 150,
    type: 'expense',
    category: 'Food',
    date: '2026-04-01T08:00:00.000Z',
    paymentMethod: 'Cash',
    createdAt: '2026-04-01T08:00:00.000Z',
    updatedAt: '2026-04-01T08:00:00.000Z',
    ...overrides,
  } as Transaction;
}

test('resolveBerdeState keeps a strong previous month proud at the start of a new month', () => {
  const context = resolveBerdeState(
    createInputs({ previousMonthStatus: 'strong', savingsTrend: 'up', savingsStreakMonths: 2 }),
    'user-1',
  );

  assert.equal(context.state, 'proud');
  assert.equal(context.trigger, 'month_start_carryover');
  assert.equal(context.triggerReason, 'New month starts with strong carry-over momentum');
});

test('resolveBerdeState turns a rough previous month into a motivational reset instead of pure hype', () => {
  const context = resolveBerdeState(
    createInputs({ previousMonthStatus: 'overspent', spendTrend: 'up' }),
    'user-1',
  );

  assert.equal(context.state, 'motivational');
  assert.equal(context.trigger, 'month_start_reset');
  assert.equal(context.triggerReason, 'New month reset after a rough close');
});

test('getBerdeInsightsForState surfaces carry-over context even with sparse current-month activity', () => {
  const context = resolveBerdeState(
    createInputs({ previousMonthStatus: 'strong', savingsTrend: 'up', savingsStreakMonths: 2 }),
    'user-1',
  );

  const insights = getBerdeInsightsForContext(context, {
    budgetStatuses: [createBudgetStatus()],
    transactions: [createTransaction()],
    insights: [],
    berdeMemory: createBerdeMemory(),
  });

  assert.equal(insights.length > 0, true);
  assert.equal(insights[0]?.type, 'carryover_proud');
});

test('month-start empty dashboards get a truthful empty-month message instead of a fake transaction claim', () => {
  const context = resolveBerdeState(
    createInputs({
      hasHistory: false,
      isNewMonthWindow: true,
      previousMonthStatus: 'none',
      monthSpend: 0,
    }),
    'user-1',
  );

  const insights = getBerdeInsightsForContext(context, {
    budgetStatuses: [createBudgetStatus({ spent: 0, remaining: 4000, percentage: 0 })],
    transactions: [],
    insights: [],
    berdeMemory: createBerdeMemory({
      hasHistory: false,
      trackedMonthCount: 0,
      lifetimeTransactionCount: 0,
      previousMonth: null,
      previousMonthSpent: 0,
      previousMonthSaved: 0,
      previousMonthSavingsRate: 0,
      previousMonthTransactionCount: 0,
      previousMonthStatus: 'none',
      spendTrend: 'none',
      savingsTrend: 'none',
      savingsStreakMonths: 0,
      rolling30DaySpend: 0,
      rolling90DayAverageSpend: 0,
    }),
  });

  assert.equal(context.trigger, 'month_start_empty');
  assert.equal(insights.length > 0, true);
  assert.equal(insights[0]?.type, 'month_start_empty');
  assert.match(
    insights[0]?.message ?? '',
    /No spend logged|Nothing recorded|still quiet/i,
  );
});