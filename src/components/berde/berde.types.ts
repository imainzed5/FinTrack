export type BerdeState = 'neutral' | 'proud' | 'worried' | 'hype' | 'sarcastic';

export interface BerdeContext {
  state: BerdeState;
  quote: string;
  triggerReason: string;
}

export interface BerdeInputs {
  savingsRate: number;           // 0–100
  budgetUsedPercent: number;     // 0–100
  savingsGoalHit: boolean;
  lowSpendStreakDays: number;    // consecutive days under daily average
  categoryOverspent: boolean;
  highSpendDaysInRow: number;    // consecutive days above daily average
  daysUntilPayday: number;
  savingsMilestoneHit: boolean;
  isFirstTransaction: boolean;
  monthSpend: number;            // 0 = nothing spent yet this month
  foodSpendPercent: number;      // 0–100 of total spend
  sameMerchantCount: number;     // max occurrences of one merchant this week
  impulseLogged: boolean;        // latest txn is Miscellaneous category
}
