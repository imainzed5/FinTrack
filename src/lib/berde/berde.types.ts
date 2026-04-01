import type {
  BerdePreviousMonthStatus,
  DashboardTrendDirection,
} from '@/lib/types';

export type BerdeTrigger =
  | 'savings_milestone'
  | 'savings_goal'
  | 'first_transaction_logged'
  | 'payday_today'
  | 'month_start_carryover'
  | 'month_start_reset'
  | 'month_start_empty'
  | 'budget_high_usage'
  | 'category_overspent'
  | 'high_spend_streak'
  | 'payday_far'
  | 'fresh_month_recovery'
  | 'budget_recoverable'
  | 'carryover_momentum'
  | 'savings_rate_high'
  | 'budget_under_control'
  | 'low_spend_streak'
  | 'food_dominant'
  | 'repeat_merchant'
  | 'impulse_purchase'
  | 'no_strong_signal';

export type BerdeState =
  | 'neutral'
  | 'proud'
  | 'worried'
  | 'hype'
  | 'sarcastic'
  | 'motivational'
  | 'celebratory'
  | 'helper'
  | 'excited';

export interface BerdeContext {
  state: BerdeState;
  trigger: BerdeTrigger;
  quote: string;
  triggerReason: string;
}

export interface BerdeInputs {
  savingsRate: number;
  budgetUsedPercent: number;
  savingsGoalHit: boolean;
  lowSpendStreakDays: number;
  categoryOverspent: boolean;
  highSpendDaysInRow: number;
  daysUntilPayday: number;
  savingsMilestoneHit: boolean;
  isFirstTransaction: boolean;
  monthSpend: number;
  foodSpendPercent: number;
  sameMerchantCount: number;
  impulseLogged: boolean;
  hasHistory: boolean;
  isNewMonthWindow: boolean;
  previousMonthStatus: BerdePreviousMonthStatus;
  spendTrend: DashboardTrendDirection;
  savingsTrend: DashboardTrendDirection;
  savingsStreakMonths: number;
}
