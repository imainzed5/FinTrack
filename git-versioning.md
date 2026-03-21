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

### Current version: v0.7.9

---

## Version Roadmap

```
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
