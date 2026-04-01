import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeAccountBalance,
  resolveDefaultExpensePaymentMethodForAccountType,
  resolvePaymentMethodForAccount,
  resolvePreferredDefaultAccount,
} from './accounts-utils';
import type { Account, Transaction } from './types';

test('computeAccountBalance applies signed transaction deltas', () => {
  const transactions: Array<Pick<Transaction, 'amount' | 'type' | 'savingsMeta'>> = [
    { amount: 1000, type: 'income' },
    { amount: 250, type: 'expense' },
    { amount: 200, type: 'savings', savingsMeta: { goalId: 'g1', goalName: 'Goal', depositType: 'deposit' } },
    { amount: 50, type: 'savings', savingsMeta: { goalId: 'g1', goalName: 'Goal', depositType: 'withdrawal' } },
  ];

  const balance = computeAccountBalance(500, transactions);
  assert.equal(balance, 1100);
});

test('resolvePreferredDefaultAccount picks active cash first', () => {
  const base: Omit<Account, 'id' | 'name' | 'type'> = {
    userId: 'u1',
    initialBalance: 0,
    isSystemCashWallet: false,
    isArchived: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const accounts: Account[] = [
    { ...base, id: 'a1', name: 'Main Bank', type: 'Bank' },
    { ...base, id: 'a2', name: 'Cash', type: 'Cash' },
  ];

  const preferred = resolvePreferredDefaultAccount(accounts);
  assert.equal(preferred?.id, 'a2');
});

test('resolvePreferredDefaultAccount falls back to first active account', () => {
  const now = new Date().toISOString();
  const accounts: Account[] = [
    {
      id: 'a1',
      userId: 'u1',
      name: 'Archived Cash',
      type: 'Cash',
      initialBalance: 0,
      isSystemCashWallet: false,
      isArchived: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'a2',
      userId: 'u1',
      name: 'Bank',
      type: 'Bank',
      initialBalance: 0,
      isSystemCashWallet: false,
      isArchived: false,
      createdAt: now,
      updatedAt: now,
    },
  ];

  const preferred = resolvePreferredDefaultAccount(accounts);
  assert.equal(preferred?.id, 'a2');
});

test('resolvePreferredDefaultAccount prefers the system cash wallet over name matching', () => {
  const now = new Date().toISOString();
  const accounts: Account[] = [
    {
      id: 'a1',
      userId: 'u1',
      name: 'Cash',
      type: 'Cash',
      initialBalance: 0,
      isSystemCashWallet: false,
      isArchived: false,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'a2',
      userId: 'u1',
      name: 'Pocket Cash',
      type: 'Cash',
      initialBalance: 0,
      isSystemCashWallet: true,
      isArchived: false,
      createdAt: now,
      updatedAt: now,
    },
  ];

  const preferred = resolvePreferredDefaultAccount(accounts);
  assert.equal(preferred?.id, 'a2');
});

test('resolvePaymentMethodForAccount infers cash and bank defaults by entry type', () => {
  const now = new Date().toISOString();
  const cashAccount: Account = {
    id: 'cash-1',
    userId: 'u1',
    name: 'Pocket Cash',
    type: 'Cash',
    initialBalance: 0,
    isSystemCashWallet: false,
    isArchived: false,
    createdAt: now,
    updatedAt: now,
  };
  const bankAccount: Account = {
    id: 'bank-1',
    userId: 'u1',
    name: 'Main Bank',
    type: 'Bank',
    initialBalance: 0,
    isSystemCashWallet: false,
    isArchived: false,
    createdAt: now,
    updatedAt: now,
  };

  assert.equal(resolvePaymentMethodForAccount(cashAccount, 'expense'), 'Cash');
  assert.equal(resolvePaymentMethodForAccount(bankAccount, 'expense'), 'Debit Card');
  assert.equal(resolvePaymentMethodForAccount(bankAccount, 'income'), 'Bank Transfer');
});

test('resolveDefaultExpensePaymentMethodForAccountType returns sensible defaults', () => {
  assert.equal(resolveDefaultExpensePaymentMethodForAccountType('Cash'), 'Cash');
  assert.equal(resolveDefaultExpensePaymentMethodForAccountType('Bank'), 'Debit Card');
  assert.equal(resolveDefaultExpensePaymentMethodForAccountType('E-Wallet'), 'Other');
  assert.equal(resolveDefaultExpensePaymentMethodForAccountType('Other'), 'Other');
});

test('resolvePaymentMethodForAccount uses account name heuristics for e-wallets and cards', () => {
  const now = new Date().toISOString();
  const gcashAccount: Account = {
    id: 'wallet-1',
    userId: 'u1',
    name: 'GCash Wallet',
    type: 'E-Wallet',
    initialBalance: 0,
    isSystemCashWallet: false,
    isArchived: false,
    createdAt: now,
    updatedAt: now,
  };
  const mayaAccount: Account = {
    id: 'wallet-2',
    userId: 'u1',
    name: 'Maya Savings',
    type: 'E-Wallet',
    initialBalance: 0,
    isSystemCashWallet: false,
    isArchived: false,
    createdAt: now,
    updatedAt: now,
  };
  const creditAccount: Account = {
    id: 'card-1',
    userId: 'u1',
    name: 'BPI Credit Card',
    type: 'Bank',
    initialBalance: 0,
    isSystemCashWallet: false,
    isArchived: false,
    createdAt: now,
    updatedAt: now,
  };

  assert.equal(resolvePaymentMethodForAccount(gcashAccount, 'expense'), 'GCash');
  assert.equal(resolvePaymentMethodForAccount(mayaAccount, 'expense'), 'Maya');
  assert.equal(resolvePaymentMethodForAccount(creditAccount, 'expense'), 'Credit Card');
});

test('resolvePaymentMethodForAccount prefers explicit account payment profiles for expenses', () => {
  const now = new Date().toISOString();
  const account: Account = {
    id: 'bank-1',
    userId: 'u1',
    name: 'Main Bank',
    type: 'Bank',
    expensePaymentMethod: 'Credit Card',
    initialBalance: 0,
    isSystemCashWallet: false,
    isArchived: false,
    createdAt: now,
    updatedAt: now,
  };

  assert.equal(resolvePaymentMethodForAccount(account, 'expense'), 'Credit Card');
  assert.equal(resolvePaymentMethodForAccount(account, 'income'), 'Bank Transfer');
});
