# git-versioning.md
# Moneda — Git Branching & Versioning Reference

This file defines the branching strategy, versioning rules, and daily workflow for the Moneda project. All agents and contributors must follow these conventions.

---

## Branch Structure

```
main   ← stable, always live on Vercel production
dev    ← active development, all work happens here
```

- **Never commit directly to `main`**
- All work goes to `dev` first
- `main` is only updated via a deliberate merge from `dev`
- Vercel auto-deploys to production when `main` is updated

---

## Daily Workflow

### Starting work
```bash
git checkout dev
```
Always confirm you're on `dev` before making any changes.

### Committing changes
```bash
git add .
git commit -m "feat: description of what you did"
git push origin dev
```

### Releasing to production (merging dev → main)
```bash
git checkout main
git merge dev --no-ff -m "release: v0.x.x — description of changes"
git tag -a v0.x.x -m "Moneda v0.x.x — description of changes"
git push origin main
git push origin v0.x.x
git checkout dev
```

---

## Commit Message Prefixes

| Prefix | When to use |
|---|---|
| `feat:` | New feature added |
| `fix:` | Bug fix |
| `chore:` | Non-feature work — cleanup, config, dependency updates |
| `wip:` | Work in progress, not finished yet — only push to `dev` |
| `release:` | Merge commit from `dev` → `main` |

### Examples
```
feat: add berde state merge system
fix: greeting truncation on mobile
chore: apply warm background across all pages
wip: statistics panel animation — exit not working yet
release: v0.7.1 — berde state merge, animation polish
```

---

## Versioning Rules


Moneda follows semantic versioning: `MAJOR.MINOR.PATCH`

| Segment | When to bump |
|---|---|

| `PATCH` (0.7.**x**) | Small fixes, polish, copy changes |
| `MINOR` (0.**x**.0) | New feature batch merged to main |
| `MAJOR` (**x**.0.0) | Public launch or breaking redesign |

### Current version: v0.28.2


---

## Version Roadmap
v0.28.2 - 2026-04-06
  - fix(berde): Align the Berde debt parser, preview, and save path so natural debt drafts like `Ana utang 500` and `utang kay Ana` complete correctly, stop looping on missing person details, and save without requiring a filler reason.
  - fix(berde): Clean up debt review cards in `src/components/pages/BerdeChatClientPage.tsx` by removing low-value debt scaffolding and suppressing fake debt reasons like echoed `Ana utang`.
  - fix(debts): Make debt reason optional across `src/lib/types.ts`, `src/lib/local-store.ts`, and `src/components/AddDebtModal.tsx` so Berde-created and manually edited debts stay type-safe and savable without a note.
  - test(berde): Add regression coverage in `src/lib/berde/chat-parser.test.ts` for Taglish debt creation, debt direction replies, optional debt notes, and multi-match settlement selection.
  - verification: `npm test`, `npm run lint`, and `npm run build` passed after the Berde debt save and parser refinement patch.

v0.28.1 - 2026-04-05
  - fix(berde): Stop debt follow-up loops in `src/lib/berde/chat-parser.ts` by treating missing-person and missing-debt replies as field-level answers instead of re-parsing them as fresh debt commands.
  - test(berde): Add debt follow-up regression coverage in `src/lib/berde/chat-parser.test.ts` for missing-person debt creation and debt-selection settlement flows.
  - verification: `npm test`, `npm run lint`, and `npm run build` passed after the Berde debt follow-up patch.

v0.28.0 — 2026-04-05
  - feat(berde): Add a dedicated `/berde` chat workspace with dashboard and drawer entry points, desktop sidebar placement, mobile chat-first layout, and session-persisted Berde conversation flow for quick natural-language logging.
  - feat(berde): Add a rule-first batched parser in `src/lib/berde/chat-parser.ts` and `src/lib/berde/chat.types.ts` for expense/income logs, transfers, savings moves, and debt actions, including multi-entry parsing, Taglish/local phrasing support, and conservative follow-up handling.
  - feat(berde): Add grouped preview cards, preview-first confirmation, smarter cancel handling, clearer save summaries, focused batch follow-up callouts, and responsive preview-card polish in `src/components/pages/BerdeChatClientPage.tsx`.
  - test(berde): Add parser regression coverage in `src/lib/berde/chat-parser.test.ts` for multi-action batches, typed follow-ups, local separators, and item-specific follow-up behavior.
  - verification: `npm test`, `npm run lint`, and `npm run build` passed after the Berde chat logging implementation and refinement pass.

v0.27.0 — 2026-04-02
  - feat(dashboard): Fix the dashboard Upcoming card in `src/lib/insights-engine.ts`, `src/lib/types.ts`, and `src/components/pages/DashboardClientPage.tsx` by exposing a dedicated `upcomingRecurringTransactions` payload so recurring templates due within 14 days are no longer hidden by current-month recent-transaction slicing.
  - feat(timeline): Make the Financial Timeline smarter in `src/lib/insights-engine.ts`, `src/lib/types.ts`, `src/components/TimelineView.tsx`, and `src/lib/timeline-events.test.ts` with predictive pacing events, income-aware context, savings-rate trend events, post-income behavior detection, and budget-recovery milestones.
  - feat(accounts): Add persisted account expense payment profiles across `src/components/accounts/AccountFormDialog.tsx`, `src/components/AddExpenseModal.tsx`, `src/lib/accounts-utils.ts`, `src/lib/local-store.ts`, `src/lib/db/accounts*.ts`, `src/app/api/accounts/route.ts`, and `supabase/migrations/202604020001_add_account_expense_payment_method.sql` so expense payment methods follow the selected account instead of relying on a conflicting manual field in the add-expense modal.
  - test(accounts): Extend `src/lib/accounts-utils.test.ts` and `src/lib/dashboard-history.test.ts` to cover account payment inference/profile behavior and the recurring-upcoming dashboard payload.
  - verification: `npm test` and `npm run lint` passed after the smarter timeline, upcoming-recurring dashboard fix, and account payment-profile update.

v0.26.0 — 2026-04-02
  - feat(dashboard): Add shared dashboard history in `src/lib/insights-engine.ts` and `src/lib/types.ts` so Berde and the calendar panel can use previous-month continuity plus multi-month calendar data without breaking current-month budget math.
  - feat(calendar): Update `src/components/dashboard/CalendarPanel.tsx` and `src/components/pages/DashboardClientPage.tsx` so the dashboard calendar can browse actual past-month spend data and selected-day transactions instead of reusing only current-month data.
  - feat(berde): Make dashboard Berde messaging trigger-aware in `src/lib/berde/berde.logic.ts`, `src/lib/berde/useBerdeInputs.ts`, `src/lib/berde/berde.types.ts`, and `src/lib/berde-messages.ts`, preventing false claims like “first transaction logged” on empty month-start dashboards while adding carry-over month context.
  - test(dashboard): Add regression coverage in `src/lib/dashboard-history.test.ts` and `src/lib/berde-dashboard.test.ts` for past-month calendar history, month-start Berde continuity, and false-positive message prevention.
  - verification: `npm test` and `npm run lint` passed after the dashboard history and smarter Berde messaging update.

v0.25.0 — 2026-04-01
  - feat(accounts): Add account-structure insights with a dedicated drawer in `src/components/accounts/AccountsClientPage.tsx`, backed by the new `src/lib/accounts-insights.ts` module and coverage in `src/lib/accounts-insights.test.ts`.
  - feat(transactions): Add desktop transaction preview support in `src/components/TransactionList.tsx`, `src/app/transactions/page.tsx`, and `src/components/pages/TransactionsClientPage.tsx` so previews are available beyond the mobile sheet flow.
  - feat(auth): Redesign the login, signup, forgot-password, and shared auth shell/components in `src/app/auth/**` and `src/components/auth/**` to use a quieter, form-first auth experience.
  - fix(auth): Clear account-linked local device data on logout and unauthenticated boot in `src/components/AppSessionProvider.tsx`, `src/components/Sidebar.tsx`, `src/components/AppShell.tsx`, and `src/components/settings/AccountSecuritySection.tsx` so account data is not still visible after sign-out.
  - fix(config): Validate `NEXT_PUBLIC_SUPABASE_URL` in `src/lib/supabase/config.ts` so site URLs fail fast instead of breaking auth with HTML responses.

v0.24.5 — 2026-03-31
  - fix(auth): Refresh the client app session immediately after a successful email/password sign-in in `src/app/auth/login/page.tsx`, so `AppShell` sees the authenticated state before route guards run and no longer bounces users back to the landing page.
  - fix(auth): Make the login request explicitly send cookies and replace to the destination route after the session refresh in `src/app/auth/login/page.tsx`, preventing repeat sign-in loops after a successful login.
  - verification: `npm run lint` and `npm run build` passed after the login redirect fix.

v0.24.4 — 2026-03-31
  - fix(sync): Stop sync-state-only backup events from triggering full dashboard, insights, timeline, savings, debts, accounts, and settings refetches by filtering those updates in the page-level realtime subscribers.
  - fix(sync): Reduce distracting cloud-refresh churn in `src/components/AppSessionProvider.tsx` by removing the visible-tab polling loop, throttling focus/realtime refresh attempts, and ignoring sync-state echoes when scheduling uploads.
  - chore(sync): Add reusable sync-state payload helpers in `src/lib/transaction-ws.ts` so local realtime listeners can distinguish metadata-only updates from actual content changes.
  - verification: `npm run lint` and `npm run build` passed after the realtime refresh optimization.

v0.24.3 — 2026-03-31
  - fix(sync): Derive transaction backup state from IndexedDB record metadata in `src/lib/local-store.ts` and `src/lib/local-first.ts`, so the Transactions list no longer shows stale `Pending` badges after backup has already completed.
  - fix(sync): Emit transaction and budget refresh events when snapshot sync state flips in `src/lib/local-store.ts`, so sync-state badges clear immediately after a successful backup.
  - test(sync): Add metadata-backed sync-state coverage in `src/lib/local-first.test.ts`.
  - verification: `npm test`, `npm run lint`, and `npm run build` passed after the pending badge fix.

v0.24.2 — 2026-03-31
  - fix(sync): Add strict instant cross-device cloud-backup refresh in `src/components/AppSessionProvider.tsx` by subscribing to `user_device_backups` realtime changes for the signed-in user instead of waiting only for focus or polling.
  - fix(sync): Suppress self-echo cloud refreshes after local backup writes in `src/components/AppSessionProvider.tsx`, so a device does not immediately re-pull its own snapshot after uploading.
  - chore(sync): Add `supabase/migrations/202603310001_enable_realtime_user_device_backups.sql` so `user_device_backups` participates in the `supabase_realtime` publication used by the live app.
  - test(sync): Extend `src/lib/local-first.test.ts` timestamp coverage used by the cloud freshness checks.
  - verification: `npm test`, `npm run lint`, and `npm run build` passed after the realtime cloud refresh update.

v0.24.1 — 2026-03-31
  - fix(sync): Stop `/api/cloud-sync/backup` from failing with an opaque 500 when backup storage is unavailable by surfacing an explicit unavailable state in `src/lib/cloud-sync-server.ts` and `src/app/api/cloud-sync/backup/route.ts`.
  - fix(sync): Keep cloud backup status truthful in `src/components/AppSessionProvider.tsx`, `src/lib/local-first.ts`, and `src/app/settings/page.tsx` so linked accounts no longer appear fully backed up when cloud writes are unavailable.
  - fix(settings): Simplify the Sync & Data card in `src/app/settings/page.tsx` with readable backup labels, last cloud backup time, clearer pending copy, and a separate alert state for backup errors.
  - test(sync): Add backup-mode coverage in `src/lib/local-first.test.ts`.
  - verification: `npm test`, `npm run lint`, and `npm run build` passed; applied pending Supabase migration `202603290001_add_user_device_backups.sql` to the remote database.

v0.24.0 — 2026-03-30
  - feat(auth): Add Google OAuth sign-in/sign-up across [src/app/auth/login/page.tsx](src/app/auth/login/page.tsx) and [src/app/auth/signup/page.tsx](src/app/auth/signup/page.tsx) with a reusable provider button in [src/components/auth/GoogleAuthButton.tsx](src/components/auth/GoogleAuthButton.tsx).
  - feat(auth): Add the Supabase OAuth code-exchange callback in [src/app/api/auth/callback/route.ts](src/app/api/auth/callback/route.ts) plus shared redirect/error helpers in [src/lib/auth-redirect.ts](src/lib/auth-redirect.ts).
  - fix(auth): Improve signup and resend verification failure handling in [src/app/api/auth/signup/route.ts](src/app/api/auth/signup/route.ts) and [src/app/api/auth/resend-verification/route.ts](src/app/api/auth/resend-verification/route.ts) for upstream confirmation-email delivery failures.
  - fix(profile): Normalize provider display names for Google-authenticated users in [src/lib/supabase/user-profile.ts](src/lib/supabase/user-profile.ts), [src/app/api/auth/session/route.ts](src/app/api/auth/session/route.ts), [src/app/api/auth/sessions/route.ts](src/app/api/auth/sessions/route.ts), and [src/lib/cloud-sync-server.ts](src/lib/cloud-sync-server.ts).
  - verification: `npm run build` passed after the auth reliability and Google OAuth implementation.

v0.23.4 — 2026-03-30
  - fix(charts): Register the missing Chart.js controllers in `src/components/Charts.tsx`, resolving the runtime `"bar" is not a registered controller` failure for dashboard and statistics visualizations.
  - fix(theme): Migrate older saved `moneda-theme=system` fallback values to light in `src/components/ThemeProvider.tsx`, so existing clients now align with the new default light preference.
  - verification: `npm run build` passed after the chart registry and theme-preference migration patch.

v0.23.3 — 2026-03-30
  - fix(theme): Change the default appearance preference to light in `src/components/ThemeProvider.tsx`, so fresh installs and missing saved preferences no longer fall back to system theme.
  - verification: `npm run build` passed after the theme-default patch.

v0.23.2 — 2026-03-30
  - fix(build): Resolve the production TypeScript failure in `src/components/EditTransactionModal.tsx` by aligning edit-modal split updates with the concrete `TransactionSplit` type expected by local transaction updates.
  - fix(import): Replace an unsafe `DeviceProfile` cast in `src/lib/local-first.ts` with explicit snapshot normalization so imported local backups pass strict production type-checking.
  - verification: `npm run build` passed after the build-fix patch.

v0.23.1 — 2026-03-29
  - fix(modals): Correct the FAB add expense/income sheet in `src/components/AddExpenseModal.tsx` so it opens in a compact state, expands only when optional sections are enabled, and resets cleanly after close/reopen.
  - fix(modals): Move long mobile modal content into a dedicated internal scroll region in both `src/components/AddExpenseModal.tsx` and `src/components/EditTransactionModal.tsx`, keeping hidden inputs reachable when recurring, split, and more-options sections are expanded.
  - fix(css): Strengthen shared modal scrolling behavior in `src/app/globals.css` for flex-based touch sheets.
  - verification: `npm run lint` passed after the modal height, reset, and scrolling fixes.

v0.23.0 — 2026-03-29
  - feat(onboarding): Replace the single-screen local onboarding form with a checkpoint-based Berde setup flow at [src/app/onboarding/page.tsx](src/app/onboarding/page.tsx), including step navigation, backtracking, and an editable final review before device creation.
  - feat(onboarding): Add onboarding draft persistence with local resume support so in-progress setup survives refreshes and returns the user to the correct checkpoint.
  - feat(ux): Redesign onboarding into a desktop-first 30/70 layout with a left checkpoint rail, a focused setup panel, compact Berde presence, and reduced storytelling copy to keep account creation fast.
  - feat(currency): Replace the generic currency icon with currency-specific symbols in onboarding selection cards and review controls.
  - verification: `npm run lint` passed after the onboarding flow and layout updates.

v0.22.0 — 2026-03-29
  - feat(local-first): Convert Moneda to device-first access with a shared `AppSessionProvider`, local onboarding at `/onboarding`, local-first route gating in `AppShell`, and viewer-aware sidebar/auth flows so the app works without sign-in.
  - feat(storage): Add IndexedDB-backed app data via `src/lib/local-store.ts` and local-first snapshot contracts in `src/lib/local-first.ts`; migrate dashboard, transactions, insights, timeline, accounts, savings, debts, settings, and shared dialogs away from auth-gated `/api/*` reads for primary local use.
  - feat(sync): Add optional cloud backup/sync infrastructure with explicit device-vs-cloud conflict resolution (`CloudSyncDecisionDialog.tsx`), cloud backup routes/server helpers, and the `user_device_backups` Supabase migration. No silent merge path exists in this version.
  - feat(settings): Expand Settings for local-first lifecycle management with full device backup/export coverage, safer restore preview + destructive acknowledgement, duplicate month-option fix, and a local device data wipe action for deleting the device profile and stored financial data.
  - fix(auth/ux): Keep signup/login reachable for local-only users, clarify auth and landing copy around optional accounts, and prevent Berde from surfacing premature pattern thoughts on fresh device data.
  - verification: `npm run lint` passed after the local-first migration, settings/import safety work, and local-data deletion/auth redirect fixes.

v0.21.0 — 2026-03-28
  - feat(refactor): Modularized the `src/lib/db` implementation into a focused package of modules; `src/lib/db.ts` is now a 49-line compatibility barrel exporting the implementation.
  - refactor(db): Broke the previous 1913-line `db.ts` into modules: `shared.ts`, `rows.ts`, `selects.ts`, `normalizers.ts`, `mappers.ts`, `transactions.ts`, `recurring.ts`, `accounts.ts`, `budgets.ts`, `savings.ts`, `withdrawals.ts`, and `timeline.ts`.
  - chore(internal): Added small internal support modules to avoid circular deps: `client.ts`, `accounts-core.ts`, and `transaction-helpers.ts`.
  - feat(details): Transaction CRUD and payload helpers moved to `transactions.ts`; recurring processing and `processRecurringTransactions` moved to `recurring.ts`; accounts, balances, archive/default account resolution, cash-wallet flag, and transfers moved to `accounts.ts`; budget CRUD and alert persistence to `budgets.ts`; savings goals and deposit logic to `savings.ts`; external withdrawal request logic to `withdrawals.ts`.
  - verification: `npx tsc --noEmit` passed; `npx eslint src/lib/db.ts src/lib/db/*.ts` passed. Repo-wide `npm run lint` still blocked by unrelated pre-existing issues.
  - follow-up: Consider renaming `accounts-core.ts` / `transaction-helpers.ts` for clarity and adding focused tests around recurring processing and savings side effects.
  - Files updated/added: `src/lib/db.ts`, `src/lib/db/*` (new modular files)

v0.20.0 — 2026-03-28
  - feat(transactions): Transaction cards & mobile sheet improvements — redesigned transaction cards into a cleaner, reference-inspired mobile layout; switched cards to a softer white surface (replacing the warmer paper tint); added a mobile timeline gutter with dots and connecting rail beside grouped transaction rows; grouped date headers now show a relative/weekday label with the full date underneath; the category line now shows only the main category (no subcategory); mobile long-press opens a details sheet with a minimal slide/fade open-close animation; the sheet stack level is set above the FAB and it only renders optional rows (subcategory, details, notes, tags, recurring, sync status) when present; removed the helper sentence from the sheet header; raised transaction delete confirmation modals above the FAB. `eslint` and `tsc --noEmit` pass.
  - Files updated: src/components/TransactionList.tsx, src/app/transactions/page.tsx, src/components/pages/TransactionsClientPage.tsx

v0.19.0 — 2026-03-28
  - feat: Settings workspace redesign, Accounts active-first, and appearance theme system: redesigned Settings into a workspace (desktop: category sidebar + focused detail pane; mobile: summary-first with warm bottom sheet; budgets, payday, sync/data, and appearance regrouped under clearer hierarchy — mobile sheet flow at page.tsx lines 891 and 1319); AccountsSection now shows active accounts by default with archived hidden behind a disclosure, uses existing add/edit/adjust dialogs, and labels archive actions as "Archive"/"Restore" (AccountsSection.tsx lines 189, 469); Appearance supports System/Light/Dark via `ThemeProvider` (ThemeProvider.tsx line 6).
  - Files updated: src/app/settings/page.tsx (lines 891, 1319), src/components/AccountsSection.tsx (lines 189, 469), src/components/ThemeProvider.tsx (line 6)

v0.18.1 — 2026-03-28
  - patch: Restore warm Savings canvas and apply warm app shell background: restored the Savings warm canvas in SavingsClientPage (line 404) and pushed the same `#f8f7f2` warm background into the authenticated `AppShell` (lines 103 and 313), so in-app pages now inherit the warm Savings-style canvas instead of the cooler white/zinc page background.
  - Files updated: src/components/pages/SavingsClientPage.tsx (line 404), src/components/AppShell.tsx (lines 103, 313)

v0.18.0 — 2026-03-28
  - feat: Rework withdraws to a transfer-ledger model and add stable cash-wallet support: introduce `is_system_cash_wallet` flag and helper; add a `withdraw` mode to the transfer modal (cash / internal / external), withdraw balance preview, `Withdraw all`, and Record-as-expense handoff into the expense modal; include transfer validation and balance checks for withdraw paths.
  - feat: Transaction & server updates: add transaction `metadata` and linked `transfer-group` support; add external withdrawal requests with pending/completed/failed lifecycle and API routes; updated migrations and server RPCs for transfers/withdrawals.
  - perf/analytics: Exclude transfer/adjustment rows from spend analytics by default and add a `Real spending only / Include transfers & adjustments` toggle that affects both the stat cards and the visible Transactions list; align export summaries with current filtered view; improve transaction row labels and defensive filtering (dashboard recent transactions and RecentTransactions component).
  - ux/mobile: Mobile Transactions & Dashboard refinements — smaller FAB, list-first Transactions layout, slimmed mobile header, compact filter/transfer action row, horizontally scrollable tabs, hidden large analytics card on mobile, horizontal stat scroller, full-width search, expanded filter drawer (spend-view toggle, month picker, filters, export), and extra bottom spacing to avoid FAB/bottom-nav overlap.
  - chore: Added shared operational-transaction classifier (`transaction-classification.ts` line 12) and documentation updates for withdraw semantics and external-withdraw flow.

v0.17.2 — 2026-03-28
  - feat: Accounts — Account detail client page for `/accounts/[id]` wired to real APIs; added Balance & This Month stats, Deposit/Withdraw/Transfer/Adjust actions, grouped transaction history, not-found + skeleton UI.
  - Files updated: `src/components/accounts/AccountDetailClientPage.tsx`

v0.17.1 — 2026-03-28
  - fix: Accounts hero — added a dedicated skeleton state for the Accounts hero card to prevent a fallback Berde state while accounts load.
  - Files updated: `src/components/accounts/AccountsClientPage.tsx`

v0.17.0 — 2026-03-28
  - feat: Accounts — redesigned Accounts list and Account detail screens (list + detail + forms + adjust dialog).
  - List screen: net worth hero from account balances, visibility toggle persisted via `moneda_nw_visible`, local filter chips, two-column responsive grid, archived section, and navigation to account detail on card tap.
  - Detail screen: account-backed stats from `/api/accounts`, This Month computed from `/api/transactions` scoped to the account, account-scoped transaction history, edit/archive actions, and account balance adjust dialog.
  - Files added/updated: `src/app/accounts/page.tsx`, `src/app/accounts/[id]/page.tsx`, `src/components/accounts/AccountsClientPage.tsx`, `src/components/accounts/AccountDetailClientPage.tsx`, `src/components/accounts/AccountFormDialog.tsx`, `src/components/accounts/AccountAdjustDialog.tsx`, `src/hooks/useNetWorthVisibility.ts`
v0.16.1 — 2026-03-27
  - fix: Exclude income and manual balance adjustments from insights "spend-by-day" and "This month at a glance" calculations.
  - Files updated: `src/app/insights/page.tsx`, `src/components/pages/InsightsClientPage.tsx`
v0.16.0 ✓ Accounts/Wallets feature, budget/account decoupling, dedicated Accounts page, UI/UX polish
  - Implemented full Accounts/Wallets system: accounts table, account-linked transactions, transfer support, and manual adjustment.
  - Decoupled budgets from account balances: budgets now operate independently of account balances, no more "income boost" logic.
  - Clarified expense deduction flow: all expenses require explicit account selection, and deduction is always from the chosen account.
  - Added dedicated /accounts page (sidebar Plan section) for account management, history, and analytics.
  - Improved account management: signed currency display, starting balance, manual adjustment, delete-as-archive, and transfer modal.
  - UI/UX polish: dashboard stat tiles, modals, and widgets now reflect budget/account separation; clearer labels and validation in Add/Edit/Transfer modals.
  - Compatibility fallback: legacy schema support for missing account_id column.
  - All tests and build passing after changes.
  - Files updated: migrations, db.ts, types.ts, insights-engine.ts, indexeddb.ts, API routes, dashboard/settings/accounts/transactions UI, modal components, tests, and more.
v0.15.1 ✓ TransactionList icon color fix
  - Transaction category icons in the transactions page now use category-based color (not all green)
  - Matches dashboard/category color logic for visual consistency
  - Files updated: TransactionList.tsx
v0.15.0 ✓ Berde message pool & rotation expansion
  - Expanded Berde message pools for Debts, Savings, and Settings pages
  - Centralized all page/state message pools in src/lib/berde/page-messages.ts
  - Improved daily-seeded message rotation logic for more variety and accuracy
  - No message flash on initial load (skeleton loader until data ready)
  - Server userId now used for first-render message seeding
  - Files updated: page-messages.ts, DebtsPanel, SavingsClientPage, SettingsPage, berde.logic, berde.types
v0.14.0 ✓ Berde contextual mascot integration
  - Berde mascot now appears on Debts, Savings, and Settings pages with context-aware moods and tips
  - New Berde sprite states: motivational, celebratory, helper, excited
  - Each page uses a state resolver to select Berde's mood and message based on live data
  - EmptyState for debts now uses Berde mascot
  - No breaking changes; all new features are additive
  - Files updated: DebtsPanel, SavingsClientPage, SettingsPage, BerdeSprite, berde.types, berde.logic, berde-messages
  - Added Supabase debts table migration with RLS policies and optimized indexes
  - Added new debts API endpoints for create, update, settle, and delete actions
  - Added Debts & Splits dedicated page and Sidebar navigation entry (BottomNav unchanged)
  - Added Debts tab inside Transactions page
  - Implemented Add/Edit debt sheet using shared modal layout for consistent UX
  - Added delete confirmation modal for both active and settled debt entries
  - Active debts now support edit, settle, and delete actions for misinputs
  - Files updated: migrations, debts API/data layer, DebtsPanel, AddDebtModal, Sidebar, transactions page, types
v0.13.0 ✓ Debts & Splits ledger with edit/delete and confirmation flows
v0.12.1 ✓ Transactions page skeleton loader fix
  - Refined TransactionsSkeleton to only render transaction-list placeholders, removing duplicate stats/sidebar/search blocks
  - Loader now matches the actual loading region, preventing double UI and layout jump
  - Files updated: SkeletonLoaders.tsx
v0.12.0 ✓ InsightCard hero redesign and visual enhancement
  - Redesigned InsightCard layout with hero-number prominence: 3px accent bar → title label → large hero value → secondary message → supporting body
  - Implemented getAccentColor() system: accent bar color reflects insight severity and state (green/amber/red/gray)
  - Split payload rendering into renderHero() and renderCardBody() functions for clean visual hierarchy
  - Added LockedInsightCard component for gated insight display with tier badge and progress tracking
  - Enhanced currency formatting: Added fmtCurrency() helper (₱ + 2 decimals) for financial hero values (biggest_expense, avg_transaction_size)
  - Implemented 15 complete insight type renderings with specialized hero display and body support data
  - Grid improvements: 2-column layout with conditional full-width cards based on FULL_WIDTH_TYPES and pool size
  - Safe date parsing: Timezone-aware largest_expense date extraction via substring + manual Date constructor
  - Sub-component library: TwoStat, MiniBarChart, SegmentBar, Badge for composable card body rendering
  - Files updated: InsightCards.tsx, LockedInsightCard.tsx, insights/page.tsx, insights-engine.ts, types.ts
v0.11.1 ✓ PWA login flow and z-index fixes
  - Updated manifest.json start_url from "/" to "/login" for PWA home screen launch
  - Added new /login route that checks session on mount and redirects authenticated users to /dashboard
  - Uses router.replace() to prevent login page appearing in back-history
  - Fixed savings goals card z-index: bumped from z-50 to z-[51] to appear above FAB when expanded
  - Files updated: public/manifest.json, src/app/login/page.tsx, src/components/dashboard/SavingsGoalsDashboardCard.tsx
v0.11.0 ✓ Transaction modal redesign and input validation
  - Redesigned AddExpenseModal to card-stack UI layout with collapsible More Options
  - Redesigned EditTransactionModal to match AddExpenseModal card-stack design
  - Added numeric-only input validation with real-time sanitization for amount fields
  - Implemented delete transaction functionality in EditTransactionModal with confirmation dialog
  - Added emoji icon grids for category selection (5-column layout)
  - Preserved all existing state management, API behavior, and validation logic
  - Files updated: AddExpenseModal.tsx, EditTransactionModal.tsx
v0.10.0 ✓ Dashboard and Transactions UI refinement
  - Moved FilterDrawer to React Portal (document.body) with mounted guard to escape sticky header stacking context
  - Changed FilterDrawer z-index to 9999 to properly overlay FAB (z-50) and bottom nav (z-40)
  - Updated FilterDrawer sheet background from CSS variables to explicit zinc classes for portal compatibility
  - Redesigned mobile transactions header: separated Filters button into its own row below title/total
  - Replaced quick-add category buttons with simplified add flow (FAB only)
  - Reduced stat card typography: values text-2xl → text-lg, labels/sub-text to text-[10px] to prevent wrapping on 3-column grid
  - Changed Calendar panel mobile view from bottom-sheet modal to inline full-block (matches Statistics panel pattern)
  - Fixed dashboard main section visibility: now hides on mobile when either Statistics or Calendar panel opens (was only hiding for Statistics)
  - Updated FilterDrawer header: changed h2 → p, improved close button styling, tightened border color classes
  - Files updated: FilterDrawer.tsx, transactions/page.tsx, CalendarPanel.tsx, DashboardClientPage.tsx
v0.9.0  ✓ Berde insight data sufficiency thresholds
  - Gate analyzeSpendingPatterns() with minimum 5+ transactions and ₱500+ spending for the month
  - Gate detectSpendingSpikes() with minimum 3+ transactions per category and ₱300+ per category spend
  - Gate food_high supporting insight with minimum 5+ total transactions (prevents "food dominance" on sparse data)
  - Gate monday_spender supporting insight with minimum 8+ total transactions (prevents "Monday bias" pattern on thin data)
  - Leave forecast_good, forecast_bad, bill_due, savings_good, savings_bad checks ungated (budget math, not pattern detection)
  - Add transactionCount field to BerdeSignalData to track total expense transaction count for gating decisions
  - Verified with thin-data simulation: 1-transaction account shows only budget/forecast/savings insights, not pattern insights
  - Prevents premature insight generation on new accounts (fresh graduates, early adopters) until sufficient data exists
  - Files updated: src/lib/berde-messages.ts, src/lib/insights-engine.ts
v0.8.0  ✓ Calendar layout restructure + Spent Today display consistency
  - Restructured CalendarPanel expanded state into top row (stats + day detail) + full-width bottom (calendar heatmap)
  - Stats grid (2x2) and day detail panel displayed side-by-side in top row with border separator
  - Calendar heatmap + legend moved to full-width bottom section
  - Collapsed state layout unchanged (vertical flex layout with all sections stacked)
  - Fixed "Spent Today" stat card and modal to count only expense transactions (excludes savings deposits/income)
  - Updated spentToday calculation in DashboardClientPage.tsx to filter type === 'expense'
  - Updated SpentTodayPopup to filter for expense-only transactions and apply transaction-aware sign formatting
  - Removed hardcoded negative sign in modal amount display; now uses transaction.type to determine +/- prefix
  - Files updated: CalendarPanel.tsx, DashboardClientPage.tsx, SpentTodayPopup.tsx
v0.7.9  ✓ Savings transaction rendering on dashboard and deposit metadata
  - Set merchant to goal name in addSavingsDeposit() for correct display in transaction list
  - Add description field with deposit/withdrawal context
  - Patch RecentTransactions component with savings palette detection and rendering
  - Display goal name in category badge for savings transactions
  - Show +/- prefix for deposits/withdrawals with appropriate colors (emerald/amber)
  - Files updated: db.ts, RecentTransactions.tsx
v0.7.8  ✓ Calendar panel fixes: transaction data mismatch, desktop overflow clipping, mobile nav visibility
  - Fixed drill-down showing "No spend this day" on colored days in CalendarPanel
  - Added currentMonthTransactions field to DashboardData (full current-month transaction list, not capped at 5)
  - Updated CalendarPanel.tsx: Filters selectedDayTransactions from full month data instead of recentTransactions
  - Critical fix: Added overflow-x-hidden to desktop panel content to prevent horizontal spill in 560px expanded view
  - Mobile UX: Hide BottomNav when calendar or statistics panel is open via body.panel-open CSS class
  - Fixed React setState warning: Removed onExpandChange callback that updated parent during child render
  - Parent now reads calendar expanded state from localStorage when panel opens (async, no child-parent coupling)
  - Files updated: types.ts, insights-engine.ts, CalendarPanel.tsx, DashboardClientPage.tsx, BottomNav.tsx, globals.css, dashboard/page.tsx
  - New doc: ISSUES_ANALYSIS.md with bug analysis and solutions
v0.7.7  ✓ Calendar heatmap data source fix + desktop expand/collapse
  - Fixed calendar heatmap to use full-month date-keyed calendarSpending instead of 7-day dailySpending
  - Added calendarSpending field to DashboardData containing all current-month transactions grouped by ISO date (yyyy-MM-dd)
  - Added desktop expand/collapse toggle for CalendarPanel (340px default ↔ 560px expanded)
  - Expanded state persists via localStorage (key: moneda-calendar-expanded)
  - Two-column layout at 560px: left heatmap column (280px fixed) + right detail column (flex-1)
  - FAB offset syncs dynamically: 340px+24px when closed/narrow, 560px+24px when expanded
  - Mobile bottom-sheet unaffected by expand state (forced isExpanded={false} for mobile render)
  - New files: CalendarPanel.tsx (extracted from DashboardClientPage), CALENDAR_PANEL_DESIGN.md
  - Updated types: Added calendarSpending to DashboardData interface
  - Updated insights-engine: Compute full-month calendar spending in buildDashboardData()
v0.7.6  ✓ Category emoji → Lucide icons in SpentThisMonthPopup
  - Replaced category emojis with Lucide icons (UtensilsCrossed, Car, ShoppingBag, Heart, etc.)
  - Icons render in small green circles (28px, #e8f7f2 background, #1D9E75 icon color)
  - Icon size normalized to 14px across all categories with consistent strokeWidth=2
v0.7.5  ✓ Dashboard popup safe-area padding + FAB shortcut stack cleanup
  - Added explicit bottom sheet safe-area padding using calc(env(safe-area-inset-bottom) + 28px)
  - Removed the "Your top picks" label above the FAB category shortcut stack for cleaner spacing
v0.7.4  ✓ Scroll-aware FAB hide/show on Transactions page (IntersectionObserver, fade, pointer-events)
  - FAB now fades out when pagination controls are visible and fades in when not, preventing overlap on mobile
  - Uses IntersectionObserver and a new visible prop on FloatingAddButton
v0.7.2  ✓ Session UI grouping, badges, show-more toggles
  - Active Sessions now grouped by device type (iOS, Android, Windows, Mac, Other)
  - Session cards show age badges (Active now, Today, X days ago, Inactive 7+ days)
  - Local IP flagged with badge
  - Per-group show-more toggles (max 3 visible by default)
  - Current session card and revoke/logout controls unchanged
  - Recent Login Activity section removed (redundant)
v0.7.3  ✓ Landing page narrative update (student story, Filipino origin, narrative-driven design)
  - "Why Moneda exists" section now includes developer's student story and narrative-driven design context
  - Highlights Moneda's Filipino roots and mission for everyday clarity
v0.9.0  — Pre-launch polish, performance, testing
v1.0.0  — Public launch
```

---

## [dev] 2026-03-24
- Patch: Sidebar redesign (grouped sections, 56px width), floating BottomNav restored, AppShell offset updated to sm:ml-56.
- No breaking changes. TypeScript clean.
- See commit 8289974 (feat(nav): sidebar sectioned nav, floating mobile nav, and 56px offset (patch))

---

## Tagging a Release

```
v0.13.0 ✓ Debts & Splits ledger with edit/delete and confirmation flows
  - Added Supabase debts table migration with RLS policies and optimized indexes
  - Added new debts API endpoints for create, update, settle, and delete actions
  - Added Debts & Splits dedicated page and Sidebar navigation entry (BottomNav unchanged)
  - Added Debts tab inside Transactions page
  - Implemented Add/Edit debt sheet using shared modal layout for consistent UX
  - Added delete confirmation modal for both active and settled debt entries
  - Active debts now support edit, settle, and delete actions for misinputs
  - Files updated: migrations, debts API/data layer, DebtsPanel, AddDebtModal, Sidebar, transactions page, types
v0.12.1 ✓ Transactions page skeleton loader fix
  - Refined TransactionsSkeleton to only render transaction-list placeholders, removing duplicate stats/sidebar/search blocks
```
```

---

## Vercel Deployment

- **Production branch:** `main`
- **Preview deployments:** `dev` (separate preview URL on every push, does not affect production)
- Vercel auto-deploys to production only when `main` is updated via a merge

---

## Quick Reference Card

```bash
# Start working
git checkout dev

# Save progress
git add .
git commit -m "feat: what you did"
git push origin dev

# Release to production
git checkout main
git merge dev --no-ff -m "release: v0.x.x — description"
git tag -a v0.x.x -m "Moneda v0.x.x — description"
git push origin main
git push origin v0.x.x
git checkout dev
```
