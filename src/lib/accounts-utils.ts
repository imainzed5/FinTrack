import type { Account, AccountType, PaymentMethod, Transaction, TransactionType } from './types';

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

type PaymentInferenceEntryType = Extract<TransactionType, 'expense' | 'income'>;

export function resolveDefaultExpensePaymentMethodForAccountType(
  accountType: AccountType,
): PaymentMethod {
  switch (accountType) {
    case 'Cash':
      return 'Cash';
    case 'Bank':
      return 'Debit Card';
    case 'E-Wallet':
      return 'Other';
    default:
      return 'Other';
  }
}

export function resolvePaymentMethodForAccount(
  account: Pick<Account, 'name' | 'type' | 'expensePaymentMethod'> | null | undefined,
  entryType: PaymentInferenceEntryType,
): PaymentMethod {
  if (!account) {
    return entryType === 'income' ? 'Bank Transfer' : 'Cash';
  }

  if (entryType === 'expense' && account.expensePaymentMethod) {
    return account.expensePaymentMethod;
  }

  const normalizedName = account.name.trim().toLowerCase();

  if (normalizedName.includes('gcash')) {
    return 'GCash';
  }

  if (normalizedName.includes('maya')) {
    return 'Maya';
  }

  if (normalizedName.includes('credit')) {
    return 'Credit Card';
  }

  if (normalizedName.includes('debit')) {
    return 'Debit Card';
  }

  switch (account.type) {
    case 'Cash':
      return 'Cash';
    case 'Bank':
      return entryType === 'income' ? 'Bank Transfer' : 'Debit Card';
    case 'E-Wallet':
      return 'Other';
    default:
      return 'Other';
  }
}
