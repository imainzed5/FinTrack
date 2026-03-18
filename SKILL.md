---
name: "Moneda Expense Tracker System"
description: "Complete system skill for Moneda—personal financial intelligence dashboard built with Next.js, Supabase, React, and TypeScript. Covers architecture, patterns, workflows, and domain knowledge."
version: "1.0"
tags: ["expense-tracker", "fintech", "nextjs", "supabase", "pwa", "financial-intelligence"]
---

# Moneda System Skill

## System Overview

Moneda is a PWA-based personal financial intelligence dashboard that helps freelancers, fresh graduates, and families track expenses, detect spending patterns, and gain clarity on financial decisions. Built with **Next.js 16**, **React 19**, **TypeScript**, **Supabase**, and **Tailwind CSS 4**.

**Key Features:**
- Real-time expense tracking with category and sub-category breakdown.
- Budget management with monthly limits and rollover support.
- Financial insights and spending trend analysis (pie charts, weekly/daily trends, savings history).
- Recurring transaction templates and transaction splits for shared expenses.
- Offline-first architecture using IndexedDB for pending transactions.
- Session tracking and secure authentication with Supabase Auth.
- PWA installable on iOS, Android, and desktop browsers.
- WebSocket support for real-time app updates.

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

**Problem:** Client-side data fetching in useEffect causes slow first paint.  
**Current Solution:** Hybrid Server/Client Components (migration in progress).

1. **Server Components** render initial data on the server.
2. **Client Components** (small, focused) handle interactivity (modals, live updates, filters).
3. **API Routes** (`/api/*`) fetch data from Supabase on behalf of clients.
4. **Supabase** provides auth, database, and session tracking.

### File Structure

```
src/
  app/
    api/                    # Server-side API routes (fetch from Supabase)
      auth/                 # Auth endpoints (login, signup, consent, sessions)
      dashboard/route.ts    # Dashboard data (processes recurring txns)
      transactions/route.ts # Transaction queries with auth checks
      budgets/route.ts
      insights/route.ts
      savings/route.ts
      timeline/route.ts
      ...
    dashboard/page.tsx      # Server Component → fetches via lib/db
    insights/page.tsx
    timeline/page.tsx
    transactions/page.tsx
    settings/page.tsx       # Budget management (first in order)
    auth/
      login/page.tsx        # Client Component
      signup/page.tsx       # Client Component
      forgot-password/page.tsx
  components/
    pages/
      DashboardClientPage.tsx    # Interactive parts (modals, FAB, live updates)
      InsightsClientPage.tsx
      TimelineClientPage.tsx
      TransactionsClientPage.tsx
    # UI components (BottomNav, Sidebar, Charts, Modals, etc.)
  lib/
    db.ts                   # Main DB query layer (server-side only)
    types.ts                # Shared TypeScript types
    utils.ts                # Utilities (formatCurrency, etc.)
    supabase/
      client.ts             # Browser client (limited)
      server.ts             # Server client (full access)
      config.ts             # Runtime config
      auth-state.ts         # Auth state & cookies
    transaction-ws.ts       # WebSocket client for app updates
    indexeddb.ts            # Offline queue management
    auth-session-tracking.ts # Session tracking helpers
    policy.ts               # Consent policy checks
public/
  manifest.json             # PWA manifest
  sw.js                     # Service Worker
  icons/
    icon-192.png
    icon-512.png
supabase/
  migrations/               # PostgreSQL migrations
  config.toml
```

### Key Libraries & Functions

#### Database Layer (`src/lib/db.ts`)
- **`getTransactions()`** – Fetch all user transactions.
- **`getBudgets()`** – Fetch monthly budgets.
- **`saveBudgets()`** – Update budgets.
- **`upsertTransaction()`** – Create or update transaction with splits.
- **`processRecurringTransactions()`** – Generate recurring txn instances.
- **Server-side only** – Uses `requireSupabaseUser()` for auth.

#### Supabase Helpers (`src/lib/supabase/`)
- **`createSupabaseServerClient()`** – Server-side Supabase client with cookie handling.
- **`requireSupabaseUser()`** – Auth guard; throws `AuthRequiredError` if not authenticated.
- **`getSupabaseBrowserClient()`** – Limited browser client (anon key).

#### Types (`src/lib/types.ts`)
```typescript
export type Category = 'Food' | 'Transport' | 'Subscription' | 'Entertainment' | ...;
export interface Transaction {
  id: string;
  userId: string;
  amount: number;
  category: Category;
  subCategory?: string;
  date: string;
  merchant?: string;
  description?: string;
  paymentMethod: 'Cash' | 'Credit Card' | 'Debit Card' | 'Mobile Wallet' | 'Bank Transfer';
  notes?: string;
  tags?: string[];
  recurring?: RecurringConfig;
  split?: TransactionSplit[];
  attachmentBase64?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Budget {
  id: string;
  userId: string;
  category: Category | 'Overall';
  subCategory?: string;
  monthlyLimit: number;
  month: string; // 'YYYY-MM'
  rollover: boolean;
  alertThresholdsTriggered: string[];
}

export interface DashboardData {
  budgetStatuses: BudgetStatus[];
  budgetAlerts: BudgetAlert[];
  categoryBreakdown: CategorySpending[];
  weeklySpending: DailySpendingData[];
  dailySpending: DailySpendingData[];
  insights: Insight[];
  recentTransactions: Transaction[];
}
```

---

## Patterns & Conventions

### Server Component Pattern
```typescript
// src/app/dashboard/page.tsx (Server Component)
export default async function DashboardPage() {
  const dashboard = await getAuthedDashboardData(); // Server-side fetch
  return (
    <>
      <div className="...">
        {/* Static/server-rendered content */}
      </div>
      <DashboardClientPage data={dashboard} /> {/* Pass to client component */}
    </>
  );
}

// src/components/pages/DashboardClientPage.tsx (Client Component – interactivity)
'use client';
export default function DashboardClientPage({ data }: { data: DashboardData }) {
  const [showAddModal, setShowAddModal] = useState(false);
  // Local state, modals, live updates, Web Socket subscriptions
  return (
    <>
      {/* Interactive UI */}
      <FloatingAddButton onClick={() => setShowAddModal(true)} />
      <AddExpenseModal open={showAddModal} onClose={() => setShowAddModal(false)} />
    </>
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

## Development Workflows

### Running the App
```bash
npm run dev      # Start Next.js dev server on :3000
npm run build    # Build for production
npm run start    # Run production server
npm run lint     # Run ESLint
npm run ws:server # Start WebSocket server (optional, for real-time demo)
```

### Database Migrations
```bash
npx supabase migration list       # List migrations
npx supabase db push --yes        # Push pending migrations (non-interactive)
```

### Creating a New Expense
1. User clicks "Add Transaction" (FAB or button).
2. `AddExpenseModal` opens (Client Component).
3. Form submitted → `POST /api/transactions`.
4. API validates, calls `db.upsertTransaction()`.
5. Supabase RLS checks user_id and inserts.
6. WebSocket broadcast notifies other tabs/devices.
7. Dashboard refetches and displays updated data.

### Managing Budgets
1. Navigate to Settings (bottom nav).
2. Budget Management section is **first**.
3. Select month, category, sub-category, limit, and rollover toggle.
4. Submit → `POST /api/budgets`.
5. Budget saved and displayed in dashboard alerts.

### Data Export & Import
- **Export:** Settings → "Data Management" → "Export JSON Backup".
- **Import:** Settings → "Import JSON Backup" → select file.
- Transactions bulk-inserted server-side.

---

## Common Issues & Solutions

### TypeScript Import Errors (`Cannot find module '@supabase/supabase-js'`)
- **Cause:** Supabase packages missing from package.json.
- **Solution:** Run `npm install` after restoring dependencies in package.json.
- **Key packages:** `@supabase/ssr`, `@supabase/supabase-js`, `@types/ws`, `supabase`.

### Slow Initial Page Load
- **Cause:** Client-side data fetching in useEffect.
- **Solution:** Migrate page to Server Component → fetch on server → pass data to Client Component.
- **Priority:** Dashboard > Insights/Timeline > Transactions.

### Recurring Transactions Not Processing
- **Cause:** `processRecurringTransactions()` may not be called on every request.
- **Solution:** Move to background job or cron; call on user action (add/edit transaction).

### iOS App Not Showing Safe-Area Padding
- **Cause:** Fixed bottom nav extends into home indicator.
- **Solution:** Use `.mobile-nav-offset` class or `calc(navHeight + env(safe-area-inset-bottom))` in CSS.

---

## Key Insights

1. **Server Components first** – Improves first paint and reduces JS bundle.
2. **API routes as middleware** – Centralize auth checks and Supabase queries.
3. **RLS as security layer** – Never rely on client-side filtering; use RLS.
4. **Hybrid architecture** – Server for data, Client for interactivity (modals, filters, live updates).
5. **Offline-first mindset** – Transactions queued locally before sync.
6. **Settings prioritization** – Budgets first in settings encourages upfront planning.
7. **PWA polish** – iOS safe-area, icon assets, manifest all matter for native feel.

---

## Quick Commands

| Task | Command |
|------|---------|
| Start dev | `npm run dev` |
| Build | `npm run build` |
| Lint | `npm run lint` |
| Format date | `format(date, 'PPP')` from date-fns |
| Format currency | `formatCurrency(amount)` from utils |
| Fetch transactions | `getTransactions()` from db.ts (server-side) |
| Get current user | `requireSupabaseUser()` from supabase/server.ts |
| WebSocket subscribe | `subscribeAppUpdates(callback)` from transaction-ws.ts |
| Check offline queue | `getPendingTransactions()` from indexeddb.ts |

---

## References

- **Next.js Docs:** https://nextjs.org/docs
- **Supabase Docs:** https://supabase.com/docs
- **React Docs:** https://react.dev
- **Tailwind CSS:** https://tailwindcss.com
- **Chart.js:** https://www.chartjs.org
- **date-fns:** https://date-fns.org
