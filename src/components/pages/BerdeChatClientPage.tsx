'use client';

import Link from 'next/link';
import { format } from 'date-fns';
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Send,
  Sparkles,
  XCircle,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import BerdeSprite from '@/components/BerdeSprite';
import { useAppSession } from '@/components/AppSessionProvider';
import { parseBerdeChatInput } from '@/lib/berde/chat-parser';
import type {
  BerdeChatConfidenceLabel,
  BerdeChatIntent,
  BerdeParsedAction,
  BerdeParsedActionBatch,
  BerdeTransactionAction,
} from '@/lib/berde/chat.types';
import {
  addSavingsDeposit,
  createDebt,
  createTransaction,
  createTransfer,
  getAccounts,
  getDebts,
  repayDebt,
  getSavingsGoals,
  getTransactions,
  settleDebt,
} from '@/lib/local-store';
import type {
  Account,
  Debt,
  SavingsDepositInput,
  SavingsGoal,
  Transaction,
  TransactionInput,
} from '@/lib/types';
import { formatCurrency } from '@/lib/utils';

const SESSION_STORAGE_KEY = 'berde-chat-session-v4';
const EXAMPLE_PROMPTS = [
  'spent 250 on lunch',
  '100 mrt yesterday',
  'salary 15000',
  'received 2k freelance',
] as const;
const MOBILE_EXAMPLE_PROMPTS = EXAMPLE_PROMPTS.slice(0, 2);
const POST_SAVE_FOLLOW_UP_CHIPS = ['Add another', 'Log income', 'Move money'] as const;
const POST_SAVE_REPLY_INPUTS: Record<(typeof POST_SAVE_FOLLOW_UP_CHIPS)[number], string> = {
  'Add another': 'spent ',
  'Log income': 'received ',
  'Move money': 'transfer ',
};
const STARTER_REPLY_INPUTS = {
  'Log expense': 'spent ',
  'Log income': 'received ',
  'Move money': 'transfer ',
  'Track utang': 'lent ',
} as const;
const EMPTY_STATE_CHIPS: Array<{ label: string; value: string; mode: 'submit' | 'seed' }> = [
  { label: 'spent 250 on lunch', value: 'spent 250 on lunch', mode: 'submit' },
  { label: '100 mrt yesterday', value: '100 mrt yesterday', mode: 'submit' },
  { label: 'Log income', value: 'Log income', mode: 'seed' },
  { label: 'Track utang', value: 'Track utang', mode: 'seed' },
];

type PreviewState =
  | { kind: 'pending' }
  | { kind: 'logged' }
  | { kind: 'cancelled' };

type LegacyPreviewStatus = 'pending' | 'logged' | 'cancelled';

type ReceiptMeta = {
  actionKind:
    | 'expense'
    | 'income'
    | 'transfer'
    | 'savings_deposit'
    | 'savings_withdrawal'
    | 'debt_create'
    | 'debt_payment'
    | 'debt_settlement';
  amount?: number;
  label: string;
  date: string;
  batchId?: string;
};

type BerdeChatMessage =
  | {
      id: string;
      role: 'user' | 'berde';
      kind: 'text';
      text: string;
      spriteState?: 'neutral' | 'helper' | 'excited';
      quickReplies?: string[];
    }
  | {
      id: string;
      role: 'berde';
      kind: 'preview';
      text: string;
      batch: BerdeParsedActionBatch;
      confidenceLabel: BerdeChatConfidenceLabel;
      previewState: PreviewState;
      quickReplies?: string[];
    }
  | {
      id: string;
      role: 'berde';
      kind: 'receipt';
      text: string;
      receiptMeta?: ReceiptMeta;
      quickReplies?: string[];
    };

interface StoredChatState {
  messages: BerdeChatMessage[];
  activeIntent: BerdeChatIntent | null;
  didClearThread?: boolean;
}

function normalizePreviewState(status?: LegacyPreviewStatus): PreviewState {
  switch (status) {
    case 'logged':
      return { kind: 'logged' };
    case 'cancelled':
      return { kind: 'cancelled' };
    case 'pending':
    default:
      return { kind: 'pending' };
  }
}

function migrateStoredMessage(rawMessage: unknown): BerdeChatMessage | null {
  if (!rawMessage || typeof rawMessage !== 'object') {
    return null;
  }

  const message = rawMessage as Record<string, unknown>;
  if (message.role !== 'berde' && message.role !== 'user') {
    return null;
  }
  if (message.kind !== 'text' && message.kind !== 'preview' && message.kind !== 'receipt') {
    return null;
  }
  if (typeof message.id !== 'string' || typeof message.text !== 'string') {
    return null;
  }

  if (message.kind === 'receipt') {
    const rawReceiptMeta =
      message.receiptMeta && typeof message.receiptMeta === 'object'
        ? (message.receiptMeta as Record<string, unknown>)
        : null;

    return {
      id: message.id,
      role: 'berde',
      kind: 'receipt',
      text: message.text,
      receiptMeta: rawReceiptMeta
          ? {
              actionKind:
                rawReceiptMeta.actionKind === 'expense' ||
                rawReceiptMeta.actionKind === 'income' ||
                rawReceiptMeta.actionKind === 'transfer' ||
                rawReceiptMeta.actionKind === 'savings_deposit' ||
                rawReceiptMeta.actionKind === 'savings_withdrawal' ||
                rawReceiptMeta.actionKind === 'debt_create' ||
                rawReceiptMeta.actionKind === 'debt_payment' ||
                rawReceiptMeta.actionKind === 'debt_settlement'
                  ? rawReceiptMeta.actionKind
                  : 'expense',
              amount: typeof rawReceiptMeta.amount === 'number' ? rawReceiptMeta.amount : undefined,
              label: typeof rawReceiptMeta.label === 'string' ? rawReceiptMeta.label : message.text,
              date: typeof rawReceiptMeta.date === 'string' ? rawReceiptMeta.date : new Date().toISOString(),
              batchId: typeof rawReceiptMeta.batchId === 'string' ? rawReceiptMeta.batchId : undefined,
            }
          : undefined,
      quickReplies: Array.isArray(message.quickReplies)
        ? message.quickReplies.filter((reply): reply is string => typeof reply === 'string')
        : undefined,
    };
  }

  if (message.kind === 'text') {
    return {
      id: message.id,
      role: message.role,
      kind: 'text',
      text: message.text,
      spriteState:
        message.spriteState === 'neutral' ||
        message.spriteState === 'helper' ||
        message.spriteState === 'excited'
          ? message.spriteState
          : undefined,
      quickReplies: Array.isArray(message.quickReplies)
        ? message.quickReplies.filter((reply): reply is string => typeof reply === 'string')
        : undefined,
    };
  }

  if (
    !message.batch ||
    typeof message.batch !== 'object' ||
    !('actions' in message.batch) ||
    !Array.isArray((message.batch as Record<string, unknown>).actions)
  ) {
    return null;
  }

  const previewState =
    message.previewState && typeof message.previewState === 'object' && 'kind' in message.previewState
      ? normalizePreviewState((message.previewState as Record<string, unknown>).kind as LegacyPreviewStatus)
      : normalizePreviewState(message.status as LegacyPreviewStatus | undefined);

  return {
    id: message.id,
    role: 'berde',
    kind: 'preview',
    text: message.text,
    batch: message.batch as BerdeParsedActionBatch,
    confidenceLabel:
      message.confidenceLabel === 'high' ||
      message.confidenceLabel === 'medium' ||
      message.confidenceLabel === 'low'
        ? message.confidenceLabel
        : 'medium',
    previewState,
    quickReplies: Array.isArray(message.quickReplies)
      ? message.quickReplies.filter((reply): reply is string => typeof reply === 'string')
      : undefined,
  };
}

function createMessageId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function deriveFirstName(value: string): string {
  const normalized = value.includes('@') ? value.split('@')[0] : value;
  const firstToken = normalized.trim().split(/\s+/)[0];
  return firstToken || 'there';
}

function createWelcomeMessages(firstName: string): BerdeChatMessage[] {
  return [
    {
      id: createMessageId('berde'),
      role: 'berde',
      kind: 'text',
      text: `Hi ${firstName}. Tell me what you spent or earned, and I'll turn it into a draft before anything gets saved.`,
      spriteState: 'helper',
    },
    {
      id: createMessageId('berde'),
      role: 'berde',
      kind: 'text',
      text: `Try messages like "${EXAMPLE_PROMPTS[0]}", "${EXAMPLE_PROMPTS[1]}", or "${EXAMPLE_PROMPTS[2]}".`,
      spriteState: 'neutral',
    },
  ];
}

function readStoredState(firstName: string): StoredChatState {
  if (typeof window === 'undefined') {
    return {
      messages: createWelcomeMessages(firstName),
      activeIntent: null,
      didClearThread: false,
    };
  }

  try {
    const raw = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) {
      return {
        messages: createWelcomeMessages(firstName),
        activeIntent: null,
        didClearThread: false,
      };
    }

    const parsed = JSON.parse(raw) as StoredChatState;
    if (!Array.isArray(parsed.messages)) {
      return {
        messages: createWelcomeMessages(firstName),
        activeIntent: null,
        didClearThread: false,
      };
    }

    const migratedMessages = parsed.messages
      .map((message) => migrateStoredMessage(message))
      .filter((message): message is BerdeChatMessage => message !== null);

    return {
      messages: migratedMessages.length > 0 ? migratedMessages : createWelcomeMessages(firstName),
      activeIntent: parsed.activeIntent ?? null,
      didClearThread: Boolean(parsed.didClearThread),
    };
  } catch {
    return {
      messages: createWelcomeMessages(firstName),
      activeIntent: null,
      didClearThread: false,
    };
  }
}

function buildTransactionInputFromAction(action: BerdeTransactionAction): TransactionInput {
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

function getActionHeadline(action: BerdeParsedAction): string {
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

function getBatchSummary(batch: BerdeParsedActionBatch): string {
  return `${batch.actions.length} actions`;
}

function getPreviewCardText(state: PreviewState): string {
  switch (state.kind) {
    case 'pending':
      return '';
    case 'logged':
      return '';
    case 'cancelled':
      return 'Canceled. Nothing was saved.';
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

function getDraftVoiceLine(
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

function getLowConfidenceNote(confidenceLabel: BerdeChatConfidenceLabel): string | null {
  if (confidenceLabel !== 'low') {
    return null;
  }

  return 'Hindi ako sigurado sa ilan dito - check mo muna.';
}

function getActionFocusLabel(action: BerdeParsedAction): string {
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

function getConfidenceBadgeClass(confidenceLabel: BerdeChatConfidenceLabel): string {
  if (confidenceLabel === 'low') {
    return 'bg-amber-100 text-amber-800 border-amber-200';
  }
  return 'bg-zinc-100 text-zinc-700 border-zinc-200';
}

function clearInteractiveState(messages: BerdeChatMessage[]): BerdeChatMessage[] {
  return messages.map((message) => {
    if (!message.quickReplies || message.quickReplies.length === 0) {
      return message;
    }

    return {
      ...message,
      quickReplies: [],
    };
  });
}

function findLatestPendingPreviewMessage(
  messages: BerdeChatMessage[],
): Extract<BerdeChatMessage, { kind: 'preview' }> | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.kind === 'preview' && message.previewState.kind === 'pending') {
      return message;
    }
  }

  return null;
}

function AssistantBubble(props: {
  message: {
    id: string;
    role: 'berde';
    kind: 'text';
    text: string;
    spriteState?: 'neutral' | 'helper' | 'excited';
    quickReplies?: string[];
  };
  showSprite: boolean;
  onQuickReply: (value: string) => void;
}) {
  const { message, onQuickReply, showSprite } = props;

  return (
    <div className="flex items-end gap-3">
      <div className="flex h-[46px] w-[46px] shrink-0 items-end justify-center">
        {showSprite ? (
          <div className="rounded-2xl bg-[#0F6E56] p-1.5 shadow-[0_10px_24px_rgba(15,110,86,0.16)]">
            <BerdeSprite state={message.spriteState ?? 'neutral'} size={34} />
          </div>
        ) : null}
      </div>
      <div className="max-w-[min(84vw,44rem)] lg:max-w-[46rem]">
        <div className="rounded-[24px] rounded-bl-[10px] border border-[#d8e6df] bg-white px-4 py-3 text-sm leading-6 text-zinc-700 shadow-[0_12px_28px_rgba(15,23,42,0.08)]">
          {message.text}
        </div>
        {message.quickReplies && message.quickReplies.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {message.quickReplies.map((reply) => (
              <button
                key={`${message.id}-${reply}`}
                type="button"
                onClick={() => onQuickReply(reply)}
                className="inline-flex items-center rounded-full border border-[#bfe7d9] bg-white px-3 py-1.5 text-xs font-medium text-[#0F6E56] transition-colors hover:bg-[#E1F5EE]"
              >
                {reply}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function getActionKindLabel(action: BerdeParsedAction): string {
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

function getActionMeta(action: BerdeParsedAction): Array<{ label: string; value: string }> {
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

// Legacy receipt copy is kept for session-state migration safety.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function getReceiptText(action: BerdeParsedAction): string {
  const formattedDate = format(new Date(action.date), 'MMM d');

  switch (action.kind) {
    case 'transaction':
      return `✓ ${formatCurrency(action.amount ?? 0)} ${action.entryType === 'income' ? 'income' : 'expense'} · ${
        action.entryType === 'income' ? (action.incomeCategory || 'Other Income') : (action.category || 'Miscellaneous')
      } · ${formattedDate}`;
    case 'transfer':
      return `✓ ${formatCurrency(action.amount ?? 0)} transfer · ${
        action.fromAccountName || 'One account'
      } to ${action.toAccountName || 'another account'} · ${formattedDate}`;
    case 'savings':
      return `✓ ${formatCurrency(action.amount ?? 0)} ${
        action.savingsType === 'withdrawal' ? 'withdrawal' : 'saved'
      } · ${action.goalName || 'Savings'} · ${formattedDate}`;
    case 'debt':
      if (action.debtMode === 'settle') {
        return `✓ ${formatCurrency(action.amount ?? 0)} debt payment · ${action.personName || 'Debt'} · ${formattedDate}`;
      }
      return `✓ ${formatCurrency(action.amount ?? 0)} debt · ${action.personName || 'Debt'} · ${formattedDate}`;
  }
}

function buildReceiptMessages(batch: BerdeParsedActionBatch): Extract<BerdeChatMessage, { kind: 'receipt' }>[] {
  return buildSmartReceiptMessages(batch);
}

function getSmartReceiptText(action: BerdeParsedAction): string {
  const formattedDate = format(new Date(action.date), 'MMM d');

  switch (action.kind) {
    case 'transaction':
      return `✓ ${formatCurrency(action.amount ?? 0)} ${action.entryType === 'income' ? 'income' : 'expense'} · ${
        action.entryType === 'income' ? (action.incomeCategory || 'Other Income') : (action.category || 'Miscellaneous')
      } · ${formattedDate}`;
    case 'transfer':
      return `✓ ${formatCurrency(action.amount ?? 0)} transfer · ${
        action.fromAccountName || 'One account'
      } to ${action.toAccountName || 'another account'} · ${formattedDate}`;
    case 'savings':
      return `✓ ${formatCurrency(action.amount ?? 0)} ${
        action.savingsType === 'withdrawal' ? 'withdrawal' : 'saved'
      } · ${action.goalName || 'Savings'} · ${formattedDate}`;
    case 'debt':
      if (action.debtMode === 'settle') {
        if (action.settlementType === 'partial') {
          return `✓ ${formatCurrency(action.amount ?? 0)} debt payment · ${action.personName || 'Debt'} · ${formattedDate}`;
        }
        return `✓ Debt settled · ${action.personName || 'Debt'} · ${formattedDate}`;
      }
      return `✓ ${formatCurrency(action.amount ?? 0)} debt logged · ${action.personName || 'Debt'} · ${formattedDate}`;
  }
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

function getSessionSummary(messages: BerdeChatMessage[]) {
  const receipts = messages.filter((message): message is Extract<BerdeChatMessage, { kind: 'receipt' }> => message.kind === 'receipt');
  if (receipts.length === 0) {
    return null;
  }

  let expenseTotal = 0;
  let incomeTotal = 0;
  let debtMoves = 0;

  for (const receipt of receipts) {
    if (!receipt.receiptMeta) {
      continue;
    }

    if (receipt.receiptMeta.actionKind === 'expense') {
      expenseTotal += receipt.receiptMeta.amount ?? 0;
    } else if (receipt.receiptMeta.actionKind === 'income') {
      incomeTotal += receipt.receiptMeta.amount ?? 0;
    } else if (
      receipt.receiptMeta.actionKind === 'debt_create'
      || receipt.receiptMeta.actionKind === 'debt_payment'
      || receipt.receiptMeta.actionKind === 'debt_settlement'
    ) {
      debtMoves += 1;
    }
  }

  return {
    count: receipts.length,
    expenseTotal,
    incomeTotal,
    debtMoves,
  };
}

function ReceiptBubble(props: {
  message: Extract<BerdeChatMessage, { kind: 'receipt' }>;
  onQuickReply: (value: string) => void;
}) {
  const { message, onQuickReply } = props;

  return (
    <div className="flex items-start gap-3">
      <div className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
        <CheckCircle2 size={16} />
      </div>
      <div className="min-w-0 max-w-[min(84vw,44rem)] lg:max-w-[46rem]">
        <div className="rounded-[18px] border border-[#d8e6df] bg-white px-4 py-2.5 text-sm text-zinc-700 shadow-[0_10px_22px_rgba(15,23,42,0.06)]">
          {message.text}
        </div>
        {message.quickReplies && message.quickReplies.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {message.quickReplies.map((reply) => (
              <button
                key={`${message.id}-${reply}`}
                type="button"
                onClick={() => onQuickReply(reply)}
                className="inline-flex items-center rounded-full border border-[#bfe7d9] bg-white px-3 py-1.5 text-xs font-medium text-[#0F6E56] transition-colors hover:bg-[#E1F5EE]"
              >
                {reply}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function BatchPreviewCard(props: {
  message: Extract<BerdeChatMessage, { kind: 'preview' }>;
  showSprite: boolean;
  onConfirm: (messageId: string, batch: BerdeParsedActionBatch) => void;
  onCancel: (messageId: string) => void;
  saving: boolean;
  onQuickReply: (value: string) => void;
}) {
  const { message, onConfirm, onCancel, onQuickReply, saving, showSprite } = props;
  let statusCopy: string;
  let statusClass: string;

  switch (message.previewState.kind) {
    case 'pending':
      statusCopy = 'Review';
      statusClass = getConfidenceBadgeClass(message.confidenceLabel);
      break;
    case 'logged':
      statusCopy = 'Logged';
      statusClass = 'bg-emerald-100 text-emerald-800 border-emerald-200';
      break;
    case 'cancelled':
      statusCopy = 'Cancelled';
      statusClass = 'bg-zinc-100 text-zinc-700 border-zinc-200';
      break;
  }

  const summaryBadge = message.batch.actions.length > 1 ? getBatchSummary(message.batch) : null;
  const showCardText = message.text.trim().length > 0;
  const lowConfidenceNote = message.previewState.kind === 'pending'
    ? getLowConfidenceNote(message.confidenceLabel)
    : null;

  return (
    <div className="flex items-start gap-2.5 sm:gap-3">
      <div className="flex h-[42px] w-[42px] shrink-0 items-start justify-center sm:h-[46px] sm:w-[46px] sm:items-end">
        {showSprite ? (
          <div className="rounded-2xl bg-[#0F6E56] p-1.5 shadow-[0_10px_24px_rgba(15,110,86,0.16)]">
            <BerdeSprite state="neutral" size={30} />
          </div>
        ) : null}
      </div>
      <div className="min-w-0 flex-1 max-w-[min(100%,58rem)] lg:max-w-[60rem]">
        <div className="rounded-[22px] rounded-bl-[10px] border border-[#bfe7d9] bg-[#f4fffa] px-4 py-3 text-zinc-900 shadow-[0_12px_28px_rgba(15,110,86,0.1)] sm:rounded-[26px]">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${statusClass}`}>
              {statusCopy}
            </span>
            {summaryBadge ? (
              <span className="inline-flex items-center rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-[11px] font-medium text-zinc-600">
                {summaryBadge}
              </span>
            ) : null}
          </div>

          {showCardText ? (
            <p className="mt-3 text-sm leading-6 text-zinc-700">{message.text}</p>
          ) : null}

          <div className="mt-4 space-y-3">
            {message.batch.actions.map((action, index) => (
              <div key={action.id} className="rounded-2xl border border-white/90 bg-white px-3 py-3 sm:px-4">
                {message.batch.actions.length === 1 && action.kind === 'transaction' ? (
                  <p className="text-base font-medium leading-tight text-zinc-900">
                    {getActionHeadline(action)}
                  </p>
                ) : message.batch.actions.length === 1 ? (
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                    <div>
                      <p className="text-base font-semibold text-zinc-900">
                        {action.kind === 'debt' ? (action.debtMode === 'settle' ? getActionKindLabel(action) : 'Debt') : getActionKindLabel(action)}
                      </p>
                    </div>
                    <p className="text-base font-medium leading-tight text-zinc-900">
                      {getActionHeadline(action)}
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.16em] text-zinc-400">
                        Action {index + 1}
                      </p>
                      <p className="mt-1 text-base font-semibold text-zinc-900">
                        {getActionKindLabel(action)}
                      </p>
                    </div>
                    <p className="text-base font-medium leading-tight text-zinc-900">
                      {getActionHeadline(action)}
                    </p>
                  </div>
                )}

                <div className="mt-2 grid grid-cols-1 gap-x-4 gap-y-3 text-sm text-zinc-600 min-[420px]:grid-cols-2 xl:grid-cols-3">
                  {getActionMeta(action).map((entry) => (
                    <div key={`${action.id}-${entry.label}`}>
                      <p className="text-[11px] uppercase tracking-[0.14em] text-zinc-400">
                        {entry.label}
                      </p>
                      <p className="mt-1">{entry.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {message.previewState.kind === 'pending' ? (
            <div className="mt-4 grid grid-cols-1 gap-2 min-[420px]:grid-cols-2">
              <button
                type="button"
                onClick={() => onConfirm(message.id, message.batch)}
                disabled={saving}
                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-full bg-[#0F6E56] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#0b5b47] disabled:opacity-60"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                {saving ? 'Logging...' : `Log ${message.batch.actions.length > 1 ? 'all' : 'it'}`}
              </button>
              <button
                type="button"
                onClick={() => onCancel(message.id)}
                disabled={saving}
                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-full border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-60"
              >
                <XCircle size={16} />
                Cancel
              </button>
            </div>
          ) : null}

          {lowConfidenceNote ? (
            <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
              {lowConfidenceNote}
            </div>
          ) : null}

          {message.quickReplies && message.quickReplies.length > 0 ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {message.quickReplies.map((reply) => (
                <button
                  key={`${message.id}-${reply}`}
                  type="button"
                  onClick={() => onQuickReply(reply)}
                  className="inline-flex items-center rounded-full border border-[#bfe7d9] bg-white px-3 py-1.5 text-xs font-medium text-[#0F6E56] transition-colors hover:bg-[#E1F5EE]"
                >
                  {reply}
                </button>
              ))}
            </div>
          ) : null}
        </div>

      </div>
    </div>
  );
}

function UserBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[min(76vw,24rem)] rounded-[24px] rounded-br-[10px] bg-[#0F6E56] px-4 py-3 text-sm font-medium leading-6 text-white shadow-[0_12px_24px_rgba(15,110,86,0.18)] lg:max-w-[28rem]">
        {text}
      </div>
    </div>
  );
}

export default function BerdeChatClientPage() {
  const { viewer } = useAppSession();
  const firstName = useMemo(() => deriveFirstName(viewer.displayName), [viewer.displayName]);
  const initialState = useMemo(() => readStoredState(firstName), [firstName]);
  const [messages, setMessages] = useState<BerdeChatMessage[]>(initialState.messages);
  const [activeIntent, setActiveIntent] = useState<BerdeChatIntent | null>(initialState.activeIntent);
  const [didClearThread, setDidClearThread] = useState(Boolean(initialState.didClearThread));
  const [input, setInput] = useState('');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [savingsGoals, setSavingsGoals] = useState<SavingsGoal[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [savingMessageId, setSavingMessageId] = useState<string | null>(null);
  const threadEndRef = useRef<HTMLDivElement | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    window.sessionStorage.setItem(
      SESSION_STORAGE_KEY,
      JSON.stringify({
        messages,
        activeIntent,
        didClearThread,
      } satisfies StoredChatState),
    );
  }, [activeIntent, didClearThread, messages]);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages]);

  useEffect(() => {
    let cancelled = false;

    async function loadContext() {
      try {
        const [nextAccounts, nextTransactions, nextGoals, nextDebts] = await Promise.all([
          getAccounts(),
          getTransactions({ includeRecurringProcessing: false }),
          getSavingsGoals(),
          getDebts(),
        ]);

        if (cancelled) {
          return;
        }

        setAccounts(nextAccounts);
        setRecentTransactions(nextTransactions.slice(0, 12));
        setSavingsGoals(nextGoals);
        setDebts(nextDebts);
      } finally {
        // no-op: context data is consumed locally after load
      }
    }

    void loadContext();
    return () => {
      cancelled = true;
    };
  }, []);

  const focusedAction = useMemo(() => {
    if (!activeIntent?.batch || activeIntent.stage !== 'collecting_field') {
      return null;
    }
    const index = activeIntent.batch.focusActionIndex;
    if (index === undefined) {
      return null;
    }
    return {
      action: activeIntent.batch.actions[index],
      index,
      total: activeIntent.batch.actions.length,
    };
  }, [activeIntent]);

  const sessionSummary = useMemo(() => getSessionSummary(messages), [messages]);

  const pushParserResponse = (parserResult: ReturnType<typeof parseBerdeChatInput>) => {
    setMessages((current) => {
      const nextMessages = clearInteractiveState(current);
      if ((parserResult.intent.kind === 'action_batch' || parserResult.intent.kind === 'confirm') && parserResult.intent.batch) {
        const previewState: PreviewState = { kind: 'pending' };
        nextMessages.push({
          id: createMessageId('preview'),
          role: 'berde',
          kind: 'preview',
          text: getDraftVoiceLine(parserResult.intent.batch, parserResult.intent.confidenceLabel),
          batch: parserResult.intent.batch,
          confidenceLabel: parserResult.intent.confidenceLabel,
          previewState,
        });
      } else {
        nextMessages.push({
          id: createMessageId('berde'),
          role: 'berde',
          kind: 'text',
          text: parserResult.replyText,
          spriteState: parserResult.intent.stage === 'collecting_field' ? 'helper' : 'neutral',
          quickReplies: parserResult.intent.quickReplies,
        });
      }
      return nextMessages;
    });

    setActiveIntent(parserResult.intent.kind === 'unsupported' ? null : parserResult.intent);
    setDidClearThread(false);
  };

  const submitMessage = (nextInput?: string) => {
    const rawMessage = (nextInput ?? input).trim();
    if (!rawMessage || savingMessageId) {
      return;
    }

    if (rawMessage.toLowerCase() === 'cancel') {
      setMessages((current) => [
        ...clearInteractiveState(current),
        {
          id: createMessageId('user'),
          role: 'user',
          kind: 'text',
          text: rawMessage,
        },
      ]);
      setInput('');
      setDidClearThread(false);
      handleDismissPendingIntent();
      return;
    }

    const userMessage: BerdeChatMessage = {
      id: createMessageId('user'),
      role: 'user',
      kind: 'text',
      text: rawMessage,
    };

    const parserResult = parseBerdeChatInput(rawMessage, {
      accounts,
      savingsGoals,
      debts,
      recentTransactions,
      now: new Date(),
      pendingBatch: activeIntent?.batch ?? null,
      pendingIntent: activeIntent,
    });

    setMessages((current) => [...clearInteractiveState(current), userMessage]);
    setInput('');
    setDidClearThread(false);

    if (parserResult.intent.kind === 'confirm' && parserResult.intent.batch) {
      void handleImplicitConfirm(parserResult.intent.batch);
      return;
    }

    pushParserResponse(parserResult);
  };

  const handleClearChat = () => {
    setMessages([]);
    setActiveIntent(null);
    setInput('');
    setDidClearThread(true);
  };

  const handleImplicitConfirm = async (batch: BerdeParsedActionBatch) => {
    const syntheticId = createMessageId('preview');
    const previewState: PreviewState = { kind: 'pending' };
    setMessages((current) => [
      ...clearInteractiveState(current),
      {
        id: syntheticId,
        role: 'berde',
        kind: 'preview',
        text: getDraftVoiceLine(batch, 'high'),
        batch,
        confidenceLabel: 'high',
        previewState,
      },
    ]);
    await handleConfirmBatch(syntheticId, batch);
  };

  const executeAction = async (action: BerdeParsedAction) => {
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
  };

  const handleConfirmBatch = async (messageId: string, batch: BerdeParsedActionBatch) => {
    setSavingMessageId(messageId);

    try {
      for (const action of batch.actions) {
        await executeAction(action);
      }

      setMessages((current): BerdeChatMessage[] => {
        const clearedMessages = clearInteractiveState(current);
        const nextMessages: BerdeChatMessage[] = [];

        for (const message of clearedMessages) {
          if (message.kind === 'preview' && message.id === messageId) {
            nextMessages.push(...buildReceiptMessages(batch));
            continue;
          }

          nextMessages.push(message);
        }

        return nextMessages;
      });
      setActiveIntent(null);

      const [nextAccounts, nextTransactions, nextGoals, nextDebts] = await Promise.all([
        getAccounts(),
        getTransactions({ includeRecurringProcessing: false }),
        getSavingsGoals(),
        getDebts(),
      ]);
      setAccounts(nextAccounts);
      setRecentTransactions(nextTransactions.slice(0, 12));
      setSavingsGoals(nextGoals);
      setDebts(nextDebts);
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : 'Something went wrong while saving that transaction.';
      setMessages((current) => [
        ...clearInteractiveState(current),
        {
          id: createMessageId('berde'),
          role: 'berde',
          kind: 'text',
          text: `I couldn't save that yet. ${message}`,
          spriteState: 'helper',
        },
      ]);
    } finally {
      setSavingMessageId(null);
    }
  };

  const handleCancelBatch = (messageId: string) => {
    setMessages((current): BerdeChatMessage[] => {
      const updatedMessages = clearInteractiveState(current).map((message): BerdeChatMessage => {
        if (message.kind !== 'preview' || message.id !== messageId) {
          return message;
        }

        const previewState: PreviewState = { kind: 'cancelled' };
        return {
          ...message,
          previewState,
          text: getPreviewCardText(previewState),
          quickReplies: [],
        };
      });

      return [
        ...updatedMessages,
        {
          id: createMessageId('berde'),
          role: 'berde',
          kind: 'text',
          text: 'Canceled. Nothing was saved.',
          spriteState: 'neutral',
        },
      ];
    });
    setActiveIntent(null);
  };

  const handleDismissPendingIntent = () => {
    const pendingPreview = findLatestPendingPreviewMessage(messages);
    if (pendingPreview) {
      handleCancelBatch(pendingPreview.id);
      return;
    }

    if (!activeIntent) {
      return;
    }

    setMessages((current) => [
      ...clearInteractiveState(current),
      {
        id: createMessageId('berde'),
        role: 'berde',
        kind: 'text',
        text: 'Canceled. I cleared that pending chat flow.',
        spriteState: 'neutral',
      },
    ]);
    setActiveIntent(null);
  };

  const handleQuickReply = (value: string) => {
    if (value in STARTER_REPLY_INPUTS) {
      setInput(STARTER_REPLY_INPUTS[value as keyof typeof STARTER_REPLY_INPUTS]);
      composerRef.current?.focus();
      return;
    }

    if (value in POST_SAVE_REPLY_INPUTS) {
      setInput(POST_SAVE_REPLY_INPUTS[value as keyof typeof POST_SAVE_REPLY_INPUTS]);
      composerRef.current?.focus();
      return;
    }

    if (value.trim().toLowerCase() === 'cancel') {
      handleDismissPendingIntent();
      return;
    }

    submitMessage(value);
  };

  const handleExamplePrompt = (value: string) => {
    submitMessage(value);
  };

  const handleStarterPrompt = (value: string, mode: 'submit' | 'seed') => {
    if (mode === 'submit') {
      submitMessage(value);
      return;
    }

    if (value in STARTER_REPLY_INPUTS) {
      setInput(STARTER_REPLY_INPUTS[value as keyof typeof STARTER_REPLY_INPUTS]);
      composerRef.current?.focus();
    }
  };

  return (
    <div className="flex h-[calc(100dvh-5rem)] w-full flex-col overflow-hidden px-3 py-3 sm:h-dvh sm:px-5 sm:pb-6 md:py-5 lg:px-8">
      <div className="flex min-h-0 w-full flex-1 flex-col gap-4">
        <header className="w-full shrink-0">
          <div className="rounded-[22px] border border-[#c8e9dd] bg-[linear-gradient(180deg,#f3fff9_0%,#ffffff_100%)] p-3 shadow-[0_14px_28px_rgba(15,110,86,0.08)] md:hidden">
            <div className="flex items-center justify-between gap-3">
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
              >
                <ArrowLeft size={16} />
                Back
              </Link>
              <button
                type="button"
                onClick={handleClearChat}
                className="inline-flex items-center rounded-full border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
              >
                New chat
              </button>
            </div>

            <div className="mt-3 flex items-start gap-3">
              <div className="rounded-2xl bg-[#0F6E56] p-2">
                <BerdeSprite state="neutral" size={42} />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#0F6E56]">
                  Berde Chat
                </p>
                <h1 className="mt-1 font-display text-xl font-semibold text-zinc-900">
                  Chat with Berde
                </h1>
                <p className="mt-1 text-sm leading-5 text-zinc-600">
                  Draft first, save after you confirm.
                </p>
              </div>
            </div>

            {messages.length === 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
              {MOBILE_EXAMPLE_PROMPTS.map((example) => (
                <button
                  key={`mobile-${example}`}
                  type="button"
                  onClick={() => handleExamplePrompt(example)}
                  className="inline-flex items-center rounded-full border border-[#bfe7d9] bg-white px-3 py-1.5 text-xs font-medium text-[#0F6E56] transition-colors hover:bg-[#E1F5EE]"
                >
                  {example}
                </button>
              ))}
              </div>
            ) : null}
          </div>

          <div className="hidden md:block">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                <ArrowLeft size={16} />
                Back to dashboard
              </Link>
              <button
                type="button"
                onClick={handleClearChat}
                className="inline-flex items-center rounded-full border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
              >
                New chat
              </button>
            </div>

            <div className="mt-3 rounded-[24px] border border-[#c8e9dd] bg-[linear-gradient(180deg,#f3fff9_0%,#ffffff_100%)] p-4 shadow-[0_18px_40px_rgba(15,110,86,0.08)] sm:p-5 lg:rounded-[30px]">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
              <div className="rounded-2xl bg-[#0F6E56] p-2">
                <BerdeSprite state="neutral" size={54} />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#0F6E56]">
                  Berde Chat
                </p>
                <h1 className="mt-1 font-display text-2xl font-semibold text-zinc-900">
                  Talk to Berde
                </h1>
                <p className="mt-1 text-sm leading-6 text-zinc-600">
                  Draft first, save after you confirm.
                </p>
              </div>
            </div>

            {messages.length === 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {EXAMPLE_PROMPTS.map((example) => (
                  <button
                    key={example}
                    type="button"
                    onClick={() => handleExamplePrompt(example)}
                    className="inline-flex items-center rounded-full border border-[#bfe7d9] bg-white px-3 py-1.5 text-xs font-medium text-[#0F6E56] transition-colors hover:bg-[#E1F5EE]"
                  >
                    {example}
                  </button>
                ))}
              </div>
            ) : null}
            </div>
          </div>
        </header>

        <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[22px] border border-[#dfe7e3] bg-[rgba(255,255,255,0.78)] shadow-[0_18px_36px_rgba(15,23,42,0.08)] backdrop-blur-sm lg:rounded-[32px]">
          <div className="flex-1 overflow-y-auto overscroll-contain px-3 py-3 sm:px-5 sm:py-5 lg:px-8 lg:py-6">
            <div className="flex flex-col">
              {sessionSummary ? (
                <div className="mb-4 rounded-[20px] border border-[#d7eadf] bg-[#f7fffb] px-4 py-3 text-sm text-zinc-700 shadow-[0_10px_22px_rgba(15,23,42,0.05)]">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center rounded-full border border-[#bfe7d9] bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#0F6E56]">
                      This session
                    </span>
                    <span className="text-sm font-medium text-zinc-900">
                      {sessionSummary.count} logged item{sessionSummary.count === 1 ? '' : 's'}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-600">
                    <span>Expenses: {formatCurrency(sessionSummary.expenseTotal)}</span>
                    <span>Income: {formatCurrency(sessionSummary.incomeTotal)}</span>
                    <span>Debt moves: {sessionSummary.debtMoves}</span>
                  </div>
                </div>
              ) : null}
              {messages.length === 0 ? (
                <div className="flex min-h-[9.5rem] flex-col items-start justify-center rounded-[20px] border border-dashed border-[#cfe7dd] bg-[linear-gradient(180deg,#f8fffb_0%,#ffffff_100%)] px-4 py-4 text-left md:min-h-[18rem] md:items-center md:rounded-[24px] md:px-5 md:py-8 md:text-center lg:min-h-[22rem] lg:rounded-[28px] lg:px-6 lg:py-10">
                  <div className="rounded-2xl bg-[#0F6E56] p-2 shadow-[0_14px_28px_rgba(15,110,86,0.12)]">
                    <BerdeSprite state="helper" size={40} />
                  </div>
                  <h2 className="mt-3 font-display text-lg font-semibold text-zinc-900 md:mt-4 md:text-xl">
                    Fresh chat, ready when you are
                  </h2>
                  <p className="mt-1 max-w-md text-sm leading-5 text-zinc-600 md:mt-2 md:leading-6">
                    {didClearThread
                      ? 'Your last thread was cleared. Start another quick log and Berde will draft it before anything gets saved.'
                      : 'Start another quick log and Berde will draft it before anything gets saved.'}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2 md:mt-4 md:justify-center">
                    {EMPTY_STATE_CHIPS.map((chip, index) => (
                      <button
                        key={`empty-${chip.label}`}
                        type="button"
                        onClick={() => handleStarterPrompt(chip.value, chip.mode)}
                        className={`items-center rounded-full border border-[#bfe7d9] bg-white px-3 py-1.5 text-xs font-medium text-[#0F6E56] transition-colors hover:bg-[#E1F5EE] ${
                          index < 2 ? 'inline-flex' : 'hidden md:inline-flex'
                        }`}
                      >
                        {chip.label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
              {messages.map((message, index) => {
                const previousMessage = messages[index - 1];
                const nextMessage = messages[index + 1];
                const showAssistantSprite =
                  message.role === 'berde' && nextMessage?.role !== 'berde';
                const isGroupedReceipt =
                  message.kind === 'receipt'
                  && previousMessage?.kind === 'receipt'
                  && Boolean(message.receiptMeta?.batchId)
                  && message.receiptMeta?.batchId === previousMessage.receiptMeta?.batchId;
                const rowSpacingClass =
                  index === 0
                    ? ''
                    : isGroupedReceipt
                      ? 'mt-2'
                    : previousMessage?.role === 'berde' && message.role === 'berde'
                      ? 'mt-2'
                      : 'mt-5';

                if (message.role === 'user') {
                  return (
                    <div key={message.id} className={rowSpacingClass}>
                      <UserBubble text={message.text} />
                    </div>
                  );
                }

                if (message.kind === 'preview') {
                  return (
                    <div key={message.id} className={rowSpacingClass}>
                      <BatchPreviewCard
                        message={message}
                        showSprite={showAssistantSprite}
                        onConfirm={handleConfirmBatch}
                        onCancel={handleCancelBatch}
                        onQuickReply={handleQuickReply}
                        saving={savingMessageId === message.id}
                      />
                    </div>
                  );
                }

                if (message.kind === 'receipt') {
                  return (
                    <div key={message.id} className={rowSpacingClass}>
                      <ReceiptBubble message={message} onQuickReply={handleQuickReply} />
                    </div>
                  );
                }

                const assistantMessage = {
                  id: message.id,
                  role: 'berde' as const,
                  kind: 'text' as const,
                  text: message.text,
                  spriteState: message.spriteState,
                  quickReplies: message.quickReplies,
                };

                return (
                  <div key={message.id} className={rowSpacingClass}>
                    <AssistantBubble
                      message={assistantMessage}
                      showSprite={showAssistantSprite}
                      onQuickReply={handleQuickReply}
                    />
                  </div>
                );
              })}
              <div ref={threadEndRef} />
            </div>
          </div>

          <div className="border-t border-[#dfe7e3] bg-white/90 px-3 py-3 backdrop-blur-sm sm:px-5 sm:py-4 lg:px-8 lg:py-5">
                <div className="mx-auto w-full max-w-none rounded-[24px] border border-zinc-200 bg-white p-3 shadow-[0_18px_36px_rgba(16,24,40,0.08)]">
              {(activeIntent?.stage === 'collecting_field' || activeIntent?.stage === 'awaiting_confirmation') ? (
                <div className="mb-2 hidden flex-wrap items-center gap-2 px-1 text-[11px] uppercase tracking-[0.16em] text-zinc-400 md:flex">
                  {activeIntent?.stage === 'collecting_field' ? (
                    <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                      Waiting on one missing detail
                    </span>
                  ) : null}
                  {activeIntent?.stage === 'awaiting_confirmation' ? (
                    <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                      Draft ready
                    </span>
                  ) : null}
                </div>
              ) : null}

              <div className="mb-2 flex items-center justify-end gap-2 px-1 md:hidden">
                {activeIntent?.stage === 'collecting_field' ? (
                  <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                    One detail left
                  </span>
                ) : null}
              </div>

              {activeIntent?.quickReplies && activeIntent.quickReplies.length > 0 && activeIntent.stage === 'collecting_field' ? (
                <div className="mb-2 flex flex-wrap gap-2 px-1">
                  {activeIntent.quickReplies.map((reply) => (
                    <button
                      key={`composer-${reply}`}
                      type="button"
                      onClick={() => handleQuickReply(reply)}
                      className="inline-flex items-center rounded-full border border-[#bfe7d9] bg-white px-3 py-1.5 text-xs font-medium text-[#0F6E56] transition-colors hover:bg-[#E1F5EE]"
                    >
                      {reply}
                    </button>
                  ))}
                </div>
              ) : null}

              {focusedAction ? (
                <div className="mb-3 rounded-2xl border border-[#cfe8dd] bg-[#f6fffb] px-3 py-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-700">
                      Item {focusedAction.index + 1} needs input
                    </span>
                    <span className="text-xs font-medium text-zinc-700">
                      {getActionFocusLabel(focusedAction.action)}
                    </span>
                  </div>
                  {focusedAction.total > 1 ? (
                    <p className="mt-1 text-xs leading-5 text-zinc-500">
                      Berde is only waiting on this one action. The other {focusedAction.total - 1} item{focusedAction.total - 1 === 1 ? '' : 's'} stay as parsed.
                    </p>
                  ) : null}
                </div>
              ) : null}

              <div className="flex items-end gap-2">
                <textarea
                  ref={composerRef}
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey && !savingMessageId) {
                      event.preventDefault();
                      submitMessage();
                    }
                  }}
                  rows={2}
                  placeholder="What happened today?"
                  className="min-h-[56px] flex-1 resize-none rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-[#1D9E75] dark:border-zinc-700 dark:bg-zinc-950 dark:text-white"
                />
                <button
                  type="button"
                  onClick={() => submitMessage()}
                  disabled={!input.trim() || Boolean(savingMessageId)}
                  className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[#0F6E56] text-white transition-colors hover:bg-[#0b5b47] disabled:cursor-not-allowed disabled:bg-zinc-300"
                  aria-label="Send message to Berde"
                >
                  <Send size={18} />
                </button>
              </div>

              <div className="mt-2 hidden items-center gap-2 px-1 text-xs text-zinc-500 md:flex">
                <Sparkles size={14} className="text-[#0F6E56]" />
                Rules first. No AI required for these common logging flows.
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
