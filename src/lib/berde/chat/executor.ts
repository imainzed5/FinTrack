import { buildTransactionInputFromAction } from '@/lib/berde/chat/presenters';
import type { BerdeParsedAction } from '@/lib/berde/chat.types';
import {
  addSavingsDeposit,
  createDebt,
  createTransaction,
  createTransfer,
  getAccounts,
  getDebts,
  getSavingsGoals,
  getTransactions,
  repayDebt,
  settleDebt,
} from '@/lib/local-store';
import type { SavingsDepositInput } from '@/lib/types';

export interface BerdeChatContextData {
  accounts: Awaited<ReturnType<typeof getAccounts>>;
  savingsGoals: Awaited<ReturnType<typeof getSavingsGoals>>;
  debts: Awaited<ReturnType<typeof getDebts>>;
  recentTransactions: Awaited<ReturnType<typeof getTransactions>>;
}

export async function loadBerdeChatContextData(): Promise<BerdeChatContextData> {
  const [accounts, recentTransactions, savingsGoals, debts] = await Promise.all([
    getAccounts(),
    getTransactions({ includeRecurringProcessing: false }),
    getSavingsGoals(),
    getDebts(),
  ]);

  return {
    accounts,
    savingsGoals,
    debts,
    recentTransactions: recentTransactions.slice(0, 12),
  };
}

export async function executeParsedAction(action: BerdeParsedAction): Promise<void> {
  if (action.kind === 'transaction') {
    await createTransaction(buildTransactionInputFromAction(action));
    return;
  }

  if (action.kind === 'transfer') {
    if (!action.fromAccountId || !action.toAccountId || typeof action.amount !== 'number') {
      throw new Error('Transfer action is incomplete.');
    }
    await createTransfer({
      fromAccountId: action.fromAccountId,
      toAccountId: action.toAccountId,
      amount: action.amount,
      date: action.date,
      notes: action.notes,
    });
    return;
  }

  if (action.kind === 'savings') {
    if (!action.goalId || !action.savingsType || typeof action.amount !== 'number') {
      throw new Error('Savings action is incomplete.');
    }
    await addSavingsDeposit({
      goalId: action.goalId,
      amount: action.amount,
      type: action.savingsType,
      note: action.note,
    } satisfies SavingsDepositInput);
    return;
  }

  if (action.debtMode === 'settle') {
    if (!action.debtId) {
      throw new Error('Debt settlement is incomplete.');
    }
    if (action.settlementType === 'partial') {
      if (typeof action.amount !== 'number') {
        throw new Error('Partial debt payment is incomplete.');
      }
      await repayDebt(action.debtId, action.amount);
      return;
    }
    await settleDebt(action.debtId);
    return;
  }

  if (!action.direction || !action.personName || typeof action.amount !== 'number') {
    throw new Error('Debt action is incomplete.');
  }
  await createDebt({
    direction: action.direction,
    personName: action.personName,
    amount: action.amount,
    reason: action.reason,
    date: action.date,
  });
}
