import type {
  AccountType,
  Budget,
  ExternalWithdrawalStatus,
  RecurringFrequency,
  SavingsDepositInput,
  SavingsGoalStatus,
  Transaction,
} from '../types';

export interface TransactionSplitRow {
  id: string;
  category: Transaction['category'];
  sub_category: string | null;
  amount: number | string;
  created_at?: string;
}

export interface TransactionRow {
  id: string;
  user_id: string;
  amount: number | string;
  type: Transaction['type'] | null;
  category: Transaction['category'];
  sub_category: string | null;
  merchant: string | null;
  description: string;
  transaction_at: string;
  payment_method: Transaction['paymentMethod'];
  notes: string;
  tags: string[] | null;
  attachment_base64: string | null;
  savings_meta: Transaction['savingsMeta'] | null;
  recurring_frequency: RecurringFrequency | null;
  recurring_interval: number | null;
  recurring_next_run_at: string | null;
  recurring_end_at: string | null;
  recurring_origin_id: string | null;
  is_auto_generated: boolean;
  account_id?: string | null;
  transfer_group_id?: string | null;
  linked_transfer_group_id?: string | null;
  metadata?: Record<string, unknown> | null;
  synced: boolean;
  created_at: string;
  updated_at: string;
  transaction_splits?: TransactionSplitRow[] | null;
}

export interface AccountRow {
  id: string;
  user_id: string;
  name: string;
  type: AccountType;
  expense_payment_method?: Transaction['paymentMethod'] | null;
  initial_balance: number | string;
  color: string | null;
  icon: string | null;
  is_system_cash_wallet?: boolean | null;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface BudgetRow {
  id: string;
  user_id: string;
  budget_month: string;
  category: Budget['category'];
  sub_category: string | null;
  monthly_limit: number | string;
  rollover: boolean;
  alert_thresholds_triggered: number[] | null;
  created_at: string;
  updated_at: string;
}

export interface SavingsGoalRow {
  id: string;
  user_id: string;
  name: string;
  emoji: string;
  color_accent: string;
  tag: string | null;
  motivation_note: string | null;
  target_amount: number | string;
  current_amount: number | string;
  deadline: string | null;
  is_private: boolean;
  is_pinned: boolean;
  sort_order: number;
  status: SavingsGoalStatus;
  completed_at: string | null;
  what_did_you_buy: string | null;
  created_at: string;
  updated_at: string;
}

export interface SavingsDepositRow {
  id: string;
  goal_id: string;
  user_id: string;
  amount: number | string;
  type: SavingsDepositInput['type'];
  note: string | null;
  created_at: string;
}

export interface ExternalWithdrawalRequestRow {
  id: string;
  user_id: string;
  from_account_id: string;
  amount: number | string;
  fee_amount: number | string;
  net_amount: number | string;
  destination_summary: string;
  status: ExternalWithdrawalStatus;
  provider_ref: string | null;
  eta_at: string | null;
  idempotency_key: string;
  failure_reason: string | null;
  completed_transaction_id: string | null;
  metadata: Record<string, unknown> | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}
