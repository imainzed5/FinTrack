# Supabase Backend Setup (FinTrack)

This folder contains the initial PostgreSQL schema and design notes for migrating FinTrack from local JSON storage to Supabase.

## Files

1. `migrations/202603150001_initial_schema.sql`
- Full DDL for tables, constraints, indexes, triggers, and RLS.

2. `SCHEMA_DESIGN.md`
- Design rationale and field mapping from current TypeScript model.

## Step-by-step: apply schema in Supabase

1. Create a Supabase project.
2. Open SQL Editor in your Supabase dashboard.
3. Paste and run `migrations/202603150001_initial_schema.sql`.
4. Confirm tables exist in Table Editor:
- `profiles`
- `user_settings`
- `transactions`
- `transaction_splits`
- `budgets`
- `budget_threshold_alerts`
5. Verify RLS is enabled on all tables above.

## User Accounts And Multi-User Behavior

1. User accounts are managed by Supabase Auth in the built-in `auth.users` table.
2. The app-level profile row is linked 1:1 via `profiles.id -> auth.users.id`.
3. New signups auto-create `profiles` and `user_settings` rows through the `on_auth_user_created` trigger.
4. Row Level Security policies use `auth.uid()` so each user can only access their own rows.

## What Is Still Missing For Multi-User In The App

1. Signup/login/logout UI and session handling in Next.js.
2. Server route handlers that read authenticated user identity and query by that user.
3. Migration of current JSON-based storage code to Supabase-backed queries.
4. Optional admin flows (password reset templates, email verification, OAuth providers).

## Recommended next backend tasks

1. Add Supabase client setup in the app (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, service role key for server routes).
2. Replace JSON file I/O in `src/lib/db.ts` with SQL/Supabase queries.
3. Keep API response contracts unchanged while swapping internals.
4. Add data migration script from `data/transactions.json` and `data/budgets.json`.
5. Move receipt payloads from `attachment_base64` into Supabase Storage and retain `receipt_path` in DB.

## Notes

1. This schema assumes authenticated users via Supabase Auth and user-scoped data via `auth.uid()`.
2. If you want a temporary single-user mode before auth, use a server-side bypass with service role and a fixed `user_id` only in local/dev.
