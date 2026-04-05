import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildBerdeMemory,
  buildCalendarHistory,
  buildDashboardData,
} from './insights-engine';
import type { Budget, Transaction } from './types';

const FIXED_NOW = new Date('2026-04-02T12:00:00.000Z');

function createTransaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'tx-1',
    amount: 250,
    type: 'expense',
    category: 'Food',
    date: '2026-04-01T08:00:00.000Z',
    paymentMethod: 'Cash',
    createdAt: '2026-04-01T08:00:00.000Z',
    updatedAt: '2026-04-01T08:00:00.000Z',
    ...overrides,
  } as Transaction;
}

function createBudget(overrides: Partial<Budget> = {}): Budget {
  return {
    id: 'budget-1',
    category: 'Overall',
    monthlyLimit: 3000,
    month: '2026-04',
    rollover: false,
    ...overrides,
  };
}

test('buildCalendarHistory keeps past-month data available and excludes operational rows', () => {
  const transactions = [
    createTransaction({ id: 'mar-1', date: '2026-03-15T09:00:00.000Z', amount: 1200 }),
    createTransaction({ id: 'mar-2', date: '2026-03-28T12:00:00.000Z', amount: 900, category: 'Shopping' }),
    createTransaction({ id: 'apr-1', date: '2026-04-01T08:00:00.000Z', amount: 150, category: 'Health' }),
    createTransaction({
      id: 'transfer-1',
      date: '2026-03-20T10:00:00.000Z',
      amount: 400,
      category: 'Miscellaneous',
      subCategory: 'Cash Withdrawal',
      transferGroupId: 'grp-1',
    }),
  ];

  const history = buildCalendarHistory(transactions, FIXED_NOW);

  assert.equal(history.calendarRange.minMonth, '2026-03');
  assert.equal(history.calendarRange.maxMonth, '2026-04');
  assert.equal(history.calendarTransactions.length, 3);
  assert.equal(
    history.calendarTransactions.some((transaction) => transaction.id === 'transfer-1'),
    false,
  );
  assert.equal(
    history.calendarSpending.find((point) => point.date === '2026-03-15')?.amount,
    1200,
  );
  assert.equal(
    history.calendarSpending.find((point) => point.date === '2026-03-20')?.amount,
    0,
  );
  assert.equal(
    history.calendarSpending.find((point) => point.date === '2026-04-01')?.amount,
    150,
  );
});

test('buildBerdeMemory derives strong carry-over and savings streaks from completed months', () => {
  const transactions = [
    createTransaction({ id: 'jan-1', date: '2026-01-10T08:00:00.000Z', amount: 1000 }),
    createTransaction({ id: 'feb-1', date: '2026-02-10T08:00:00.000Z', amount: 900 }),
    createTransaction({ id: 'mar-1', date: '2026-03-10T08:00:00.000Z', amount: 1100 }),
    createTransaction({ id: 'apr-1', date: '2026-04-01T08:00:00.000Z', amount: 120 }),
  ];
  const budgets = [
    createBudget({ id: 'budget-jan', month: '2026-01', monthlyLimit: 3000 }),
    createBudget({ id: 'budget-feb', month: '2026-02', monthlyLimit: 3000 }),
    createBudget({ id: 'budget-mar', month: '2026-03', monthlyLimit: 3000 }),
    createBudget({ id: 'budget-apr', month: '2026-04', monthlyLimit: 3000 }),
  ];

  const memory = buildBerdeMemory(transactions, budgets, FIXED_NOW);

  assert.equal(memory.hasHistory, true);
  assert.equal(memory.previousMonth, '2026-03');
  assert.equal(memory.previousMonthStatus, 'strong');
  assert.equal(memory.previousMonthSavingsRate > 50, true);
  assert.equal(memory.savingsStreakMonths, 3);
  assert.equal(memory.isNewMonthWindow, true);
});

test('buildDashboardData keeps current-month overview math while exposing calendar history and carry-over memory', () => {
  const transactions = [
    createTransaction({ id: 'mar-1', date: '2026-03-15T09:00:00.000Z', amount: 1200 }),
    createTransaction({ id: 'mar-2', date: '2026-03-28T12:00:00.000Z', amount: 900, category: 'Shopping' }),
    createTransaction({ id: 'apr-1', date: '2026-04-01T08:00:00.000Z', amount: 150, category: 'Health' }),
    createTransaction({
      id: 'apr-income-1',
      date: '2026-04-01T09:30:00.000Z',
      amount: 900,
      type: 'income',
      category: 'Miscellaneous',
      incomeCategory: 'Freelance',
    }),
    createTransaction({
      id: 'adjustment-1',
      date: '2026-04-01T10:00:00.000Z',
      amount: 75,
      category: 'Miscellaneous',
      subCategory: 'Account Adjustment',
    }),
  ];
  const budgets = [
    createBudget({ id: 'budget-mar', month: '2026-03', monthlyLimit: 1800 }),
    createBudget({ id: 'budget-apr', month: '2026-04', monthlyLimit: 4000 }),
  ];

  const dashboard = buildDashboardData(transactions, budgets, FIXED_NOW);

  assert.equal(dashboard.totalIncomeThisMonth, 900);
  assert.equal(dashboard.totalSpentThisMonth, 225);
  assert.equal(dashboard.totalSpentLastMonth, 2100);
  assert.equal(dashboard.netThisMonth, 675);
  assert.equal(dashboard.calendarRange.minMonth, '2026-03');
  assert.equal(dashboard.calendarTransactions.length, 3);
  assert.equal(dashboard.currentMonthTransactions.length, 2);
  assert.equal(dashboard.currentMonthTransactions[0]?.id, 'apr-income-1');
  assert.equal(dashboard.currentMonthTransactions[1]?.id, 'apr-1');
  assert.equal(dashboard.berdeMemory.previousMonthStatus, 'overspent');
  assert.equal(
    dashboard.calendarSpending.find((point) => point.date === '2026-03-28')?.amount,
    900,
  );
});

test('buildDashboardData exposes upcoming recurring templates even when they are outside recent current-month activity', () => {
  const transactions = [
    createTransaction({ id: 'apr-1', date: '2026-04-01T08:00:00.000Z', amount: 100 }),
    createTransaction({ id: 'apr-2', date: '2026-04-01T09:00:00.000Z', amount: 120, category: 'Health' }),
    createTransaction({ id: 'apr-3', date: '2026-04-01T10:00:00.000Z', amount: 140, category: 'Shopping' }),
    createTransaction({ id: 'apr-4', date: '2026-04-01T11:00:00.000Z', amount: 160, category: 'Utilities' }),
    createTransaction({ id: 'apr-5', date: '2026-04-01T12:00:00.000Z', amount: 180, category: 'Transportation' }),
    createTransaction({ id: 'apr-6', date: '2026-04-01T13:00:00.000Z', amount: 200, category: 'Entertainment' }),
    createTransaction({
      id: 'rent-template',
      date: '2026-03-01T08:00:00.000Z',
      amount: 750,
      category: 'Utilities',
      recurring: {
        frequency: 'monthly',
        interval: 1,
        nextRunDate: '2026-04-12T08:00:00.000Z',
      },
    }),
  ];
  const budgets = [createBudget({ id: 'budget-apr', month: '2026-04', monthlyLimit: 5000 })];

  const dashboard = buildDashboardData(transactions, budgets, FIXED_NOW);

  assert.equal(
    dashboard.recentTransactions.some((transaction) => transaction.id === 'rent-template'),
    false,
  );
  assert.deepEqual(
    dashboard.upcomingRecurringTransactions.map((transaction) => transaction.id),
    ['rent-template'],
  );
});