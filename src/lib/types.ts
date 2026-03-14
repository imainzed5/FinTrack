export const CATEGORIES = [
  'Food',
  'Transportation',
  'Subscriptions',
  'Utilities',
  'Shopping',
  'Entertainment',
  'Health',
  'Education',
  'Miscellaneous',
] as const;

export type Category = (typeof CATEGORIES)[number];

export const PAYMENT_METHODS = [
  'Cash',
  'Credit Card',
  'Debit Card',
  'GCash',
  'Maya',
  'Bank Transfer',
  'Other',
] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export interface Transaction {
  id: string;
  amount: number;
  category: Category;
  date: string; // ISO string
  paymentMethod: PaymentMethod;
  notes: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  synced?: boolean;
}

export interface Budget {
  id: string;
  category: Category | 'Overall';
  monthlyLimit: number;
  month: string; // YYYY-MM
}

export interface Subscription {
  id: string;
  name: string;
  amount: number;
  billingCycle: 'weekly' | 'monthly' | 'yearly';
  lastDetected: string;
  category: Category;
}

export interface TimelineEvent {
  id: string;
  eventType:
    | 'started_tracking'
    | 'subscription_detected'
    | 'spending_spike'
    | 'highest_savings'
    | 'budget_exceeded'
    | 'milestone'
    | 'spending_improvement'
    | 'savings_streak'
    | 'savings_milestone'
    | 'best_savings_rate'
    | 'low_spend_month';
  description: string;
  date: string;
  metadata: Record<string, unknown>;
  context?: string;   // human-readable explanation of what happened
  advice?: string;    // actionable recommendation
  link?: string;      // drill-down URL (e.g., /transactions?month=2025-03)
  severity?: 'positive' | 'neutral' | 'warning' | 'critical';
  amount?: number;    // optional monetary highlight
}

export interface Insight {
  id: string;
  insightType: 'spending_spike' | 'subscription' | 'budget_risk' | 'pattern' | 'saving';
  message: string;
  severity: 'info' | 'warning' | 'critical';
  category?: Category;
  createdAt: string;
}

export interface BudgetStatus {
  category: Category | 'Overall';
  limit: number;
  spent: number;
  percentage: number;
  status: 'safe' | 'warning' | 'critical';
}

export interface DashboardData {
  totalSpentThisMonth: number;
  totalSpentLastMonth: number;
  remainingBudget: number;
  monthlyBudget: number;
  savingsRate: number;
  expenseGrowthRate: number;
  budgetStatuses: BudgetStatus[];
  categoryBreakdown: { category: string; amount: number }[];
  weeklySpending: { week: string; amount: number }[];
  dailySpending: { day: string; amount: number }[];
  recentTransactions: Transaction[];
  insights: Insight[];
}

export interface MonthlySavings {
  month: string; // YYYY-MM
  budget: number;
  spent: number;
  saved: number;
  savingsRate: number; // percentage
  cumulative: number;  // running total of all saved amounts
}

export interface TransactionInput {
  amount: number;
  category: Category;
  date?: string;
  paymentMethod?: PaymentMethod;
  notes?: string;
  tags?: string[];
}
