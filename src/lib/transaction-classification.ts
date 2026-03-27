import type { Transaction } from './types';

function getMetadataString(tx: Transaction, key: string): string | undefined {
  const value = tx.metadata?.[key];
  return typeof value === 'string' ? value : undefined;
}

export function isBalanceAdjustmentTransaction(tx: Transaction): boolean {
  return (tx.subCategory ?? '').trim().toLowerCase() === 'account adjustment';
}

export function isOperationalTransaction(tx: Transaction): boolean {
  if (tx.transferGroupId) {
    return true;
  }

  if (isBalanceAdjustmentTransaction(tx)) {
    return true;
  }

  const destinationType = getMetadataString(tx, 'destinationType');
  return destinationType === 'cash' || destinationType === 'internal' || destinationType === 'external';
}

export function isSpendAnalyticsTransaction(tx: Transaction): boolean {
  return tx.type === 'expense' && !isOperationalTransaction(tx);
}

export function getOperationalTransactionLabel(tx: Transaction): string | undefined {
  if (tx.transferGroupId) {
    return tx.subCategory ? `Transfer · ${tx.subCategory}` : 'Transfer';
  }

  if (isBalanceAdjustmentTransaction(tx)) {
    return 'Adjustment';
  }

  return undefined;
}
