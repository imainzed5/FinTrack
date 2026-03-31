import test from 'node:test';
import assert from 'node:assert/strict';
import { getAccountsInsight } from './accounts-insights';
import type { AccountWithBalance, Transaction } from './types';

const FIXED_NOW = new Date('2026-03-31T12:00:00.000Z');

function createAccount(overrides: Partial<AccountWithBalance> = {}): AccountWithBalance {
  return {
    id: 'account-1',
    userId: 'user-1',
    name: 'Main Account',
    type: 'Bank',
    initialBalance: 0,
    computedBalance: 0,
    isArchived: false,
    isSystemCashWallet: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function createTransaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'tx-1',
    amount: 100,
    type: 'expense',
    category: 'Food',
    date: '2026-03-20T00:00:00.000Z',
    paymentMethod: 'Cash',
    createdAt: '2026-03-20T00:00:00.000Z',
    updatedAt: '2026-03-20T00:00:00.000Z',
    ...overrides,
  } as Transaction;
}

function resolveInsight(
  activeAccounts: AccountWithBalance[],
  transactions: Transaction[] = [],
  archivedCount = 0,
) {
  return getAccountsInsight({
    activeAccounts,
    archivedCount,
    transactions,
    now: FIXED_NOW,
  });
}

test('getAccountsInsight returns setup-first for no active accounts', () => {
  const insight = resolveInsight([], [], 1);
  assert.equal(insight.badge, 'setup first');
});

test('getAccountsInsight returns needs-review for negative balances', () => {
  const account = createAccount({ computedBalance: -50 });
  const insight = resolveInsight([account]);
  assert.equal(insight.badge, 'needs review');
});

test('getAccountsInsight returns flow-mismatch when a bank receives income but never funds spending', () => {
  const bank = createAccount({ id: 'bank-1', name: 'Payroll Bank', computedBalance: 4000, type: 'Bank' });
  const transactions = [
    createTransaction({ id: 'income-1', accountId: 'bank-1', type: 'income', category: 'Miscellaneous', date: '2026-03-30T00:00:00.000Z' }),
    createTransaction({ id: 'income-2', accountId: 'bank-1', type: 'income', category: 'Miscellaneous', date: '2026-03-10T00:00:00.000Z' }),
  ];
  const insight = resolveInsight([bank], transactions);
  assert.equal(insight.badge, 'flow mismatch');
});

test('getAccountsInsight returns stale-wallet for inactive funded wallets', () => {
  const wallet = createAccount({ id: 'wallet-1', name: 'GCash', type: 'E-Wallet', computedBalance: 1500 });
  const transactions = [
    createTransaction({ id: 'expense-1', accountId: 'wallet-1', date: '2026-02-01T00:00:00.000Z' }),
  ];
  const insight = resolveInsight([wallet, createAccount({ id: 'bank-1', name: 'Maybank', type: 'Bank', computedBalance: 1200 })], transactions);
  assert.equal(insight.badge, 'stale wallet');
});

test('getAccountsInsight returns quiet-setup when active accounts are unfunded', () => {
  const accounts = [
    createAccount({ id: 'wallet-1', type: 'Cash', computedBalance: 0 }),
    createAccount({ id: 'bank-1', type: 'Bank', computedBalance: 0 }),
  ];
  const insight = resolveInsight(accounts);
  assert.equal(insight.badge, 'quiet setup');
});

test('getAccountsInsight returns one-hub for a single active account', () => {
  const account = createAccount({ id: 'wallet-1', type: 'Cash', computedBalance: 800 });
  const insight = resolveInsight([account]);
  assert.equal(insight.badge, 'one hub');
});

test('getAccountsInsight returns clean-it-up for too many zero-balance accounts', () => {
  const accounts = [
    createAccount({ id: 'wallet-1', type: 'Cash', computedBalance: 100 }),
    createAccount({ id: 'wallet-2', name: 'Extra Wallet', type: 'E-Wallet', computedBalance: 0 }),
    createAccount({ id: 'bank-1', name: 'Bank', type: 'Bank', computedBalance: 0 }),
  ];
  const insight = resolveInsight(accounts);
  assert.equal(insight.badge, 'clean it up');
});

test('getAccountsInsight returns high-concentration when one account dominates funded balance', () => {
  const accounts = [
    createAccount({ id: 'bank-1', name: 'Main Bank', type: 'Bank', computedBalance: 9000 }),
    createAccount({ id: 'wallet-1', name: 'Cash', type: 'Cash', computedBalance: 1000 }),
  ];
  const insight = resolveInsight(accounts);
  assert.equal(insight.badge, 'high concentration');
});

test('getAccountsInsight returns structure-idea for wallet-heavy setups', () => {
  const accounts = [
    createAccount({ id: 'wallet-1', type: 'Cash', computedBalance: 1000 }),
    createAccount({ id: 'wallet-2', type: 'E-Wallet', computedBalance: 600 }),
    createAccount({ id: 'wallet-3', type: 'E-Wallet', computedBalance: 300 }),
  ];
  const insight = resolveInsight(accounts);
  assert.equal(insight.badge, 'structure idea');
});

test('getAccountsInsight returns storage-heavy for bank-only multi-account setups', () => {
  const accounts = [
    createAccount({ id: 'bank-1', type: 'Bank', computedBalance: 1000 }),
    createAccount({ id: 'bank-2', name: 'Reserve Bank', type: 'Other', computedBalance: 800 }),
  ];
  const insight = resolveInsight(accounts);
  assert.equal(insight.badge, 'storage heavy');
});

test('getAccountsInsight returns good-spread for mixed wallet and bank setups', () => {
  const accounts = [
    createAccount({ id: 'wallet-1', type: 'Cash', computedBalance: 900 }),
    createAccount({ id: 'bank-1', type: 'Bank', computedBalance: 1100 }),
  ];
  const insight = resolveInsight(accounts);
  assert.equal(insight.badge, 'good spread');
});

test('getAccountsInsight returns history-heavy when archives outweigh a lean active setup', () => {
  const accounts = [
    createAccount({ id: 'wallet-1', type: 'Cash', computedBalance: 300 }),
    createAccount({ id: 'wallet-2', name: 'Travel Wallet', type: 'E-Wallet', computedBalance: 200 }),
  ];
  const insight = resolveInsight(accounts, [], 4);
  assert.equal(insight.badge, 'history heavy');
});
