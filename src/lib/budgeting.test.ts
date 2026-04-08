import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildBudgetCrossPageSignals,
  buildBudgetMonthSummary,
  calculateBudgetStatuses,
} from './budgeting';
import type { Budget, Transaction } from './types';

function createBudget(overrides: Partial<Budget> = {}): Budget {
  return {
    id: 'budget-1',
    category: 'Overall',
    monthlyLimit: 1000,
    month: '2026-04',
    rollover: false,
    ...overrides,
  };
}

function createTransaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'tx-1',
    amount: 100,
    type: 'expense',
    category: 'Food',
    date: '2026-04-01T08:00:00.000Z',
    paymentMethod: 'Cash',
    createdAt: '2026-04-01T08:00:00.000Z',
    updatedAt: '2026-04-01T08:00:00.000Z',
    ...overrides,
  } as Transaction;
}

test('calculateBudgetStatuses chains rollover from the previous effective limit', () => {
  const budgets = [
    createBudget({ id: 'overall-jan', month: '2026-01', rollover: true }),
    createBudget({ id: 'overall-feb', month: '2026-02', rollover: true }),
    createBudget({ id: 'overall-mar', month: '2026-03', rollover: true }),
  ];
  const transactions = [
    createTransaction({ id: 'jan-expense', date: '2026-01-10T08:00:00.000Z', amount: 400 }),
    createTransaction({ id: 'feb-expense', date: '2026-02-10T08:00:00.000Z', amount: 300 }),
    createTransaction({ id: 'mar-expense', date: '2026-03-10T08:00:00.000Z', amount: 200 }),
  ];

  const statuses = calculateBudgetStatuses(transactions, budgets, new Date('2026-03-15T12:00:00.000Z'));
  const march = statuses.find((status) => status.budgetId === 'overall-mar');

  assert.equal(march?.configuredLimit, 1000);
  assert.equal(march?.rolloverCarry, 1300);
  assert.equal(march?.effectiveLimit, 2300);
  assert.equal(march?.remaining, 2100);
});

test('buildBudgetMonthSummary excludes overlapping child scopes from additive totals', () => {
  const budgets = [
    createBudget({ id: 'overall-apr', month: '2026-04', monthlyLimit: 1000 }),
    createBudget({ id: 'food-all', category: 'Food', month: '2026-04', monthlyLimit: 400 }),
    createBudget({
      id: 'food-groceries',
      category: 'Food',
      subCategory: 'Groceries',
      month: '2026-04',
      monthlyLimit: 150,
    }),
    createBudget({ id: 'utilities-all', category: 'Utilities', month: '2026-04', monthlyLimit: 200 }),
  ];

  const summary = buildBudgetMonthSummary([], budgets, '2026-04');

  assert.equal(summary.additiveCategoryPlannedTotal, 600);
  assert.equal(summary.overlapCount, 2);
  assert.equal(summary.hasPlanningMismatch, false);
});

test('budget summary and cross-page signals expose uncovered spend and top scoped risk', () => {
  const budgets = [
    createBudget({ id: 'overall-apr', month: '2026-04', monthlyLimit: 800 }),
    createBudget({ id: 'food-all', category: 'Food', month: '2026-04', monthlyLimit: 100 }),
    createBudget({
      id: 'utilities-bills',
      category: 'Utilities',
      subCategory: 'Bills',
      month: '2026-04',
      monthlyLimit: 200,
    }),
  ];
  const transactions = [
    createTransaction({ id: 'food-1', date: '2026-04-05T08:00:00.000Z', amount: 150, category: 'Food' }),
    createTransaction({ id: 'shopping-1', date: '2026-04-06T08:00:00.000Z', amount: 120, category: 'Shopping' }),
    createTransaction({
      id: 'utilities-covered',
      date: '2026-04-07T08:00:00.000Z',
      amount: 90,
      category: 'Utilities',
      subCategory: 'Bills',
    }),
  ];

  const statuses = calculateBudgetStatuses(transactions, budgets, new Date('2026-04-20T12:00:00.000Z'));
  const summary = buildBudgetMonthSummary(transactions, budgets, '2026-04');
  const signals = buildBudgetCrossPageSignals(summary, statuses);

  assert.equal(summary.uncoveredSpendTotal, 120);
  assert.equal(summary.topUncoveredCategory?.category, 'Shopping');
  assert.equal(signals.topRiskBudget?.budgetId, 'food-all');
  assert.equal(signals.topUncoveredCategory?.category, 'Shopping');
});
