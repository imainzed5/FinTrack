import { CATEGORY_ALIASES, findAliasMatch, INCOME_CATEGORY_ALIASES } from '@/lib/berde/chat/aliases';
import { extractAccountMention, extractAmount, extractDate, extractGoalMention } from '@/lib/berde/chat/extractors';
import { createBatchResponse, findFirstIncompleteAction } from '@/lib/berde/chat/intent';
import { normalizeForReply } from '@/lib/berde/chat/normalize';
import { parseDebtAction, extractPersonFromDebtReply, findDebtByReplyValue, inferDebtReason, resolveDebtDirectionReply } from '@/lib/berde/chat/parsers/debt';
import { parseSavingsAction } from '@/lib/berde/chat/parsers/savings';
import { mergeTransactionAction } from '@/lib/berde/chat/parsers/transaction';
import { parseTransferAction } from '@/lib/berde/chat/parsers/transfer';
import type { Account, Category, IncomeCategory, SavingsGoal } from '@/lib/types';
import type { BerdeActionMissingField, BerdeChatParserContext, BerdeChatResponse, BerdeParsedAction } from '@/lib/berde/chat.types';
import { detectTransactionType, extractDescription } from '@/lib/berde/chat/extractors';

function resolveAmountReply(message: string): number | undefined {
  return extractAmount(message).amount;
}

function resolveDateReply(message: string, now: Date): string | undefined {
  return extractDate(message, now).date;
}

function resolveCategoryReply(message: string): Category | undefined {
  return findAliasMatch(message, CATEGORY_ALIASES).value;
}

function resolveIncomeCategoryReply(message: string): IncomeCategory | undefined {
  return findAliasMatch(message, INCOME_CATEGORY_ALIASES).value;
}

function resolveAccountReply(message: string, accounts: Account[]): Account | undefined {
  return extractAccountMention(message, accounts).account;
}

function resolveGoalReply(message: string, goals: SavingsGoal[]): SavingsGoal | undefined {
  return extractGoalMention(message, goals).goal;
}

export function mergeFollowUpIntoAction(
  action: BerdeParsedAction,
  message: string,
  context: BerdeChatParserContext,
  expectedField?: BerdeActionMissingField,
): BerdeParsedAction {
  const now = context.now ?? new Date();

  if (action.kind === 'transaction') {
    if (expectedField === 'amount') {
      const amount = resolveAmountReply(message);
      if (typeof amount === 'number') {
        return { ...action, amount, sourceText: `${action.sourceText} ${message}`.trim() };
      }
    }
    if (expectedField === 'category') {
      const category = resolveCategoryReply(message);
      if (category) {
        return { ...action, category, sourceText: `${action.sourceText} ${message}`.trim() };
      }
    }
    if (expectedField === 'incomeCategory') {
      const incomeCategory = resolveIncomeCategoryReply(message);
      if (incomeCategory) {
        return { ...action, incomeCategory, sourceText: `${action.sourceText} ${message}`.trim() };
      }
    }
    if (expectedField === 'type') {
      const entryType = detectTransactionType(message);
      if (entryType) {
        return { ...action, entryType, sourceText: `${action.sourceText} ${message}`.trim() };
      }
    }
    return mergeTransactionAction(action, message, context) ?? action;
  }

  if (action.kind === 'transfer') {
    if (expectedField === 'amount') {
      const amount = resolveAmountReply(message);
      if (typeof amount === 'number') {
        return { ...action, amount, sourceText: `${action.sourceText} ${message}`.trim() };
      }
    }
    if (expectedField === 'fromAccount') {
      const account = resolveAccountReply(message, context.accounts);
      if (account) {
        return {
          ...action,
          fromAccountId: account.id,
          fromAccountName: account.name,
          sourceText: `${action.sourceText} ${message}`.trim(),
        };
      }
    }
    if (expectedField === 'toAccount') {
      const account = resolveAccountReply(message, context.accounts);
      if (account) {
        return {
          ...action,
          toAccountId: account.id,
          toAccountName: account.name,
          sourceText: `${action.sourceText} ${message}`.trim(),
        };
      }
    }
    return parseTransferAction(message, context, action) ?? action;
  }

  if (action.kind === 'savings') {
    if (expectedField === 'amount') {
      const amount = resolveAmountReply(message);
      if (typeof amount === 'number') {
        return { ...action, amount, sourceText: `${action.sourceText} ${message}`.trim() };
      }
    }
    if (expectedField === 'goal') {
      const goal = resolveGoalReply(message, context.savingsGoals ?? []);
      if (goal) {
        return {
          ...action,
          goalId: goal.id,
          goalName: goal.name,
          sourceText: `${action.sourceText} ${message}`.trim(),
        };
      }
    }
    const savingsAction = parseSavingsAction(message, context, action) ?? action;
    const normalized = normalizeForReply(message);
    if (savingsAction.kind === 'savings' && !savingsAction.savingsType) {
      if (normalized === 'deposit') savingsAction.savingsType = 'deposit';
      if (normalized === 'withdrawal') savingsAction.savingsType = 'withdrawal';
    }
    return savingsAction;
  }

  if (expectedField === 'person' && action.debtMode === 'create' && !action.personName) {
    const personName = extractPersonFromDebtReply(message);
    if (personName) {
      return {
        ...action,
        personName,
        sourceText: `${action.sourceText} ${message}`.trim(),
      };
    }
  }

  if (expectedField === 'debt' && action.debtMode === 'settle' && !action.debtId) {
    const activeDebts = (context.debts ?? []).filter((debt) => debt.status === 'active');
    const matchingDebt = findDebtByReplyValue(message, activeDebts);
    if (matchingDebt) {
      const settlementAmount = typeof action.amount === 'number' ? action.amount : matchingDebt.amount;
      const isPartial = settlementAmount < matchingDebt.amount - 0.009;
      return {
        ...action,
        debtId: matchingDebt.id,
        personName: matchingDebt.personName,
        direction: matchingDebt.direction,
        reason: matchingDebt.reason ?? action.reason,
        amount: settlementAmount,
        settlementType: isPartial ? 'partial' : 'full',
        remainingAmount: isPartial ? Number((matchingDebt.amount - settlementAmount).toFixed(2)) : undefined,
        sourceText: `${action.sourceText} ${message}`.trim(),
      };
    }
  }

  if (action.debtMode === 'create' && !action.direction) {
    const direction = resolveDebtDirectionReply(message);
    if (direction === 'owed') {
      return {
        ...action,
        direction: 'owed',
        directionSource: 'explicit',
        sourceText: `${action.sourceText} ${message}`.trim(),
      };
    }
    if (direction === 'owing') {
      return {
        ...action,
        direction: 'owing',
        directionSource: 'explicit',
        sourceText: `${action.sourceText} ${message}`.trim(),
      };
    }
  }

  if (expectedField === 'amount') {
    const amount = resolveAmountReply(message);
    if (typeof amount === 'number') {
      return {
        ...action,
        amount,
        remainingAmount: action.debtMode === 'settle' && action.debtId ? undefined : action.remainingAmount,
        sourceText: `${action.sourceText} ${message}`.trim(),
      };
    }
  }

  if (expectedField === 'reason' && action.debtMode === 'create') {
    const reason = inferDebtReason(message, action.personName) ?? extractDescription(message);
    if (reason) {
      return {
        ...action,
        reason,
        sourceText: `${action.sourceText} ${message}`.trim(),
      };
    }
  }

  const date = resolveDateReply(message, now);
  if (date) {
    return {
      ...action,
      date,
      sourceText: `${action.sourceText} ${message}`.trim(),
    };
  }

  const debtAction = parseDebtAction(message, context, action) ?? action;
  if (debtAction.kind === 'debt' && debtAction.debtMode === 'create' && !debtAction.direction) {
    const direction = resolveDebtDirectionReply(message);
    if (direction) {
      debtAction.direction = direction;
      debtAction.directionSource = 'explicit';
    }
  }
  return debtAction;
}

export function applyFollowUp(message: string, context: BerdeChatParserContext): BerdeChatResponse | null {
  if (!context.pendingBatch || context.pendingIntent?.stage !== 'collecting_field') {
    return null;
  }

  const focusIndex = context.pendingBatch.focusActionIndex ?? findFirstIncompleteAction(context.pendingBatch)?.index;
  if (focusIndex === undefined) {
    return null;
  }

  const expectedField = context.pendingIntent.expectedField;
  const nextActions = context.pendingBatch.actions.map((action, index) =>
    index === focusIndex ? mergeFollowUpIntoAction(action, message, context, expectedField) : action,
  );

  return createBatchResponse(
    {
      actions: nextActions,
      focusActionIndex: focusIndex,
    },
    context,
    "Nice, that completes it. Review the draft and confirm when you're ready.",
  );
}
