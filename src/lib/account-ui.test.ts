import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getAccountDetailSummary,
  getAccountPalette,
  getCashflowMixContext,
  getCompactMoneyDisplay,
  getWeeklyActivitySummary,
} from './account-ui';
import type { Account, Transaction } from './types';

const baseAccount: Account = {
  id: 'account-1',
  userId: 'user-1',
  name: 'Main Bank',
  type: 'Bank',
  initialBalance: 0,
  isArchived: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

test('getAccountPalette returns stable type defaults', () => {
  const palette = getAccountPalette(baseAccount);

  assert.match(palette.cardBackground, /linear-gradient/);
  assert.equal(palette.accent, '#2a7bcc');
  assert.equal(palette.primaryText, '#f1f7ff');
});

test('getAccountPalette uses custom account color as accent', () => {
  const palette = getAccountPalette({
    ...baseAccount,
    color: '#11aa88',
  });

  assert.equal(palette.accent, '#11aa88');
  assert.match(palette.cardBackground, /linear-gradient/);
  assert.match(palette.border, /^rgba\(/);
});

test('getAccountDetailSummary returns safe empty values for accounts without activity', () => {
  const summary = getAccountDetailSummary('missing', [], new Date('2026-04-08T00:00:00.000Z'));

  assert.equal(summary.recentNet, 0);
  assert.equal(summary.recentIncome, 0);
  assert.equal(summary.recentExpense, 0);
  assert.equal(summary.transactionCount, 0);
  assert.equal(summary.lastActivityDate, null);
});

test('getAccountDetailSummary aggregates recent account flow correctly', () => {
  const transactions: Transaction[] = [
    {
      id: 'income-1',
      amount: 1800,
      type: 'income',
      category: 'Miscellaneous',
      date: '2026-04-01T00:00:00.000Z',
      paymentMethod: 'Bank Transfer',
      accountId: 'account-1',
      createdAt: '2026-04-01T00:00:00.000Z',
      updatedAt: '2026-04-01T00:00:00.000Z',
    },
    {
      id: 'expense-1',
      amount: 600,
      type: 'expense',
      category: 'Food',
      date: '2026-04-03T00:00:00.000Z',
      paymentMethod: 'Debit Card',
      accountId: 'account-1',
      createdAt: '2026-04-03T00:00:00.000Z',
      updatedAt: '2026-04-03T00:00:00.000Z',
    },
    {
      id: 'other-account',
      amount: 999,
      type: 'expense',
      category: 'Shopping',
      date: '2026-04-04T00:00:00.000Z',
      paymentMethod: 'Cash',
      accountId: 'account-2',
      createdAt: '2026-04-04T00:00:00.000Z',
      updatedAt: '2026-04-04T00:00:00.000Z',
    },
  ] as Transaction[];

  const summary = getAccountDetailSummary('account-1', transactions, new Date('2026-04-08T00:00:00.000Z'));

  assert.equal(summary.recentIncome, 1800);
  assert.equal(summary.recentExpense, 600);
  assert.equal(summary.recentNet, 1200);
  assert.equal(summary.transactionCount, 2);
  assert.equal(summary.lastActivityDate, '2026-04-03T00:00:00.000Z');
});

test('getCompactMoneyDisplay keeps full peso text under threshold', () => {
  const display = getCompactMoneyDisplay(175000, { compactThreshold: 12 });

  assert.equal(display.compact, false);
  assert.equal(display.text, '₱175,000.00');
  assert.equal(display.fullText, '₱175,000.00');
});

test('getCompactMoneyDisplay switches to compact text over threshold', () => {
  const display = getCompactMoneyDisplay(1164730, { compactThreshold: 12 });

  assert.equal(display.compact, true);
  assert.equal(display.fullText, '₱1,164,730.00');
  assert.match(display.text, /^₱1(\.\d{1,2})?M$/);
});

test('getCompactMoneyDisplay returns hidden text safely', () => {
  const display = getCompactMoneyDisplay(1164730, {
    compactThreshold: 12,
    hiddenText: '₱••••••',
    visible: false,
  });

  assert.equal(display.compact, false);
  assert.equal(display.text, '₱••••••');
  assert.equal(display.fullText, '₱••••••');
});

test('getCashflowMixContext explains inflow-heavy and mixed behavior', () => {
  assert.equal(
    getCashflowMixContext(1003000, 13270),
    'Low outflow — mostly inflows tracked here.',
  );
  assert.equal(
    getCashflowMixContext(5000, 4500),
    'This account is used for both receiving and spending.',
  );
});

test('getWeeklyActivitySummary returns empty-state and strongest-day copy', () => {
  assert.equal(
    getWeeklyActivitySummary([
      { label: 'Mon', net: 0 },
      { label: 'Tue', net: 125000 },
      { label: 'Wed', net: 0 },
    ]),
    'No significant activity this week.',
  );

  assert.equal(
    getWeeklyActivitySummary([
      { label: 'Mon', net: -2600 },
      { label: 'Tue', net: 1200 },
      { label: 'Wed', net: -800 },
      { label: 'Thu', net: 0 },
    ]),
    'Highest spend: ₱2,600.00 on Mon',
  );
});
