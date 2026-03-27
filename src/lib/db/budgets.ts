import type { Budget, BudgetThresholdAlert } from '../types';

import { getAuthedClient } from './client';
import { toBudget } from './mappers';
import { BUDGET_SELECT } from './selects';
import type { BudgetRow } from './rows';
import { monthToDate, throwIfError } from './shared';

export async function getBudgets(): Promise<Budget[]> {
  const { supabase } = await getAuthedClient();
  const { data, error } = await supabase
    .from('budgets')
    .select(BUDGET_SELECT)
    .order('budget_month', { ascending: false });

  throwIfError('Failed to load budgets', error);

  return (data ?? []).map((row) => toBudget(row as BudgetRow));
}

export async function saveBudgets(budgets: Budget[]): Promise<void> {
  for (const budget of budgets) {
    await setBudget(budget);
  }
}

export async function setBudget(budget: Budget): Promise<Budget> {
  const { supabase, userId } = await getAuthedClient();
  const budgetMonth = monthToDate(budget.month);
  const normalizedSubCategory = budget.category === 'Overall' ? null : budget.subCategory ?? null;
  const payload = {
    id: budget.id,
    user_id: userId,
    budget_month: budgetMonth,
    category: budget.category,
    sub_category: normalizedSubCategory,
    monthly_limit: Number(budget.monthlyLimit.toFixed(2)),
    rollover: Boolean(budget.rollover),
    alert_thresholds_triggered: Array.isArray(budget.alertThresholdsTriggered)
      ? Array.from(new Set(budget.alertThresholdsTriggered)).sort((a, b) => a - b)
      : [],
  };

  const { data: existingById, error: existingByIdError } = await supabase
    .from('budgets')
    .select(BUDGET_SELECT)
    .eq('id', budget.id)
    .maybeSingle();
  throwIfError('Failed to validate budget identity', existingByIdError);

  let targetId = existingById?.id ?? null;

  if (!targetId) {
    let scopeQuery = supabase
      .from('budgets')
      .select(BUDGET_SELECT)
      .eq('budget_month', budgetMonth)
      .eq('category', budget.category)
      .limit(1);

    if (normalizedSubCategory === null) {
      scopeQuery = scopeQuery.is('sub_category', null);
    } else {
      scopeQuery = scopeQuery.eq('sub_category', normalizedSubCategory);
    }

    const { data: existingScoped, error: existingScopeError } = await scopeQuery.maybeSingle();
    throwIfError('Failed to validate budget scope', existingScopeError);
    targetId = existingScoped?.id ?? null;
  }

  if (targetId) {
    const { data, error } = await supabase
      .from('budgets')
      .update({
        category: payload.category,
        sub_category: payload.sub_category,
        monthly_limit: payload.monthly_limit,
        budget_month: payload.budget_month,
        rollover: payload.rollover,
        alert_thresholds_triggered: payload.alert_thresholds_triggered,
      })
      .eq('id', targetId)
      .select(BUDGET_SELECT)
      .single();

    throwIfError('Failed to update budget', error);
    return toBudget(data as BudgetRow);
  }

  const { data, error } = await supabase
    .from('budgets')
    .insert(payload)
    .select(BUDGET_SELECT)
    .single();

  throwIfError('Failed to create budget', error);
  return toBudget(data as BudgetRow);
}

export async function deleteBudget(id: string): Promise<boolean> {
  const { supabase } = await getAuthedClient();
  const { data, error } = await supabase
    .from('budgets')
    .delete()
    .eq('id', id)
    .select('id');

  throwIfError('Failed to delete budget', error);

  return Array.isArray(data) && data.length > 0;
}

export async function saveBudgetThresholdAlerts(
  alerts: BudgetThresholdAlert[]
): Promise<void> {
  if (alerts.length === 0) {
    return;
  }

  const { supabase, userId } = await getAuthedClient();

  const payload = alerts.map((alert) => ({
    user_id: userId,
    budget_id: alert.budgetId,
    budget_month: monthToDate(alert.month),
    threshold: alert.threshold,
    spent: Number(alert.spent.toFixed(2)),
    effective_limit: Number(alert.limit.toFixed(2)),
    percentage: Number(alert.percentage.toFixed(4)),
    message: alert.message,
  }));

  const { error } = await supabase
    .from('budget_threshold_alerts')
    .upsert(payload, { onConflict: 'budget_id,budget_month,threshold' });

  throwIfError('Failed to save budget threshold alerts', error);
}
