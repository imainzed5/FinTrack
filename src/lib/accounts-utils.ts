import type { Account, Transaction } from './types';

export function getSignedTransactionAmount(tx: Pick<Transaction, 'amount' | 'type' | 'savingsMeta'>): number {
  if (tx.type === 'income') {
    return tx.amount;
  }

  if (tx.type === 'expense') {
    return -tx.amount;
  }

  if (tx.savingsMeta?.depositType === 'withdrawal') {
    return tx.amount;
  }

  return -tx.amount;
}

export function computeAccountBalance(
  initialBalance: number,
  transactions: Array<Pick<Transaction, 'amount' | 'type' | 'savingsMeta'>>
): number {
  const delta = transactions.reduce((sum, tx) => sum + getSignedTransactionAmount(tx), 0);
  return Number((initialBalance + delta).toFixed(2));
}

export function resolvePreferredDefaultAccount(accounts: Account[]): Account | null {
  const activeAccounts = accounts.filter((account) => !account.isArchived);
  if (activeAccounts.length === 0) {
    return null;
  }

  return (
    activeAccounts.find((account) => account.isSystemCashWallet) ||
    activeAccounts.find((account) => account.name === 'Cash' && account.type === 'Cash') ||
    activeAccounts[0]
  );
}
