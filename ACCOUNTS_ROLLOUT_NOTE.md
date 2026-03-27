# Accounts/Wallets Rollout Note

## What the migration changes
- Adds `public.accounts` with soft-archive support (`is_archived`) and metadata fields.
- Adds `accounts.is_system_cash_wallet` so the default Cash wallet is explicit instead of name-based.
- Adds nullable `transactions.account_id` and `transactions.transfer_group_id`.
- Adds `transactions.metadata` and `transactions.linked_transfer_group_id` for withdraw intent and reconciliation.
- Backfills all existing users with a default `Cash` account if none exists.
- Backfills all existing transactions to the user default `Cash` account.
- Adds `create_transfer` RPC for atomic two-row transfer creation linked by one `transfer_group_id`.
- Updates transfer creation so withdraw-to-cash uses transfer rows and balance checks instead of creating an expense.
- Adds `external_withdrawal_requests` so external payouts can remain pending until completion.
- Adds account ownership enforcement trigger on transactions (`account_id` must belong to the same `user_id`).
- Replaces signup bootstrap function so new users receive a default `Cash` account automatically.

## Runtime behavior after rollout
- Existing users keep historical data intact; balances become computed from:
  - `accounts.initial_balance`
  - plus signed transaction sums by account
- Transfers are now first-class and atomic via RPC only.
- Withdraw to Cash remains a transfer, not a spending event. Spend reporting continues to exclude rows with `transfer_group_id`.
- Completed external withdrawals are posted as linked non-spend ledger debits after confirmation, while pending requests do not change balances.
- Account deletion remains soft-only through archive/restore workflows.
- Transactions without explicit `accountId` resolve to the user default active account.

## Rollback considerations
- This migration introduces new table/columns and function contracts consumed by API/UI.
- Rolling back code without rolling back DB is generally safe (new columns are additive).
- Rolling back DB after code deploy is not recommended without a controlled maintenance window because:
  - code paths expect `create_transfer` RPC to exist
  - code may write `account_id` and `transfer_group_id`
- If emergency rollback is required:
  1. Disable transfer endpoint traffic.
  2. Deploy previous app version.
  3. Keep DB schema additive changes in place (preferred).

## Post-release verification checklist
- Validate migrated users have one active system Cash wallet at minimum.
- Confirm all pre-existing transaction rows have `account_id` populated.
- Validate transfer RPC creates exactly 2 linked rows or none on failure.
- Validate withdraw-to-cash labels and balance guards work from the account detail page.
- Validate pending external payout creation does not change balances until the request is completed.
- Validate offline queue sync succeeds for records created before and after migration.

## Follow-up hardening ticket
- Ticket: `MON-ACCOUNTS-NULL-HARDENING`
- Scope: enforce `transactions.account_id NOT NULL` after production stability window and data audit.
