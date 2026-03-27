import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getOperationalTransactionLabel,
  isOperationalTransaction,
  isSpendAnalyticsTransaction,
} from './transaction-classification';
import type { Transaction } from './types';

function buildTransaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'tx-1',
    amount: 250,
    type: 'expense',
    category: 'Food',
    date: '2026-03-28T08:00:00.000Z',
    paymentMethod: 'Cash',
    createdAt: '2026-03-28T08:00:00.000Z',
    updatedAt: '2026-03-28T08:00:00.000Z',
    ...overrides,
  };
}

test('isSpendAnalyticsTransaction keeps normal expenses in spend analytics', () => {
  const tx = buildTransaction();

  assert.equal(isOperationalTransaction(tx), false);
  assert.equal(isSpendAnalyticsTransaction(tx), true);
});

test('transfer-linked rows are operational and excluded from spend analytics', () => {
  const tx = buildTransaction({
    category: 'Miscellaneous',
    subCategory: 'Cash Withdrawal',
    transferGroupId: 'grp-1',
  });

  assert.equal(isOperationalTransaction(tx), true);
  assert.equal(isSpendAnalyticsTransaction(tx), false);
  assert.equal(getOperationalTransactionLabel(tx), 'Transfer · Cash Withdrawal');
});

test('account adjustments are operational even without transfer linkage', () => {
  const tx = buildTransaction({
    category: 'Miscellaneous',
    subCategory: 'Account Adjustment',
  });

  assert.equal(isOperationalTransaction(tx), true);
  assert.equal(isSpendAnalyticsTransaction(tx), false);
  assert.equal(getOperationalTransactionLabel(tx), 'Adjustment');
});
