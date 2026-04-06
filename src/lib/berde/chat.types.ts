import type {
  Account,
  Category,
  Debt,
  DebtDirection,
  IncomeCategory,
  PaymentMethod,
  SavingsDepositType,
  SavingsGoal,
  Transaction,
  TransactionInput,
} from '@/lib/types';

export type BerdeChatIntentKind = 'action_batch' | 'ambiguous' | 'unsupported' | 'confirm';

export type BerdeChatConfidenceLabel = 'low' | 'medium' | 'high';

export type BerdeActionMissingField =
  | 'amount'
  | 'type'
  | 'category'
  | 'incomeCategory'
  | 'fromAccount'
  | 'toAccount'
  | 'goal'
  | 'savingsType'
  | 'direction'
  | 'person'
  | 'reason'
  | 'debt';

export type BerdeDraftStage = 'collecting_field' | 'awaiting_confirmation' | 'unsupported';

interface BerdeActionBase {
  id: string;
  date: string;
  sourceText: string;
}

export interface BerdeTransactionAction extends BerdeActionBase {
  kind: 'transaction';
  entryType?: Extract<TransactionInput['type'], 'expense' | 'income'>;
  amount?: number;
  category?: Category;
  description?: string;
  merchant?: string;
  accountId?: string;
  accountName?: string;
  paymentMethod?: PaymentMethod;
  incomeCategory?: IncomeCategory;
}

export interface BerdeTransferAction extends BerdeActionBase {
  kind: 'transfer';
  amount?: number;
  fromAccountId?: string;
  fromAccountName?: string;
  toAccountId?: string;
  toAccountName?: string;
  notes?: string;
}

export interface BerdeSavingsAction extends BerdeActionBase {
  kind: 'savings';
  amount?: number;
  savingsType?: SavingsDepositType;
  goalId?: string;
  goalName?: string;
  note?: string;
}

export interface BerdeDebtAction extends BerdeActionBase {
  kind: 'debt';
  debtMode?: 'create' | 'settle';
  settlementType?: 'full' | 'partial';
  debtId?: string;
  debtCandidateIds?: string[];
  personName?: string;
  direction?: DebtDirection;
  directionSource?: 'explicit' | 'inferred';
  amount?: number;
  remainingAmount?: number;
  reason?: string;
}

export type BerdeParsedAction =
  | BerdeTransactionAction
  | BerdeTransferAction
  | BerdeSavingsAction
  | BerdeDebtAction;

export interface BerdeParsedActionBatch {
  actions: BerdeParsedAction[];
  focusActionIndex?: number;
}

export interface BerdeChatIntent {
  kind: BerdeChatIntentKind;
  stage: BerdeDraftStage;
  confidence: number;
  confidenceLabel: BerdeChatConfidenceLabel;
  missingFields: BerdeActionMissingField[];
  expectedField?: BerdeActionMissingField;
  ambiguityReason?: string;
  quickReplies?: string[];
  batch?: BerdeParsedActionBatch;
}

export interface BerdeChatResponse {
  intent: BerdeChatIntent;
  replyText: string;
}

export interface BerdeChatParserContext {
  accounts: Account[];
  savingsGoals?: SavingsGoal[];
  debts?: Debt[];
  recentTransactions?: Transaction[];
  pendingBatch?: BerdeParsedActionBatch | null;
  pendingIntent?: BerdeChatIntent | null;
  now?: Date;
}

export interface BerdeInterpretationProvider {
  parse(message: string, context: BerdeChatParserContext): BerdeChatResponse;
}
