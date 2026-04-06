import { format } from 'date-fns';
import type { BerdeChatConfidenceLabel, BerdeParsedAction, BerdeParsedActionBatch, BerdeTransactionAction } from '@/lib/berde/chat.types';
import { POST_SAVE_FOLLOW_UP_CHIPS } from '@/lib/berde/chat/ui-config';
import { type BerdeChatMessage, type PreviewState, type ReceiptMeta, createMessageId } from '@/lib/berde/chat/thread';
import type { TransactionInput } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';

export function buildTransactionInputFromAction(action: BerdeTransactionAction): TransactionInput {
  if (!action.entryType || typeof action.amount !== 'number') {
    throw new Error('Transaction action is incomplete.');
  }

  if (action.entryType === 'expense' && !action.category) {
    throw new Error('Expense category is missing.');
  }

  if (action.entryType === 'income' && !action.incomeCategory) {
    throw new Error('Income category is missing.');
  }

  return {
    amount: action.amount,
    type: action.entryType,
    accountId: action.accountId,
    category: action.entryType === 'expense' ? action.category! : 'Miscellaneous',
    incomeCategory: action.entryType === 'income' ? action.incomeCategory : undefined,
    description:
      action.description ||
      action.merchant ||
      (action.entryType === 'income' ? action.incomeCategory : action.category),
    merchant: action.merchant,
    date: action.date,
    paymentMethod: action.paymentMethod,
  };
}

export function getActionHeadline(action: BerdeParsedAction): string {
  switch (action.kind) {
    case 'transaction':
      return action.entryType === 'income'
        ? `${formatCurrency(action.amount ?? 0)} income`
        : `${formatCurrency(action.amount ?? 0)} expense`;
    case 'transfer':
      return `${formatCurrency(action.amount ?? 0)} transfer`;
    case 'savings':
      return `${formatCurrency(action.amount ?? 0)} ${action.savingsType === 'withdrawal' ? 'withdrawal' : 'deposit'}`;
    case 'debt':
      if (action.debtMode === 'settle') {
        return action.settlementType === 'partial'
          ? `${formatCurrency(action.amount ?? 0)} debt payment`
          : `Settle ${action.personName || 'debt'}`;
      }
      return `${formatCurrency(action.amount ?? 0)} debt`;
  }
}

export function getBatchSummary(batch: BerdeParsedActionBatch): string {
  return `${batch.actions.length} actions`;
}

export function getPreviewCardText(state: PreviewState): string {
  switch (state.kind) {
    case 'pending':
      return '';
    case 'logged':
      return '';
    case 'cancelled':
      return 'Canceled. Nothing was saved.';
  }
}

export function getLoggedVoiceLine(batch: BerdeParsedActionBatch): string {
  if (batch.actions.length > 1) {
    return `Logged ${batch.actions.length} items. Nasa history mo na sila.`;
  }

  const action = batch.actions[0];
  switch (action.kind) {
    case 'transaction':
      return action.entryType === 'income'
        ? 'Income logged. Nasa history mo na.'
        : 'Expense logged. Nasa history mo na.';
    case 'transfer':
      return 'Transfer logged. Nasa history mo na.';
    case 'savings':
      return 'Savings move logged. Nasa history mo na.';
    case 'debt':
      return action.debtMode === 'settle'
        ? 'Debt update logged. Nasa history mo na.'
        : 'Debt entry logged. Nasa history mo na.';
  }
}

function getAmountBand(amount?: number): 'small' | 'medium' | 'large' {
  if (typeof amount !== 'number') {
    return 'medium';
  }
  if (amount >= 10000) {
    return 'large';
  }
  if (amount >= 1000) {
    return 'medium';
  }
  return 'small';
}

function getPrimaryActionAmount(action: BerdeParsedAction): number | undefined {
  return typeof action.amount === 'number' ? action.amount : undefined;
}

export function getDraftVoiceLine(
  batch: BerdeParsedActionBatch,
  confidenceLabel: BerdeChatConfidenceLabel,
): string {
  if (confidenceLabel === 'low') {
    return "May hula ako rito, pero hindi pa ako kampante - silipin mo muna bago i-log.";
  }

  if (batch.actions.length > 1) {
    return "Sige, inayos ko na sa draft - scan mo lang bawat item bago natin i-log.";
  }

  const action = batch.actions[0];
  const amountBand = getAmountBand(getPrimaryActionAmount(action));

  switch (action.kind) {
    case 'transaction':
      if (action.entryType === 'income') {
        return amountBand === 'large'
          ? 'Uy, laki ng pasok na pera - quick review lang bago i-log.'
          : 'Nice, may pumasok - check mo lang tapos good na.';
      }
      return amountBand === 'large'
        ? "Sige, draft ko na 'to - medyo malaki, kaya double check mo muna."
        : "Sige, draft na 'to - check mo lang bago i-log.";
    case 'transfer':
      return amountBand === 'large'
        ? "Malaking galaw 'yan ah - silipin mo muna bago i-log."
        : 'Ayos, nilatag ko na ang transfer - confirm mo lang.';
    case 'savings':
      return 'Nice one, nasa draft na ang savings move mo - review mo lang.';
    case 'debt':
      return action.debtMode === 'settle'
        ? 'Sige, hinanda ko na ang debt update - check mo muna ang details.'
        : "Noted ang utang flow - review mo lang bago natin i-log.";
  }
}

export function getLowConfidenceNote(confidenceLabel: BerdeChatConfidenceLabel): string | null {
  if (confidenceLabel !== 'low') {
    return null;
  }

  return 'Hindi ako sigurado sa ilan dito - check mo muna.';
}

export function getActionFocusLabel(action: BerdeParsedAction): string {
  switch (action.kind) {
    case 'transaction':
      return action.description || action.merchant || action.category || action.incomeCategory || 'entry';
    case 'transfer':
      return action.fromAccountName && action.toAccountName
        ? `${action.fromAccountName} to ${action.toAccountName}`
        : 'transfer';
    case 'savings':
      return action.goalName || 'savings move';
    case 'debt':
      return action.personName || 'debt entry';
  }
}

export function getConfidenceBadgeClass(confidenceLabel: BerdeChatConfidenceLabel): string {
  if (confidenceLabel === 'low') {
    return 'bg-amber-100 text-amber-800 border-amber-200';
  }
  return 'bg-zinc-100 text-zinc-700 border-zinc-200';
}

export function getActionKindLabel(action: BerdeParsedAction): string {
  if (action.kind === 'transaction') {
    return action.entryType === 'income' ? 'Income' : 'Expense';
  }
  if (action.kind === 'transfer') {
    return 'Transfer';
  }
  if (action.kind === 'savings') {
    return action.savingsType === 'withdrawal' ? 'Savings Withdrawal' : 'Savings Deposit';
  }
  if (action.debtMode === 'settle') {
    return action.settlementType === 'partial' ? 'Debt Payment' : 'Debt Settlement';
  }
  return 'Debt';
}

function normalizeForDebtReason(reason: string, personName?: string): boolean {
  const normalizedReason = reason.trim().toLowerCase();
  if (!normalizedReason || normalizedReason === 'chat entry') {
    return false;
  }

  if (personName && normalizedReason === personName.trim().toLowerCase()) {
    return false;
  }

  if (personName && normalizedReason === `${personName.trim().toLowerCase()} utang`) {
    return false;
  }

  return true;
}

export function getActionMeta(action: BerdeParsedAction): Array<{ label: string; value: string }> {
  if (action.kind === 'transaction') {
    return [
      {
        label: action.entryType === 'income' ? 'Income type' : 'Category',
        value: action.entryType === 'income' ? (action.incomeCategory || 'Pending') : (action.category || 'Pending'),
      },
      { label: 'Date', value: format(new Date(action.date), 'MMM d, yyyy') },
      { label: 'Account', value: action.accountName || 'Default account' },
    ];
  }
  if (action.kind === 'transfer') {
    return [
      { label: 'Amount', value: typeof action.amount === 'number' ? formatCurrency(action.amount) : 'Pending' },
      { label: 'From', value: action.fromAccountName || 'Pending' },
      { label: 'To', value: action.toAccountName || 'Pending' },
      { label: 'Date', value: format(new Date(action.date), 'MMM d, yyyy') },
    ];
  }
  if (action.kind === 'savings') {
    return [
      { label: 'Amount', value: typeof action.amount === 'number' ? formatCurrency(action.amount) : 'Pending' },
      { label: 'Goal', value: action.goalName || 'Pending' },
      { label: 'Type', value: action.savingsType === 'withdrawal' ? 'Withdrawal' : action.savingsType === 'deposit' ? 'Deposit' : 'Pending' },
      { label: 'Date', value: format(new Date(action.date), 'MMM d, yyyy') },
    ];
  }
  if (action.kind === 'debt' && action.debtMode === 'settle') {
    return action.settlementType === 'partial'
      ? [
          { label: 'Person', value: action.personName || 'Pending' },
          { label: 'Paid now', value: typeof action.amount === 'number' ? formatCurrency(action.amount) : 'Pending' },
          { label: 'Remaining', value: typeof action.remainingAmount === 'number' ? formatCurrency(action.remainingAmount) : 'Pending' },
          { label: 'Date', value: format(new Date(action.date), 'MMM d, yyyy') },
        ]
      : [
          { label: 'Person', value: action.personName || 'Pending' },
          { label: 'Amount', value: typeof action.amount === 'number' ? formatCurrency(action.amount) : 'Pending' },
          { label: 'Date', value: format(new Date(action.date), 'MMM d, yyyy') },
        ];
  }
  const debtMeta = [
    { label: 'Person', value: action.personName || 'Pending' },
    { label: 'Amount', value: typeof action.amount === 'number' ? formatCurrency(action.amount) : 'Pending' },
    { label: 'Direction', value: action.direction === 'owed' ? 'They owe you' : action.direction === 'owing' ? 'You owe them' : 'Pending' },
  ];

  if (action.reason && normalizeForDebtReason(action.reason, action.personName)) {
    debtMeta.push({ label: 'Reason', value: action.reason });
  }

  return debtMeta;
}

export function getCompactReceiptLine(action: BerdeParsedAction): string {
  const formattedDate = format(new Date(action.date), 'MMM d');

  switch (action.kind) {
    case 'transaction':
      return `${formatCurrency(action.amount ?? 0)} ${action.entryType === 'income' ? 'income' : 'expense'} · ${
        action.entryType === 'income' ? (action.incomeCategory || 'Other Income') : (action.category || 'Miscellaneous')
      } · ${formattedDate}`;
    case 'transfer':
      return `${formatCurrency(action.amount ?? 0)} transfer · ${
        action.fromAccountName || 'One account'
      } to ${action.toAccountName || 'another account'} · ${formattedDate}`;
    case 'savings':
      return `${formatCurrency(action.amount ?? 0)} ${
        action.savingsType === 'withdrawal' ? 'withdrawal' : 'saved'
      } · ${action.goalName || 'Savings'} · ${formattedDate}`;
    case 'debt':
      if (action.debtMode === 'settle') {
        if (action.settlementType === 'partial') {
          return `${formatCurrency(action.amount ?? 0)} debt payment · ${action.personName || 'Debt'} · ${formattedDate}`;
        }
        return `Debt settled · ${action.personName || 'Debt'} · ${formattedDate}`;
      }
      return `${formatCurrency(action.amount ?? 0)} debt logged · ${action.personName || 'Debt'} · ${formattedDate}`;
  }
}

function getSmartReceiptText(action: BerdeParsedAction): string {
  return `✓ ${getCompactReceiptLine(action)}`;
}

function buildReceiptMeta(action: BerdeParsedAction, batchId: string): ReceiptMeta {
  switch (action.kind) {
    case 'transaction':
      return {
        actionKind: action.entryType === 'income' ? 'income' : 'expense',
        amount: action.amount,
        label: action.entryType === 'income' ? (action.incomeCategory || 'Other Income') : (action.category || 'Miscellaneous'),
        date: action.date,
        batchId,
      };
    case 'transfer':
      return {
        actionKind: 'transfer',
        amount: action.amount,
        label: `${action.fromAccountName || 'One account'} to ${action.toAccountName || 'another account'}`,
        date: action.date,
        batchId,
      };
    case 'savings':
      return {
        actionKind: action.savingsType === 'withdrawal' ? 'savings_withdrawal' : 'savings_deposit',
        amount: action.amount,
        label: action.goalName || 'Savings',
        date: action.date,
        batchId,
      };
    case 'debt':
      return {
        actionKind:
          action.debtMode === 'settle'
            ? action.settlementType === 'partial'
              ? 'debt_payment'
              : 'debt_settlement'
            : 'debt_create',
        amount: action.amount,
        label: action.personName || 'Debt',
        date: action.date,
        batchId,
      };
  }
}

function buildSmartReceiptMessages(batch: BerdeParsedActionBatch): Extract<BerdeChatMessage, { kind: 'receipt' }>[] {
  const batchId = createMessageId('receipt-batch');
  return batch.actions.map((action, index) => ({
    id: createMessageId('receipt'),
    role: 'berde',
    kind: 'receipt',
    text: getSmartReceiptText(action),
    receiptMeta: buildReceiptMeta(action, batchId),
    quickReplies: index === batch.actions.length - 1 ? [...POST_SAVE_FOLLOW_UP_CHIPS] : [],
  }));
}

export function buildReceiptMessages(batch: BerdeParsedActionBatch): Extract<BerdeChatMessage, { kind: 'receipt' }>[] {
  return buildSmartReceiptMessages(batch);
}

function getActionReceiptSummary(action: BerdeParsedAction) {
  if (action.kind === 'transaction') {
    return {
      count: 1,
      expenseTotal: action.entryType === 'expense' ? action.amount ?? 0 : 0,
      incomeTotal: action.entryType === 'income' ? action.amount ?? 0 : 0,
      debtMoves: 0,
    };
  }

  if (action.kind === 'debt') {
    return {
      count: 1,
      expenseTotal: 0,
      incomeTotal: 0,
      debtMoves: 1,
    };
  }

  return {
    count: 1,
    expenseTotal: 0,
    incomeTotal: 0,
    debtMoves: 0,
  };
}

export function getSessionSummary(messages: BerdeChatMessage[]) {
  let count = 0;
  let expenseTotal = 0;
  let incomeTotal = 0;
  let debtMoves = 0;

  for (const message of messages) {
    if (message.kind === 'receipt' && message.receiptMeta) {
      count += 1;

      if (message.receiptMeta.actionKind === 'expense') {
        expenseTotal += message.receiptMeta.amount ?? 0;
      } else if (message.receiptMeta.actionKind === 'income') {
        incomeTotal += message.receiptMeta.amount ?? 0;
      } else if (
        message.receiptMeta.actionKind === 'debt_create'
        || message.receiptMeta.actionKind === 'debt_payment'
        || message.receiptMeta.actionKind === 'debt_settlement'
      ) {
        debtMoves += 1;
      }

      continue;
    }

    if (message.kind === 'preview' && message.previewState.kind === 'logged') {
      for (const action of message.batch.actions) {
        const summary = getActionReceiptSummary(action);
        count += summary.count;
        expenseTotal += summary.expenseTotal;
        incomeTotal += summary.incomeTotal;
        debtMoves += summary.debtMoves;
      }
    }
  }

  if (count === 0) {
    return null;
  }

  return {
    count,
    expenseTotal,
    incomeTotal,
    debtMoves,
  };
}
