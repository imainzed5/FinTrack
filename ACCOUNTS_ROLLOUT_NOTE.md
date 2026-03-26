# Accounts/Wallets Rollout Note

## What the migration changes
- Adds `public.accounts` with soft-archive support (`is_archived`) and metadata fields.
- Adds nullable `transactions.account_id` and `transactions.transfer_group_id`.
- Backfills all existing users with a default `Cash` account if none exists.
- Backfills all existing transactions to the user default `Cash` account.
- Adds `create_transfer` RPC for atomic two-row transfer creation linked by one `transfer_group_id`.
- Adds account ownership enforcement trigger on transactions (`account_id` must belong to the same `user_id`).
- Replaces signup bootstrap function so new users receive a default `Cash` account automatically.

## Runtime behavior after rollout
- Existing users keep historical data intact; balances become computed from:
  - `accounts.initial_balance`
  - plus signed transaction sums by account
- Transfers are now first-class and atomic via RPC only.
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
- Validate migrated users have one active `Cash` account at minimum.
- Confirm all pre-existing transaction rows have `account_id` populated.
- Validate transfer RPC creates exactly 2 linked rows or none on failure.
- Validate offline queue sync succeeds for records created before and after migration.

## Follow-up hardening ticket
- Ticket: `MON-ACCOUNTS-NULL-HARDENING`
- Scope: enforce `transactions.account_id NOT NULL` after production stability window and data audit.
