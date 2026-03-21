---
name: "expense-tracker"
description: "Complete system skill for Moneda—personal financial intelligence dashboard built with Next.js, Supabase, React, and TypeScript. Covers architecture, patterns, workflows, and domain knowledge."
metadata:
  tags: ["expense-tracker", "fintech", "nextjs", "supabase", "pwa", "financial-intelligence"]
---

# Moneda System Skill

**Current Version:** v0.9.0 (March 22, 2026)  
**Status:** Active development on `dev` branch; production-ready on `main`

## System Overview

Moneda is a PWA-based personal financial intelligence dashboard that helps freelancers, fresh graduates, and families track expenses, detect spending patterns, and gain clarity on financial decisions. Built with **Next.js 16**, **React 19**, **TypeScript**, **Supabase**, and **Tailwind CSS 4**.

**Key Features:**
- Real-time expense tracking with category and sub-category breakdown.
- Budget management with monthly limits and rollover support.
- **Data-driven financial insights** with intelligence gating to prevent false positives on sparse data (5+ transactions minimum for pattern detection, 3+ per category for spike detection).
- Spending trend analysis (calendar heatmap, weekly/daily trends, savings history) with interactive drill-down.
- Recurring transaction templates and transaction splits for shared expenses.
- Berde emotional AI mascot with state-driven messaging and daily-seeded quote rotation.
- Savings goals tracking with deposit/withdrawal transactions.
- Offline-first architecture using IndexedDB for pending transactions.
- Session tracking and secure authentication with Supabase Auth.
- PWA installable on iOS, Android, and desktop browsers.
- WebSocket support for real-time app updates across tabs/devices.

---

## Tech Stack

### Core Framework
- **Next.js 16.1.6** (App Router)
- **React 19.2.3** + **React DOM 19.2.3**
- **TypeScript 5**
- **Tailwind CSS 4**

### Backend & Data
- **Supabase** (Auth + PostgreSQL)
  - Server-side client: `@supabase/ssr@^0.9.0`
  - JS SDK: `@supabase/supabase-js@^2.99.1`
  - CLI: `supabase@^2.78.1` (dev)
- **IndexedDB** (via `idb@^8.0.3`) for offline queue

### UI & Visualization
- **Lucide React** (icons)
- **Chart.js 4.5.1** + **react-chartjs-2 5.3.1** (charts)
- **date-fns 4.1.0** (date formatting)

### Realtime & Networking
- **WebSocket** (`ws@^8.19.0`)
- `@types/ws@^8.18.1` (dev)

### Build & Tooling
- **ESLint 9** with `eslint-config-next`
- **babel-plugin-react-compiler 1.0.0** (React optimization)
- **UUID 13.0.0** (ID generation)

### Environment
- Node.js version: 18+ recommended
- Package manager: npm

---

## Architecture

### Data Flow Pattern

**Current Architecture:** Full Client-Side Fetching via useEffect

1. **Client Components** (all pages use `'use client'`) render immediately.
2. **useEffect hooks** fetch data from API routes after mount (with loading skeleton).
3. **API Routes** (`/api/*`) validate auth and query Supabase.
4. **Supabase** provides auth, database, and session tracking.
5. **WebSocket subscriptions** (`transaction-ws.ts`) refresh data on real-time updates from other tabs/devices.
6. **IndexedDB** queues transactions when offline; synced on reconnect.

### File Structure

```
src/
  app/
    api/                    # Server-side API routes (auth & data queries)
      auth/                 # Auth endpoints (login, signup, consent, sessions)
      dashboard/route.ts    # Dashboard data (processes recurring txns)
      transactions/route.ts # Transaction CRUD with auth checks
      budgets/route.ts      # Budget CRUD
      insights/route.ts     # Computed insights
      savings/route.ts      # Savings history
      timeline/route.ts     # Timeline events
      sync/route.ts         # Offline transaction queue sync
    dashboard/page.tsx      # Client Component (fetches in useEffect)
    insights/page.tsx       # Client Component
    timeline/page.tsx       # Client Component
    transactions/page.tsx   # Client Component (with search, filters, modals)
    settings/page.tsx       # Client Component (budgets first, theme toggle)
    auth/
      login/page.tsx        # Client Component
      signup/page.tsx       # Client Component
      forgot-password/page.tsx
      terms/page.tsx
      privacy/page.tsx
  components/
    EmptyState.tsx          # Shared empty-state UI (Berde mascot or Lucide icon)
    AddExpenseModal.tsx     # Add transaction modal
    EditTransactionModal.tsx# Edit transaction modal
    Charts.tsx              # CategoryPieChart, WeeklySpendingChart, etc.
    DashboardWidgets.tsx    # StatsCards, BudgetProgress
    InsightCards.tsx        # Insight card list
    TransactionList.tsx     # Transaction list with swipe actions
    TimelineView.tsx        # Timeline event list
    FloatingAddButton.tsx   # FAB for adding transactions
    BottomNav.tsx           # Floating island bottom navigation
    ThemeProvider.tsx       # Dark/light mode context
    ServiceWorkerRegistration.tsx
    berde/
      BerdeCard.tsx         # Berde mascot with state & quote
      BerdeSprite.tsx       # Pixel-art Berde sprite (canvas-based)
      useBerdeInputs.ts     # Hook to compute Berde state from data
      berde.logic.ts        # State & quote logic
      berde.types.ts        # Berde type definitions
    auth/
      AuthCardShell.tsx
      AuthTextField.tsx
      AuthPasswordField.tsx
    pages/
      DashboardClientPage.tsx    # (deprecated; logic moved to dashboard/page.tsx)
      InsightsClientPage.tsx
      TimelineClientPage.tsx
      TransactionsClientPage.tsx
    settings/
      AccountSecuritySection.tsx
  lib/
    db.ts                   # Server-side DB queries (called from API routes)
    types.ts                # Shared TypeScript types (Transaction, Budget, etc.)
    utils.ts                # Utilities (formatCurrency, etc.)
    supabase/
      client.ts             # Browser Supabase client (limited anon)
      server.ts             # Server Supabase client (full access)
      config.ts             # Runtime config
      auth-state.ts         # Auth state & cookie helpers
    transaction-ws.ts       # WebSocket client for real-time app updates
    indexeddb.ts            # Offline queue (pending transactions)
    auth-session-tracking.ts # Session tracking (device, browser, OS, IP)
    auth-contract.ts        # Auth payload/response types
    policy.ts               # Consent policy checks
    useScrollbarVisibility.ts # Custom scrollbar hook
public/
  manifest.json             # PWA manifest
  sw.js                     # Service Worker (offline & caching)
  icons/
    icon-192.png
    icon-512.png
supabase/
  migrations/               # PostgreSQL migrations (schema, RLS, functions)
  config.toml
ws-server/
  server.mjs                # WebSocket server for real-time updates (optional demo)
  example-client.mjs        # WebSocket client example
```

### Key Libraries & Functions

#### Database Layer (`src/lib/db.ts`)
- **`getTransactions()`** – Fetch all user transactions.
- **`getBudgets()`** – Fetch monthly budgets.
- **`saveBudgets()`** – Update budgets.
- **`upsertTransaction()`** – Create or update transaction with splits.
- **`processRecurringTransactions()`** – Generate recurring txn instances.
- **Server-side only** – Uses `requireSupabaseUser()` for auth.

#### Insight Generation (`src/lib/insights-engine.ts` & `src/lib/berde-messages.ts`)
- **`analyzeSpendingPatterns()`** – Day-of-week analysis; gated at 5+ transactions and ₱500+ monthly spend.
- **`detectSpendingSpikes()`** – Category spike detection; gated at 3+ transactions per category and ₱300+ category spend.
- **`getBerdeInsightsForMood()`** – Generate Berde insight cards with mood-driven message pools.
- **`buildSignalData()`** – Compute financial signal data (budget, spending, streaks, patterns) for insight gating.
- **Supporting insight gates:**
  - `food_high`: Requires 5+ total transactions (prevents false food-dominance on sparse data)
  - `monday_spender`: Requires 8+ total transactions (prevents day-of-week bias on thin data)
  - Budget/forecast/savings checks: **Ungated** (budget math, not pattern detection)

#### Supabase Helpers (`src/lib/supabase/`)
- **`createSupabaseServerClient()`** – Server-side Supabase client with cookie handling.
- **`requireSupabaseUser()`** – Auth guard; throws `AuthRequiredError` if not authenticated.
- **`getSupabaseBrowserClient()`** – Limited browser client (anon key).

#### Types (`src/lib/types.ts`)
```typescript
export const CATEGORIES = [
  'Food', 'Transportation', 'Subscriptions', 'Utilities', 'Shopping',
  'Entertainment', 'Health', 'Education', 'Miscellaneous'
] as const;
export type Category = (typeof CATEGORIES)[number];

export type TransactionType = 'expense' | 'income';

export type IncomeCategory = 
  | 'Freelance' | 'Side Job' | 'Salary' | 'Part-time' | 'Bonus' | 'Refund' | 'Gift' | 'Other Income';

export type PaymentMethod = 'Cash' | 'Credit Card' | 'Debit Card' | 'GCash' | 'Maya' | 'Bank Transfer' | 'Other';

export interface RecurringConfig {
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  interval: number;
  nextRunDate: string; // ISO
  endDate?: string; // ISO
}

export interface TransactionSplit {
  id: string;
  category: Category;
  subCategory?: string;
  amount: number;
}

export interface Transaction {
  id: string;
  amount: number;
  type: TransactionType; // 'expense' or 'income'
  incomeCategory?: IncomeCategory; // For income transactions
  category: Category;
  subCategory?: string;
  merchant?: string;
  description?: string;
  date: string; // ISO
  paymentMethod: PaymentMethod;
  notes?: string;
  tags?: string[];
  attachmentBase64?: string;
  split?: TransactionSplit[]; // For shared expenses
  recurring?: RecurringConfig;
  recurringOriginId?: string;
  isAutoGenerated?: boolean; // For recurring instances
  synced?: boolean; // Offline sync status
  createdAt: string;
  updatedAt: string;
}

export interface Budget {
  id: string;
  category: Category | 'Overall';
  subCategory?: string;
  monthlyLimit: number;
  month: string; // 'YYYY-MM'
  rollover?: boolean;
  alertThresholdsTriggered?: number[];
}

export interface TimelineEvent {
  id: string;
  eventType: 'started_tracking' | 'subscription_detected' | 'spending_spike' | 
             'highest_savings' | 'budget_exceeded' | 'milestone' | 
             'spending_improvement' | 'savings_streak' | 'savings_milestone' | 
             'best_savings_rate' | 'low_spend_month';
  description: string;
  date: string; // ISO
  metadata: Record<string, unknown>;
  context?: string; // Explanation
  advice?: string; // Recommendation
}

export interface DashboardData {
  totalSpentThisMonth: number;
  totalSpentLastMonth: number;
  remainingBudget: number;
  monthlyBudget: number;
  savingsRate: number;
  expenseGrowthRate: number;
  budgetStatuses: BudgetStatus[];
  budgetAlerts: BudgetThresholdAlert[];
  categoryBreakdown: { category: string; amount: number }[];
  weeklySpending: { week: string; amount: number }[];
  dailySpending: { day: string; amount: number }[];
  recentTransactions: Transaction[];
  insights: Insight[];
}
```

---

## Patterns & Conventions

### Client Component Data Fetching Pattern
```typescript
// src/app/dashboard/page.tsx (Client Component)
'use client';
import { useEffect, useState, useCallback } from 'react';
import type { DashboardData } from '@/lib/types';

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard');
      const json = await res.json();
      setData(json);
    } catch (err) {
      // Offline or error
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchDashboard();
  }, [fetchDashboard]);

  // WebSocket real-time updates
  useEffect(() => {
    const unsubscribe = subscribeAppUpdates(() => {
      void fetchDashboard();
    });
    return unsubscribe;
  }, [fetchDashboard]);

  if (loading) return <DashboardSkeleton />;

  return (
    <>
      <main>{/* Render data */}</main>
      <FloatingAddButton onClick={() => setShowAddModal(true)} />
      <AddExpenseModal open={showAddModal} onClose={() => setShowAddModal(false)} onAdded={() => fetchDashboard()} />
    </>
  );
}
```

### EmptyState Component (Shared UI)
```typescript
// Any empty data condition → use EmptyState component
import EmptyState from '@/components/EmptyState';

// Example 1: Berde mascot (icon='berde')
if (budgets.length === 0) {
  return (
    <EmptyState
      icon="berde"
      headline="No budget set yet."
      subtext="Berde can't guard what doesn't exist."
      cta={{
        label: 'Set a Budget',
        action: 'go-to-settings'
      }}
    />
  );
}

// Example 2: Lucide icon + modal handler
if (transactions.length === 0) {
  return (
    <EmptyState
      icon={TrendingUp}
      headline="No transactions yet."
      subtext="Berde's waiting. Add your first one."
      cta={{
        label: 'Add Transaction',
        action: 'add-transaction'
      }}
      onAddTransaction={handleAddClick}
    />
  );
}

// Example 3: No CTA
if (insights.length === 0) {
  return (
    <EmptyState
      icon="berde"
      headline="Berde's still studying your habits."
      subtext="Log a few more transactions and insights will start appearing."
    />
  );
}
```

### API Route Pattern
```typescript
// src/app/api/dashboard/route.ts
import { NextResponse } from 'next/server';
import { getTransactions, getBudgets, processRecurringTransactions } from '@/lib/db';
import { isAuthRequiredError } from '@/lib/supabase/server';

export async function GET() {
  try {
    await processRecurringTransactions(); // Heavy work
    const transactions = await getTransactions();
    const budgets = await getBudgets();
    const dashboard = buildDashboardData(transactions, budgets);
    return NextResponse.json(dashboard);
  } catch (error) {
    if (isAuthRequiredError(error)) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to load dashboard.' }, { status: 500 });
  }
}
```

### Authentication & Authorization
- **Supabase Auth** handles sign-up, login, password reset, and session state.
- **RLS (Row-Level Security)** enforces user data isolation at database level.
- **Session tracking** via `auth-session-tracking.ts` logs login device, browser, OS, IP.
- **Consent policies** require terms & privacy acceptance before first use.

### Offline & Sync
- **IndexedDB** queues pending transactions when offline.
- **Service Worker** enables offline browsing and push notifications.
- **Sync endpoint** (`/api/sync`) pushes pending txns when online again.
- **WebSocket subscriptions** (`transaction-ws.ts`) listen for real-time app updates.

### State Management
- **Server state** – Fetched on each request (no caching by default).
- **Client state** – `useState` for UI (modals, filters, pagination).
- **Browser storage** – localStorage for user preferences, sessionStorage for filters.
- **IndexedDB** – Offline transaction queue.

---

## Navigation & Routes

### Public Routes (No Auth)
- `/` – Landing/home page
- `/auth/login` – Login form
- `/auth/signup` – Sign-up form
- `/auth/forgot-password` – Password reset
- `/auth/terms` – Terms of Service
- `/auth/privacy` – Privacy Policy

### Authenticated Routes (Auth Required)
- `/dashboard` – Main dashboard (default after login)
- `/transactions` – Transaction list with search & filters
- `/insights` – Financial insights and patterns
- `/timeline` – Spending timeline view
- `/settings` – Budget management (first in order), account, data export/import

### API Routes
- `/api/auth/*` – Auth endpoints (login, signup, logout, sessions, consent)
- `/api/dashboard` – Dashboard data
- `/api/transactions` – CRUD for transactions
- `/api/budgets` – CRUD for budgets
- `/api/insights` – Computed insights
- `/api/savings` – Savings history
- `/api/timeline` – Timeline data
- `/api/sync` – Offline sync

---

## Performance & PWA Considerations

### iOS PWA Safe-Area
When installed on iOS home screen, the app adds bottom safe-area inset for the home indicator.
- Applied in `globals.css`: `.mobile-nav-offset` and `.mobile-fab-offset` utilities.
- Floating Action Button and bottom nav use `calc(navHeight + env(safe-area-inset-bottom))`.

### Manifest & Icons
- **manifest.json** – PWA manifest with branding colors, icon references, standalone mode.
- **Icons** – 192x192px and 512x512px PNG icons with maskable purpose for app stores.
- **Status bar color** – Configurable via `appleWebApp.statusBarStyle` in layout.tsx.

### Mobile Viewport
- `viewport-fit: cover` allows content to extend into safe areas.
- `initial-scale=1` prevents auto-zoom on input focus.

---

## UI Components Reference

### EmptyState Component
- **File:** `src/components/EmptyState.tsx`
- **Usage:** Shared component for all empty data states
- **Props:**
  - `icon: LucideIcon | 'berde'` – Lucide icon component or 'berde' for mascot sprite
  - `headline: string` – Main message
  - `subtext: string` – Supporting message
  - `cta?: { label, action }` – Call-to-action button. Actions: 'add-transaction' | 'go-to-settings' | 'clear-filters'
  - `onAddTransaction?: () => void` – Handler for 'add-transaction' action
  - `onClearFilters?: () => void` – Handler for 'clear-filters' action
  - Renders BerdeSprite (mascot) when `icon='berde'`

### BerdeCard Component
- **File:** `src/components/berde/BerdeCard.tsx`
- **Usage:** Dashboard mascot card with emotional state and quote
- **Props:**
  - `inputs: BerdeInputs` – Data to compute Berde's state (budget %, transactions, etc.)
  - `className?: string`
- **States:** neutral, proud, worried, hype, sarcastic (based on financial conditions)

### SaldaIsland Component
- **File:** `src/components/SaldaIsland.tsx`
- **Usage:** Floating island mascot in bottom-right corner of landing page
- **Props:**
  - `section: 'hero' | 'why' | 'features' | 'how'` – Active landing page section
- **Features:** Section-reactive expressions (neutral, wise, smile, proud), conditional island extras (tree, coin, flag), speech bubble per section
- **Animation:** Idle bob via CSS keyframes, fade-in on section crossfade
- **Mobile:** Hidden below 375px width
- **Rendering:** Pure inline SVG, no external assets

### SaldaObserver Component
- **File:** `src/components/SaldaObserver.tsx`
- **Usage:** Client component wrapping SaldaIsland on landing page
- **Purpose:** Tracks active section via IntersectionObserver, updates Salda's state on scroll
- **Configuration:** `threshold: 0.6`, `rootMargin: '0px 0px -40% 0px'` for correct initial section activation
- **Mounted:** As final child in LandingPage component

### Bottom Navigation
- **File:** `src/components/BottomNav.tsx`
- **Design:** Floating island at bottom of screen with home indicator safe-area on iOS
- **Routes:** Dashboard, Transactions, Insights, Timeline, Settings
- **Mobile-first:** Responsive, includes safe-area inset

## Development Workflows

### Running the App
```bash
npm run dev      # Start Next.js dev server on :3000
npm run build    # Build for production
npm run start    # Run production server
npm run lint     # Run ESLint
npm run ws:server # Start WebSocket server (optional, for real-time updates)
npm run ws:client-example # Run WebSocket client demo
```

### Database Migrations
```bash
npx supabase migration list       # List migrations
npx supabase db push --yes        # Push pending migrations (non-interactive)
```

### Creating a New Expense
1. User clicks "+ Transaction" (FAB at bottom right).
2. `AddExpenseModal` opens (with type selector: expense or income).
3. For **expense:** select category, sub-category, amount, payment method, date, notes.
4. For **income:** select income category, amount, payment method, date, notes.
5. (Optional) Add transaction split or mark as recurring.
6. Form submitted → `POST /api/transactions`.
7. API validates, calls `db.upsertTransaction()`.
8. Supabase RLS enforces user_id isolation and inserts row.
9. WebSocket notifies subscribed clients (other tabs/devices).
10. All subscribed pages (dashboard, transactions, insights, timeline) auto-refresh.

### Managing Budgets
1. Navigate to **Settings** (bottom nav).
2. **Budget Management section is first** – encourages upfront financial planning.
3. Select month (YYYY-MM), category or 'Overall', sub-category (optional), limit, and rollover toggle.
4. Submit → `POST /api/budgets`.
5. Budget saved; dashboard immediately shows budget progress bars and alerts.
6. **Overall budget:** If income transactions exist, boosts the budget by income amount (tracked in `incomeBoost` field).

### Data Export & Import
- **Export:** Settings → "Data Management" → "Export JSON Backup" → downloads all transactions & budgets as JSON.
- **Import:** Settings → "Import JSON Backup" → select JSON file → bulk-inserts transactions & budgets server-side.
- Used for data migration or backup restore.

### Offline Support
- **Pending transactions:** Queued in IndexedDB when offline.
- **Sync:** Auto-syncs when back online via `/api/sync`.
- **Indicators:** Online/offline status shown in Settings.
- **Service Worker:** Enables offline browsing and caches app shell.

---

## Common Issues & Solutions

### Pattern Insights Showing on Sparse Data (Fixed in v0.9.0)
- **Status:** Fixed. Insight gates prevent statistical false positives on new accounts.
- **Solution:** Added minimum data thresholds—analyzeSpendingPatterns requires 5+ transactions and ₱500+ monthly spend; detectSpendingSpikes requires 3+ per category and ₱300+ per category; food_high and monday_spender require 5+ and 8+ total transactions respectively. Budget/forecast/savings insights remain ungated (budget math, not pattern detection).

### Data Not Refreshing After Transaction Added (Fixed in v0.7.1)
- **Status:** Fixed. WebSocket subscription and fetch hook are now reliable.
- **Solution:** Implemented: `onAdded` callback calls `fetchDashboard()` in AddExpenseModal. WebSocket connection auto-refreshes dashboard.


### EmptyState Showing App Icon Instead of Berde (Fixed in v0.7.1)
- **Status:** Fixed. EmptyState now renders BerdeSprite for `icon="berde"`.
- **Solution:** Implemented: Correct icon prop and BerdeSprite import in EmptyState.tsx.


### Income Transactions Not Showing Payment Method (Fixed in v0.7.1)
- **Status:** Fixed. Payment method selector is visible for income transactions.
- **Solution:** Implemented: AddExpenseModal shows payment method options for `type='income'`.


### Offline Transactions Not Syncing (Fixed in v0.7.1)
- **Status:** Fixed. Offline queue sync is reliable.
- **Solution:** Implemented: IndexedDB queue flushes and `/api/sync` responds when network is restored.


### iOS App Not Showing Safe-Area Padding (Fixed in v0.7.1)
- **Status:** Fixed. Safe-area padding is applied correctly.
- **Solution:** Implemented: BottomNav uses `env(safe-area-inset-bottom)` and viewport-fit=cover is set.


### Berde State Not Changing (Fixed in v0.7.1)
- **Status:** Fixed. Berde state updates as expected.
- **Solution:** Implemented: useBerdeInputs receives updated data after transaction add; Berde state reflects budget usage, transaction count, savings rate, expense growth.

---

## Key Insights

1. **Client-first architecture** – All pages use 'use client' with data fetching in useEffect + skeleton loaders.
2. **API routes as security layer** – Centralize auth checks (`requireSupabaseUser()`) and Supabase queries in `/api/*` routes.
3. **RLS enforces data isolation** – Database Row-Level Security prevents unauthorized user data access even if API is compromised.
4. **WebSocket real-time sync** – Multiple tabs/devices stay in sync via subscriptions; auto-refetch on app updates.
5. **Shared EmptyState component** – Centralized empty-state UI (Berde mascot or Lucide icon) with optional CTA actions.
6. **Offline-first IndexedDB** – Transactions queued locally; auto-sync via `/api/sync` when reconnected.
7. **Settings prioritization** – Budgets section first (before account settings) encourages upfront financial planning.
8. **Income transactions** – Separate transaction type with dynamic budget boost when Overall budget exists.
9. **Berde emotional intelligence** – Mascot state changes based on financial data (proud if saving, worried if over-budget).
10. **PWA experience** – iOS safe-area insets, installable manifest, Service Worker offline support, HiDPI pixel-art Berde sprite.
11. **Data sufficiency gating** – Insights only fire when statistical thresholds are met; prevents premature pattern claims on fresh accounts (critical for user trust with new users).

---

## Quick Commands

| Task | Command |
|------|---------|
| Start dev | `npm run dev` |
| Build | `npm run build` |
| Lint | `npm run lint` |
| Format date | `format(date, 'PPP')` from date-fns |
| Format currency | `formatCurrency(amount)` from utils |
| Fetch transactions (server-side) | `getTransactions()` from lib/db.ts |
| Fetch transactions (client) | `fetch('/api/transactions')` then `response.json()` |
| Auth check in API route | `await requireSupabaseUser()` from lib/supabase/server.ts |
| WebSocket app updates | `subscribeAppUpdates(callback)` from lib/transaction-ws.ts |
| WebSocket budget updates | `subscribeBudgetUpdates(callback)` from lib/transaction-ws.ts |
| WebSocket transactions | `subscribeTransactionUpdates(callback)` from lib/transaction-ws.ts |
| Check offline queue | `getPendingTransactions()` from lib/indexeddb.ts |
| Push offline txns | `syncPendingTransactions()` from lib/indexeddb.ts |
| Render EmptyState | `<EmptyState icon="berde" headline="..." subtext="..." />` from components/EmptyState.tsx |
| Convert transaction date | `parseISO(transaction.date)` for Date object |
| Check if income | `transaction.type === 'income'` |

---

## References

- **Next.js Docs:** https://nextjs.org/docs (App Router, Client Components)
- **Supabase Docs:** https://supabase.com/docs (Auth, PostgreSQL, RLS)
- **React Docs:** https://react.dev (Hooks, Client Components)
- **Tailwind CSS:** https://tailwindcss.com (Utility-first styling)
- **Chart.js:** https://www.chartjs.org (Data visualization)
- **date-fns:** https://date-fns.org (Date manipulation)
- **Lucide React:** https://lucide.dev (Icon components)
