import assert from 'node:assert/strict';
import test from 'node:test';

import { generateTimelineEvents } from './insights-engine';
import type { Budget, Transaction } from './types';

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

test('generateTimelineEvents adds income, projection, and savings trend events when the data supports them', () => {
  const now = new Date('2026-04-20T12:00:00.000Z');
  const transactions = [
    createTransaction({
      id: 'jan-income',
      type: 'income',
      category: 'Miscellaneous',
      incomeCategory: 'Salary',
      amount: 5000,
      date: '2026-01-01T08:00:00.000Z',
    }),
    createTransaction({ id: 'jan-exp-1', amount: 2000, date: '2026-01-05T08:00:00.000Z' }),
    createTransaction({ id: 'jan-exp-2', amount: 1500, date: '2026-01-08T08:00:00.000Z', category: 'Utilities' }),
    createTransaction({ id: 'jan-exp-3', amount: 1000, date: '2026-01-12T08:00:00.000Z', category: 'Shopping' }),
    createTransaction({
      id: 'feb-income',
      type: 'income',
      category: 'Miscellaneous',
      incomeCategory: 'Salary',
      amount: 5000,
      date: '2026-02-01T08:00:00.000Z',
    }),
    createTransaction({ id: 'feb-exp-1', amount: 1500, date: '2026-02-05T08:00:00.000Z' }),
    createTransaction({ id: 'feb-exp-2', amount: 1200, date: '2026-02-11T08:00:00.000Z', category: 'Utilities' }),
    createTransaction({ id: 'feb-exp-3', amount: 800, date: '2026-02-18T08:00:00.000Z', category: 'Shopping' }),
    createTransaction({
      id: 'mar-income',
      type: 'income',
      category: 'Miscellaneous',
      incomeCategory: 'Salary',
      amount: 5000,
      date: '2026-03-01T08:00:00.000Z',
    }),
    createTransaction({ id: 'mar-exp-1', amount: 1300, date: '2026-03-05T08:00:00.000Z' }),
    createTransaction({ id: 'mar-exp-2', amount: 1000, date: '2026-03-09T08:00:00.000Z', category: 'Utilities' }),
    createTransaction({ id: 'mar-exp-3', amount: 700, date: '2026-03-19T08:00:00.000Z', category: 'Shopping' }),
    createTransaction({
      id: 'apr-income',
      type: 'income',
      category: 'Miscellaneous',
      incomeCategory: 'Salary',
      amount: 5000,
      date: '2026-04-01T08:00:00.000Z',
    }),
    createTransaction({ id: 'apr-exp-1', amount: 450, date: '2026-04-02T08:00:00.000Z' }),
    createTransaction({ id: 'apr-exp-2', amount: 550, date: '2026-04-06T08:00:00.000Z', category: 'Utilities' }),
    createTransaction({ id: 'apr-exp-3', amount: 500, date: '2026-04-10T08:00:00.000Z', category: 'Transportation' }),
    createTransaction({ id: 'apr-exp-4', amount: 500, date: '2026-04-15T08:00:00.000Z', category: 'Shopping' }),
  ];
  const budgets = [
    createBudget({ id: 'budget-jan', month: '2026-01', monthlyLimit: 5000 }),
    createBudget({ id: 'budget-feb', month: '2026-02', monthlyLimit: 5000 }),
    createBudget({ id: 'budget-mar', month: '2026-03', monthlyLimit: 5000 }),
    createBudget({ id: 'budget-apr', month: '2026-04', monthlyLimit: 4500 }),
  ];

  const events = generateTimelineEvents(transactions, [], budgets, now);
  const eventTypes = new Set(events.map((event) => event.eventType));

  assert.equal(eventTypes.has('income_logged'), true);
  assert.equal(eventTypes.has('month_projection_on_track'), true);
  assert.equal(eventTypes.has('savings_rate_trend'), true);
});

test('generateTimelineEvents adds post-income behavior and budget recovery events when the pattern is strong', () => {
  const now = new Date('2026-04-10T12:00:00.000Z');
  const transactions = [
    createTransaction({ id: 'feb-exp-1', amount: 900, date: '2026-02-04T08:00:00.000Z' }),
    createTransaction({ id: 'feb-exp-2', amount: 850, date: '2026-02-10T08:00:00.000Z', category: 'Utilities' }),
    createTransaction({ id: 'feb-exp-3', amount: 850, date: '2026-02-16T08:00:00.000Z', category: 'Shopping' }),
    createTransaction({ id: 'mar-exp-1', amount: 500, date: '2026-03-04T08:00:00.000Z' }),
    createTransaction({ id: 'mar-exp-2', amount: 450, date: '2026-03-11T08:00:00.000Z', category: 'Utilities' }),
    createTransaction({ id: 'mar-exp-3', amount: 450, date: '2026-03-18T08:00:00.000Z', category: 'Shopping' }),
    createTransaction({
      id: 'apr-income',
      type: 'income',
      category: 'Miscellaneous',
      incomeCategory: 'Salary',
      amount: 4000,
      date: '2026-04-01T08:00:00.000Z',
    }),
    createTransaction({ id: 'apr-exp-1', amount: 300, date: '2026-04-02T08:00:00.000Z' }),
    createTransaction({ id: 'apr-exp-2', amount: 300, date: '2026-04-03T08:00:00.000Z', category: 'Utilities' }),
    createTransaction({ id: 'apr-exp-3', amount: 300, date: '2026-04-04T08:00:00.000Z', category: 'Shopping' }),
    createTransaction({ id: 'apr-exp-4', amount: 50, date: '2026-04-06T08:00:00.000Z', category: 'Transportation' }),
    createTransaction({ id: 'apr-exp-5', amount: 50, date: '2026-04-07T08:00:00.000Z', category: 'Health' }),
    createTransaction({ id: 'apr-exp-6', amount: 50, date: '2026-04-08T08:00:00.000Z', category: 'Entertainment' }),
  ];
  const budgets = [
    createBudget({ id: 'budget-feb', month: '2026-02', monthlyLimit: 2000 }),
    createBudget({ id: 'budget-mar', month: '2026-03', monthlyLimit: 2000 }),
    createBudget({ id: 'budget-apr', month: '2026-04', monthlyLimit: 5000 }),
  ];

  const events = generateTimelineEvents(transactions, [], budgets, now);
  const eventTypes = new Set(events.map((event) => event.eventType));

  assert.equal(eventTypes.has('post_income_spending'), true);
  assert.equal(eventTypes.has('budget_recovery'), true);
});