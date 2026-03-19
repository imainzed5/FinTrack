export type BerdeState = 'neutral' | 'proud' | 'worried' | 'hype' | 'sarcastic';

export interface BerdeContext {
  state: BerdeState;
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
}
