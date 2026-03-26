# Moneda Project Memory — v0.10.0 (March 22, 2026)



## Purpose & Context

**Moneda** (formerly FinTrack) is a Filipino-focused personal finance PWA targeting freelancers, students, and fresh graduates. Built by a 3rd-year college student with firsthand understanding of student financial realities. Now live at **moneda-nine.vercel.app** and transitioned from personal tool to publicly shared product.

**Core values:**
- Clean, intuitive UX with emotional resonance
- Reliable performance and offline support
- Narrative-driven design (landing pages, UI storytelling matter as much as features)
- Student financial intelligence without jargon

**Tech stack:**
- **Frontend:** Next.js 16 (App Router), React 19, TypeScript 5, Tailwind CSS v4
- **Backend:** Supabase (Auth + PostgreSQL + RLS), custom SMTP via Resend
- **Data/Realtime:** IndexedDB (offline queue), WebSockets (via server.mjs for app updates), idb library
- **UI:** Chart.js 4.5, Lucide React icons, custom pixel-art Berde sprite
- **PWA:** Service Workers, Web App Manifest, installable on iOS/Android/desktop
- **Deployment:** Vercel (auto-deploy on push to main)

**Brand color:** #1D9E75 (emerald green)

---

## Current State (v0.10.0)

### ✅ Completed in this session (Dashboard & Transactions UI refinement)

**Berde Mascot System**
- Daily-seeded quote/message selection (deterministic per user per day via hash seed)
- Quote now surfaces on BerdeCard component with visual prominence
- Expanded message and quote pools across emotional states
- Added `transactionCount` to financial signal data for insight gating
- Berde appears on exactly **two dashboard cards only** (Budget Progress + Recent Transactions) to preserve emotional impact
- HiDPI canvas pixel-art rendering issue still pending fix (separate prompt queued)

**Insight Sufficiency Gating (v0.9.0)**
- `analyzeSpendingPatterns()` requires 5+ transactions AND ₱500+ monthly spend
- `detectSpendingSpikes()` requires 3+ transactions per category AND ₱300+ per category spend
- Supporting insights (`food_high`, `monday_spender`) gated by minimum transaction counts (5+, 8+)
- Budget/forecast/savings insights remain **ungated** (mathematical, not statistical)
- Prevents false positives on new accounts with sparse data
- Validated with thin-data simulation: 1-transaction account shows only budget/savings, no pattern insights

**Transactions Page Redesign (v0.10.0)**
- Moved `FilterDrawer` to React Portal (document.body) with mounted guard to escape sticky header stacking context
- Set FilterDrawer z-index to 9999 (clears FAB z-50 and bottom nav z-40)
- Updated FilterDrawer sheet background: CSS variables → explicit zinc classes for portal compatibility
- **Mobile header restructured:** separated Filters button into its own row below title/total amount
- Removed quick-add category button strip (simplified to FAB-only add flow)
- Reduced stat card typography to prevent wrapping on 3-column grid:
  - Values: `text-2xl` → `text-lg`
  - Labels: `text-xs` → `text-[10px] mb-0.5`
  - Sub-text: `text-xs mt-1` → `text-[10px] mt-0.5`
- FilterDrawer header: `h2` → `p`, improved close button styling, tightened border colors

**Calendar Panel Mobile Restructure (v0.10.0)**
- Changed mobile Calendar from bottom-sheet modal (fixed bottom-0, rounded-t-3xl, translate-y animation) to **inline full-block** (matches Statistics panel pattern)
- Removed overlay backdrop (bg-black/25) and bottom-sheet container entirely on mobile
- Kept all calendar content (`CalendarPanelContent`) unchanged
- Desktop aside version untouched
- Mobile and desktop now use consistent show/hide strategy

**Dashboard Visibility Fix (v0.10.0)**
- Fixed main section to hide on mobile when **either** Statistics OR Calendar panel opens
- Was only hiding for Statistics; now uses `isAnyPanelOpen` condition
- Prevents calendar panel from appearing at bottom of viewport

### Income & Dynamic Budget Boost
- ✅ Full implementation: income stored as `type: 'income'` transactions
- Supports one-time and recurring variants
- Overall budget dynamically boosted at runtime by income amount
- Green styling + Income badge in transaction list
- Post-additions: "Received via" payment method, notes fields
- Appears correctly in dashboard spendDays/totalSpent calculations

### Empty States & UI Consistency
- ✅ Implemented shared `EmptyState` component across Dashboard, Transactions, Insights, Timeline
- Uses Berde mascot sprite (`icon="berde"`) for financial/motivational context
- Falls back to Lucide icons for data-specific states
- Optional CTA buttons with action routing

### Mobile PWA Experience
- Safe-area insets properly applied (iOS home indicator padding)
- BottomNav floats at z-40 with `env(safe-area-inset-bottom)`
- FAB at z-50 with mobile-specific offset classes
- FilterDrawer portal at z-9999 to clear all stacking contexts
- Service Worker enabled for offline browsing

---

## Outstanding Items (as of v0.15.1)

### Immediate fixes (queued)
- **Berde HiDPI sprite rendering fix** — canvas pixel-art appears pixelated on retina displays (scaling via devicePixelRatio)
- **Financial Insights copy** — remove Berde name references for impersonal narrative (InsightCards.tsx, berde-messages.ts)

### Dashboard/UI Polish Sprint (deferred)
- Top stat row lacks actionability (expand popup removed)
- Budget Progress card needs more visual prominence
- Monthly Savings History empty space (layout exploration needed)

### Performance & Architecture
- **Server Component migration** — Dashboard, Insights, Timeline, Transactions planned
- **Supabase HTTP latency** — Auth middleware overhead on every request
  - Direct TCP via postgres.js + PgBouncer pooling (lowest effort)
  - Neon migration (cleanest, managed pooling)
- **WebSocket server** — not Vercel-compatible; Supabase realtime is fallback
- Monitoring: Vercel Analytics, Supabase logs (Sentry/PostHog deferred)

### Configuration & Setup
- Custom domain sender email for Resend (still onboarding@resend.dev)
- Admin dashboard deferred until Supabase dashboard is insufficient

---

## Other Notable Changes
- Category, income, and payment method constants expanded
- TypeScript, ESLint, and build process improvements
- Versioning and branching strictly enforced (see git-versioning.md)

---

## Key Learnings & Principles

**Berde Dilution Problem**
- Appearing on too many cards simultaneously reduces emotional impact
- **Solution:** Limit to max 2 cards (Budget Progress + Recent Transactions)
- Preserves anticipation and personality

**Supabase HTTP Latency**
- Auth middleware overhead on every request adds measurable delay
- **Lowest-effort fix:** Direct TCP connection via postgres.js with PgBouncer pooling
- **Cleanest fix:** Neon migration (managed pooling, db compatibility)

**TypeScript Deployment Gotchas**
- Tuple type inference errors on complex object arrays (can silently pass local tsc but fail CI)
- Component routing mistakes: `/app/dashboard/page.tsx` must call rendered Client Component, not render logic inline
- Verify after agent implementation: compile locally, check file structure, test on Vercel

**Gmail Email Compatibility**
- Modern CSS (flexbox, pseudo-elements, box-shadow, @import, <style> blocks) breaks in Gmail
- **Solution:** Table-based layouts with fully inlined styles
- Supabase template variables: `{{ .Email }}`, `{{ .ConfirmationURL }}` — never hardcode placeholders
- Test in Gmail + Outlook before release

**Narrative-Driven Design**
- Technical specs alone are insufficient for landing pages and UX copy
- Emotional framing and user storytelling are essential to retention
- Berde is a personality anchor, not just a visual element

**Portal Pattern for Stacking Context Escape**
- `backdrop-filter` on parent elements creates new stacking context
- `position: fixed` children inside are trapped by parent stacking context
- `createPortal(elem, document.body)` breaks the trap by moving DOM out of stacking context hierarchy
- z-index only matters relative to siblings in the same stacking context

---

## Workflow & Process

**Design → Implementation → Verification cycle:**
1. Claude designs mockup, writes scoped agent prompt with exact JSX/classes
2. Coding agent executes, reports change summary and exact code snippets
3. Claude reviews code snippets for correctness (file paths, TypeScript, logic)
4. Proceed or iterate based on verification

**UX prioritization:**
- **Immediate fixes:** User-facing bugs, copy errors, critical UX issues
- **Polish sprints:** Visual refinement, spacing, prominence, empty state handling
- **Architectural:** Performance fixes staged: lowest-effort first, then escalating migrations

**Version strategy:**
- `PATCH` (0.15.x): Small fixes, polish, copy changes
- `MINOR` (0.x.0): New feature batches merged to main
- `MAJOR` (x.0.0): Public launch, breaking redesigns
- Current: v0.15.1 (Debts, Berde expansion, UI/insight improvements)

---

## Quick Reference

### Project URLs
- **Live:** moneda-nine.vercel.app
- **GitHub:** github.com/imainzed5/FinTrack
- **Branches:** `dev` (active development), `main` (production)

### Key Commands
```bash
npm run dev          # Start dev server
npm run build        # Build for prod
npm run lint         # Run ESLint
npm run ws:server    # WebSocket server (local demo, not Vercel-compatible)
npx tsc --noEmit     # TypeScript check
npx supabase db push # Apply pending migrations
```

### Category Constants
- Expenses: Food, Transportation, Subscriptions, Utilities, Shopping, Entertainment, Health, Education, Miscellaneous
- Income: Freelance, Side Job, Salary, Part-time, Bonus, Refund, Gift, Other Income
- Payment Methods: Cash, Credit Card, Debit Card, GCash, Maya, Bank Transfer, Other

### CSS Token Colors
- Primary: `#1D9E75` (emerald green)
- Text variants: `text-zinc-900`, `text-zinc-700`, `text-zinc-500`, `text-zinc-400`
- Backgrounds: `bg-white`, `bg-zinc-50`, `bg-zinc-100`, `bg-zinc-900` (dark mode)
- Borders: `border-zinc-200`, `border-zinc-800` (dark mode)

---

## Next Steps (Prioritized)

1. **Fix Berde HiDPI sprite rendering** (prompt ready) → blocks visual polish
2. **Financial Insights copy cleanup** (remove Berde name references) → blocks insights page review
3. **Gather user feedback on v0.10.0 UI changes** → informs next design sprint
4. **Server Component migration** (Dashboard first) → performance gain, optional
5. **Supabase latency assessment** → may trigger postgres.js or Neon migration
6. **Dashboard polish sprint** (stat row actionability, Budget Progress prominence, Savings History) → deferred pending feedback

---

**Last updated:** March 26, 2026 (v0.15.1)
**Branches synced:** dev, main
**TypeScript status:** ✅ Passing (TS_EXIT:0)
**Vercel auto-deploy:** Active on main branch push
