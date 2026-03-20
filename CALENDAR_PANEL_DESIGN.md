# Calendar Panel Design & Implementation Guide

## Overview
Design decisions and implementation recommendations for the Calendar Panel feature in Moneda. This document answers all design questions and provides a blueprint for implementation.

---

## 1. Panel Behavior & Structure

### Q1: Calendar Pill Toggle Behavior
**Answer: Should toggle (like Statistics does)**

The Calendar pill should follow the exact pattern of the Statistics panel. Currently, your Statistics button toggles `statsOpen` state and highlights when active.

Implementation:
```tsx
const [calendarOpen, setCalendarOpen] = useState(false);

// Pill button pattern:
<button
  type="button"
  onClick={() => setCalendarOpen(!calendarOpen)}
  className={`inline-flex items-center gap-1.5 rounded-full border border-[...] px-4 py-2 text-xs font-medium transition-colors ${
    calendarOpen
      ? 'bg-[#1D9E75] text-white'
      : 'bg-white text-zinc-700 hover:bg-[#E1F5EE]'
  }`}
>
  <CalendarDays size={14} />
  <span>Calendar</span>
</button>
```

### Q2: Mutual Exclusivity Between Panels
**Answer: Keep them independent but recommend Option B (mutual exclusion)**

You have two design choices:

**Option A (Current Pattern):**
- Let both Statistics and Calendar panels open simultaneously
- Both coexist on screen without collision
- Requires careful layout: Statistics on right sidebar, Calendar in bottom sheet or left panel

**Option B (Recommended - Better UX):**
- Close Statistics when opening Calendar (and vice versa)
- Creates a single "detail view" slot that swaps between panels
- Cleaner mobile experience, less overwhelming
- One-liner in each handler: `setStatsOpen(false)` when opening Calendar

**Recommendation:** Go with **Option B**.

Implementation:
```tsx
const handleOpenCalendar = () => {
  setStatsOpen(false); // Close Statistics
  setCalendarOpen(true);
};

const handleOpenStatistics = () => {
  setCalendarOpen(false); // Close Calendar
  setStatsOpen(true);
};
```

### Q3: Mobile Layout Behavior
**Answer: Bottom sheet (not fullscreen)**

Statistics uses fullscreen on mobile, but Calendar with a month grid is better served by a **bottom sheet that takes 70-80% viewport height**.

**Mobile (md:hidden):**
- Slides up from bottom as a bottom sheet
- Takes 70-80% of screen height
- Allows users to tap a day, see details, swipe-dismiss
- Month stays visible but scrollable behind translucent overlay

**Desktop (md:block):**
- Fixed sidebar panel (like Statistics)
- 340px width
- Slides in from right or right-aligned
- Same animation pattern as Statistics

Layout pattern:
```tsx
// Mobile: Bottom sheet
<section className={`${isOpen ? 'block' : 'hidden'} md:hidden fixed bottom-0 inset-x-0 z-40`}>
  <div className="max-h-[80vh] rounded-t-3xl bg-white shadow-lg overflow-y-auto">
    {/* Calendar content */}
  </div>
</section>

// Desktop: Right sidebar
<aside
  className="fixed right-0 top-0 z-30 hidden h-screen overflow-hidden bg-[#f8f7f2] md:block"
  style={{
    width: isOpen ? '340px' : '0px',
    transition: 'width 300ms cubic-bezier(0.4, 0, 0.2, 1), ...',
  }}
>
  {/* Calendar content */}
</aside>
```

---

## 2. Data & Heatmap Logic

### Q4: Heatmap Intensity Scale
**Answer: Relative to user's max spend day within that month**

Relative intensity feels more personal and shows meaningful contrast for varying budgets:
- Users with ₱50/day budgets see contrast between ₱40 and ₱10
- Users with ₱2000/day budgets see contrast between ₱1800 and ₱500

Algorithm:
```tsx
const dailySpendingMap = new Map(
  dailySpending.map(d => [d.day, d.amount])
);

const monthDays = eachDayOfMonth(selectedMonth);
const spendAmounts = monthDays
  .map(date => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return dailySpendingMap.get(dateStr) || 0;
  });

const maxSpend = Math.max(...spendAmounts);
const intensity = (amount: number) => 
  maxSpend > 0 ? amount / maxSpend : 0; // Returns 0 to 1

// Color mapping (example: green gradient)
const backgroundColor = (amount: number) => {
  const intenseValue = intensity(amount);
  if (intenseValue === 0) return '#F5F5F0'; // No spend
  if (intenseValue < 0.25) return '#D4F1E9'; // Light green
  if (intenseValue < 0.5) return '#A3E8D9'; // Medium light
  if (intenseValue < 0.75) return '#5DD4C4'; // Medium
  return '#1D9E75'; // Dark green (max)
};
```

**Why relative?**
- More intuitive for all users regardless of spending level
- Highlights behavior patterns better than absolute thresholds
- Personal and motivating

### Q5: Tapping a Day in Past Months
**Answer: Show real transaction data if available; "no data" if none**

When user taps a day in any month (past or present):

1. **If dailySpending[day] > 0:**
   - Fetch/show transactions for that day via transaction list
   - Show drill-down with transaction details (category, amount, merchant, etc.)
   - Link to full transaction details if tapped

2. **If dailySpending[day] === 0 or no data:**
   - Show EmptyState with "No expenses this day"
   - Optional: Show income if transaction exists
   - Allow user to add new transaction for that day

**API Strategy:**
- Dashboard already provides `dailySpending[]` with per-day amounts
- Pass `day` parameter to filter `recentTransactions` by date
- For detail drill-down: Already have transactions in memory; filter client-side by date
- No new API endpoint needed initially—use existing data

Implementation:
```tsx
const handleDayTap = (date: string) => {
  const dailyAmount = dailySpendingMap.get(date) || 0;
  
  if (dailyAmount === 0) {
    setSelectedDayDetail({
      date,
      hasData: false,
      transactions: []
    });
    // Show EmptyState
  } else {
    const dayTransactions = recentTransactions.filter(t => 
      t.date.split('T')[0] === date
    );
    setSelectedDayDetail({
      date,
      hasData: true,
      transactions: dayTransactions
    });
  }
};
```

### Q6: "No-Spend Days" Counting
**Answer: Count elapsed days only**

For March 20, count only days 1-20 (today = 20 elapsed days), not the full 31-day month.

Logic:
```tsx
const today = new Date();
const currentDayOfMonth = today.getDate(); // Returns 1-31

// Only count days that have passed
const elapsedDaysInMonth = currentDayOfMonth;

// Count no-spend days from elapsed days
const noSpendDays = dailySpending
  .filter((d, index) => {
    const dayNum = index + 1; // dailySpending is 0-indexed
    return dayNum <= elapsedDaysInMonth && d.amount === 0;
  })
  .length;

// Total spend days
const spendDays = elapsedDaysInMonth - noSpendDays;
```

**Why?**
- Accurate reflection of actual behavior (March 21-31 haven't happened yet)
- Fair comparison across different calendar dates
- More meaningful for users when viewing past months too

---

## 3. Navigation & Drill-Down

### Q7: How Far Back Can User Navigate?
**Answer: From first transaction date or 12 months back, whichever is more recent**

Prevents endless scrolling through empty months while allowing full historical access.

Implementation:
```tsx
const firstTransactionDate = transactions.length > 0
  ? new Date(Math.min(...transactions.map(t => new Date(t.date).getTime())))
  : new Date();

const twelveMonthsAgo = new Date();
twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

const minDate = new Date(Math.max(
  firstTransactionDate.getTime(),
  twelveMonthsAgo.getTime()
));

const maxDate = new Date(); // Today

const canNavigateTo = (month: string): boolean => {
  const targetDate = parseISO(`${month}-01`);
  return targetDate >= minDate && targetDate <= maxDate;
};
```

**UI:**
- Show disabled state on prev/next buttons at boundaries
- Tooltip: "Earliest data available: [month]"

### Q8: Transaction Drill-Down Linking
**Answer: Link to /transactions page filtered by date**

When user taps a transaction from a calendar day detail:

**Option 1 (Recommended):**
Link directly to transaction detail view with date filter.
```
/transactions?selectedDay=2025-03-05
```

**Option 2 (Alternative):**
Use date range for more flexibility.
```
/transactions?startDate=2025-03-05&endDate=2025-03-05
```

**Implementation in TransactionsPage:**
Your `/transactions` page already supports category filtering (`?categories=...`).
Add date filtering:

```tsx
const [selectedDay, setSelectedDay] = useState<string | null>(() => {
  if (typeof window === 'undefined') return null;
  return new URLSearchParams(window.location.search).get('selectedDay');
});

// In fetch logic:
const params = new URLSearchParams();
if (selectedDay) {
  params.set('selectedDay', selectedDay);
}
if (selectedCategories.length > 0) {
  params.set('categories', selectedCategories.join(','));
}

const endpoint = `/api/transactions?${params.toString()}`;
```

**From Calendar:**
```tsx
const handleTransactionTap = (transaction: Transaction) => {
  const dateStr = transaction.date.split('T')[0];
  router.push(`/transactions?selectedDay=${dateStr}`);
};
```

---

## 4. Streaks & Insights

### Q9: Streak Callout
**Answer: Include it—highly motivating**

Streaks are psychologically powerful and align with Moneda's personality. Include them.

Examples:
```
"🔥 10-day no-spend streak!"
"You're usually spend-free on weekends. Streak: +3 weekends"
"Tied your record! 15-day streak 🎉"
```

Calculation (for selected month):
```tsx
const calculateNoSpendStreak = (dailySpending: DailySpending[], month: string) => {
  const monthStart = parseISO(`${month}-01`);
  const monthEnd = endOfMonth(monthStart);
  const today = new Date();
  
  // Only count up to today if in current month
  const countUpTo = isSameMonth(monthStart, today) ? today : monthEnd;
  
  const days = eachDayOfMonth(monthStart);
  let currentStreak = 0;
  let maxStreak = 0;
  
  for (const day of days) {
    if (day > countUpTo) break;
    
    const dateStr = format(day, 'yyyy-MM-dd');
    const amount = dailySpendingMap.get(dateStr) || 0;
    
    if (amount === 0) {
      currentStreak++;
      maxStreak = Math.max(maxStreak, currentStreak);
    } else {
      currentStreak = 0;
    }
  }
  
  return {
    current: currentStreak,
    max: maxStreak,
    isOnStreak: currentStreak > 0
  };
};
```

**UI Display:**
```tsx
<div className="mt-3 rounded-xl bg-gradient-to-r from-yellow-50 to-orange-50 p-3 border border-amber-200">
  {streak.isOnStreak ? (
    <>
      <p className="text-sm font-semibold text-amber-900">🔥 {streak.current}-day no-spend streak!</p>
      {streak.current === streak.max && (
        <p className="text-xs text-amber-700 mt-1">Tied your record! 🎉</p>
      )}
    </>
  ) : (
    <p className="text-sm text-amber-800">Your best: {streak.max}-day streak</p>
  )}
</div>
```

### Q10: Summary Pills Update on Month Navigation
**Answer: Yes, absolutely—all pills update**

When user navigates to a different month, all summary statistics recalculate:

```tsx
const [selectedMonth, setSelectedMonth] = useState(() => {
  const now = new Date();
  return format(now, 'yyyy-MM');
});

// Recompute whenever month changes
const monthlyStats = useMemo(() => {
  const daysForMonth = eachDayOfMonth(parseISO(`${selectedMonth}-01`));
  const monthData = daysForMonth.map(day => {
    const dateStr = format(day, 'yyyy-MM-dd');
    return {
      date: dateStr,
      amount: dailySpendingMap.get(dateStr) || 0
    };
  });
  
  const totalSpent = monthData.reduce((sum, d) => sum + d.amount, 0);
  const noSpendDays = monthData.filter(d => d.amount === 0).length;
  const spendDays = monthData.filter(d => d.amount > 0).length;
  const streak = calculateNoSpendStreak(dailySpending, selectedMonth);
  
  return { totalSpent, noSpendDays, spendDays, streak };
}, [selectedMonth, dailySpending]);
```

**Update UI:**
```tsx
<div className="grid grid-cols-2 gap-2 mt-4">
  <Pill label="Total Spent" value={formatCurrency(monthlyStats.totalSpent)} />
  <Pill label="Spend Days" value={monthlyStats.spendDays.toString()} />
  <Pill label="No-Spend Days" value={monthlyStats.noSpendDays.toString()} />
  <Pill label="Best Streak" value={`${monthlyStats.streak.max}d`} />
</div>
```

---

## 5. Existing Code Reference

### Q11: Statistics Panel as Reference Pattern
✅ **Yes—use StatisticsPanel.tsx as your template**

Location: `src/components/dashboard/StatisticsPanel.tsx`

**Key patterns to copy:**

**Mobile fullscreen (adapt for bottom sheet):**
```tsx
<section className={`${isOpen ? 'block' : 'hidden'} md:hidden`}>
  <div className="min-h-screen bg-[#f5f5f0] px-4 py-5 sm:px-6">
    {/* Full content */}
  </div>
</section>
```

**Desktop sidebar with smooth animation:**
```tsx
<aside
  className="fixed right-0 top-0 z-30 hidden h-screen overflow-hidden bg-[#f8f7f2] md:block"
  style={{
    width: isOpen ? '340px' : '0px',
    opacity: isOpen ? 1 : 0,
    borderLeftWidth: isOpen ? '1px' : '0px',
    borderLeftColor: 'var(--color-border-tertiary, #d9d7cf)',
    boxShadow: isOpen ? '-10px 0 24px rgba(15, 23, 42, 0.08)' : 'none',
    transition:
      'width 300ms cubic-bezier(0.4, 0, 0.2, 1), opacity 300ms cubic-bezier(0.4, 0, 0.2, 1)',
  }}
>
  <div
    className={`h-full w-[340px] overflow-y-auto p-4`}
    style={{
      transform: isOpen ? 'translateX(0)' : 'translateX(24px)',
      transition: 'transform 300ms cubic-bezier(0.4, 0, 0.2, 1), opacity 300ms cubic-bezier(0.4, 0, 0.2, 1)',
    }}
  >
    {/* Content */}
  </div>
</aside>
```

**Header pattern (copy this exactly):**
```tsx
<header className="rounded-2xl border-[0.5px] border-[color:var(--color-border-tertiary,#d9d7cf)] bg-white p-4">
  <div className="flex items-start justify-between gap-3">
    <div>
      <h2 className="text-[14px] font-medium text-zinc-900">Calendar</h2>
      <p className="mt-1 text-xs text-zinc-500">Daily spending visualization</p>
    </div>
    <button
      type="button"
      onClick={onClose}
      aria-label="Close calendar"
      className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[color:var(--color-border-tertiary,#d9d7cf)] text-zinc-600 transition-colors hover:bg-zinc-100"
    >
      <X size={15} />
    </button>
  </div>
</header>
```

**Escape key handling (from StatisticsPanel):**
```tsx
useEffect(() => {
  if (!isOpen) {
    return;
  }

  const handleEscape = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      onClose();
    }
  };

  window.addEventListener('keydown', handleEscape);
  return () => {
    window.removeEventListener('keydown', handleEscape);
  };
}, [isOpen, onClose]);
```

### Q12: Per-Day Spending Data Available?
✅ **Yes—already in DashboardData**

Your `/api/dashboard` route returns:
```tsx
dailySpending: { day: string; amount: number }[];
```

This is everything Calendar needs:
- Calculate heatmap intensity per day
- Show summary stats
- Identify no-spend days
- Calculate streaks

**No new API endpoint required** for basic functionality.

Future optimization (if needed):
- If calendar gets slow with large datasets, create `/api/calendar/:month?` endpoint
- Return only the requested month's data
- Add heatmap pre-computed intensities

---

## 6. Implementation Plan

### Step 1: Create CalendarPanel Component
**File:** `src/components/dashboard/CalendarPanel.tsx`

**Props interface:**
```tsx
interface CalendarPanelProps {
  isOpen: boolean;
  onClose: () => void;
  dailySpending: DashboardData['dailySpending'];
  recentTransactions: Transaction[];
  selectedDay?: string; // Optional: pre-select a day
  onDaySelect?: (date: string) => void; // Callback when day tapped
}
```

**Key sections:**
1. Header with month/year picker (prev/next buttons)
2. Heatmap grid (7 cols, showing week days and dates)
3. Selected day detail section (transaction list or empty state)
4. Summary pills (total spent, spend days, no-spend days, streak)

### Step 2: Update DashboardClientPage
**File:** `src/components/pages/DashboardClientPage.tsx`

**Add state:**
```tsx
const [calendarOpen, setCalendarOpen] = useState(false);
```

**Add pill to header:**
```tsx
<button
  type="button"
  onClick={() => {
    setStatsOpen(false);
    setCalendarOpen(true);
  }}
  className={`inline-flex items-center gap-1.5 rounded-full border border-[...] px-4 py-2 text-xs font-medium transition-colors ${
    calendarOpen ? 'bg-[#1D9E75] text-white' : 'bg-white text-zinc-700 hover:bg-[#E1F5EE]'
  }`}
>
  <CalendarDays size={14} />
  <span>Calendar</span>
</button>
```

**Add panel to bottom of component:**
```tsx
<CalendarPanel
  isOpen={calendarOpen}
  onClose={() => setCalendarOpen(false)}
  dailySpending={data.dailySpending}
  recentTransactions={data.recentTransactions}
  onDaySelect={(date) => {
    router.push(`/transactions?selectedDay=${date}`);
  }}
/>
```

### Step 3: Update TransactionsPage
**File:** `src/app/transactions/page.tsx`

**Add date filtering:**
```tsx
const [selectedDay, setSelectedDay] = useState<string | null>(() => {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  return params.get('selectedDay');
});

// In fetch params:
if (selectedDay) {
  params.set('selectedDay', selectedDay);
}
```

**Add filter logic:**
```tsx
let filtered = transactions;
if (selectedDay) {
  filtered = filtered.filter(t => t.date.split('T')[0] === selectedDay);
}
```

### Step 4: Optional Styling & Polish
- Add subtle background gradient on heatmap
- Hover effects on days
- Smooth scroll on selected day drill-down
- Loading skeleton for monthly data fetch (unlikely but possible)

---

## Component Structure Reference

```
CalendarPanel.tsx
├── CalendarHeader
│   ├── Month picker (prev/next)
│   ├── Title (e.g., "March 2025")
│   └── Close button
├── HeatmapGrid
│   ├── Day labels (Mon, Tue, etc.)
│   ├── Day cells (with color intensity)
│   └── Empty cells (previous/next month)
├── SelectedDayDetail
│   ├── Date display
│   ├── TransactionList or EmptyState
│   └── "Add transaction" CTA (optional)
└── Summary Pills
    ├── Total spent this month
    ├── Spend days count
    ├── No-spend days count
    └── Streak callout
```

---

## Styling Notes

Use existing Moneda design tokens from StatisticsPanel:
- Header background: `white` with border `var(--color-border-tertiary, #d9d7cf)`
- Panel background: `#f8f7f2` (desktop) or `white` (mobile)
- Text primary: `text-zinc-900`
- Text secondary: `text-zinc-500`
- Accent: `#1D9E75` (Moneda green)
- Heatmap gradient: Light `#D4F1E9` → Dark `#1D9E75`
- Streak callout: Amber gradient `from-yellow-50 to-orange-50`

---

## Summary

| Question | Decision |
|----------|----------|
| **Panel toggle?** | Yes, toggle like Statistics |
| **Mutually exclusive?** | Yes (Option B—close each other) |
| **Mobile layout?** | Bottom sheet (70-80% height) |
| **Heatmap scale?** | Relative to max spend day in month |
| **Past month data?** | Show real transactions if available |
| **No-spend counting?** | Elapsed days only (not full month) |
| **Navigation depth?** | 12 months back or from first transaction |
| **Drill-down link?** | `/transactions?selectedDay=YYYY-MM-DD` |
| **Streaks?** | Include—highly motivating |
| **Pills update?** | Yes, recalculate per month |
| **Reference pattern?** | StatisticsPanel.tsx |
| **New API needed?** | No—use existing dailySpending data |

Ready to implement CalendarPanel.tsx?
