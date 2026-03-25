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

### Current version: v0.13.0

---

## Version Roadmap


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

```bash
git tag -a v0.x.x -m "Moneda v0.x.x — description"
git push origin v0.x.x
```

### View all tags
```bash
git tag
```

### View tag details
```bash
git show v0.7.0
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
