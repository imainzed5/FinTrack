export const TRANSACTION_SELECT = `
  id,
  user_id,
  amount,
  type,
  category,
  sub_category,
  merchant,
  description,
  transaction_at,
  payment_method,
  notes,
  tags,
  attachment_base64,
  savings_meta,
  recurring_frequency,
  recurring_interval,
  recurring_next_run_at,
  recurring_end_at,
  recurring_origin_id,
  is_auto_generated,
  account_id,
  transfer_group_id,
  linked_transfer_group_id,
  metadata,
  synced,
  created_at,
  updated_at,
  transaction_splits (
    id,
    category,
    sub_category,
    amount,
    created_at
  )
`;

export const LEGACY_TRANSACTION_SELECT = `
  id,
  user_id,
  amount,
  type,
  category,
  sub_category,
  merchant,
  description,
  transaction_at,
  payment_method,
  notes,
  tags,
  attachment_base64,
  savings_meta,
  recurring_frequency,
  recurring_interval,
  recurring_next_run_at,
  recurring_end_at,
  recurring_origin_id,
  is_auto_generated,
  synced,
  created_at,
  updated_at,
  transaction_splits (
    id,
    category,
    sub_category,
    amount,
    created_at
  )
`;

export const ACCOUNT_SELECT = `
  id,
  user_id,
  name,
  type,
  initial_balance,
  color,
  icon,
  is_system_cash_wallet,
  is_archived,
  created_at,
  updated_at
`;

export const LEGACY_ACCOUNT_SELECT = `
  id,
  user_id,
  name,
  type,
  initial_balance,
  color,
  icon,
  is_archived,
  created_at,
  updated_at
`;

export const BUDGET_SELECT = `
  id,
  user_id,
  budget_month,
  category,
  sub_category,
  monthly_limit,
  rollover,
  alert_thresholds_triggered,
  created_at,
  updated_at
`;

export const SAVINGS_GOAL_SELECT = `
  id,
  user_id,
  name,
  emoji,
  color_accent,
  tag,
  motivation_note,
  target_amount,
  current_amount,
  deadline,
  is_private,
  is_pinned,
  sort_order,
  status,
  completed_at,
  what_did_you_buy,
  created_at,
  updated_at
`;

export const SAVINGS_DEPOSIT_SELECT = `
  id,
  goal_id,
  user_id,
  amount,
  type,
  note,
  created_at
`;

export const EXTERNAL_WITHDRAWAL_REQUEST_SELECT = `
  id,
  user_id,
  from_account_id,
  amount,
  fee_amount,
  net_amount,
  destination_summary,
  status,
  provider_ref,
  eta_at,
  idempotency_key,
  failure_reason,
  completed_transaction_id,
  metadata,
  created_by,
  created_at,
  updated_at
`;
