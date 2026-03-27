import { addDays, format, isAfter, startOfDay } from 'date-fns';
import { v4 as uuidv4 } from 'uuid';

import { RECURRING_FREQUENCIES } from '../types';
import { getAuthedClient } from './client';
import { toTransaction } from './mappers';
import { normalizeIncomeCategory } from './normalizers';
import { LEGACY_TRANSACTION_SELECT, TRANSACTION_SELECT } from './selects';
import type { TransactionRow } from './rows';
import {
  addRecurringInterval,
  isMissingAccountsSchemaError,
  safeParseDate,
  throwIfError,
} from './shared';
import { replaceTransactionSplits } from './transaction-helpers';

export async function processRecurringTransactions(
  now: Date = new Date()
): Promise<{ created: number }> {
  const { supabase } = await getAuthedClient();
  const today = startOfDay(now);
  let created = 0;
  let supportsAccountColumns = true;

  let { data: templates, error } = await supabase
    .from('transactions')
    .select(TRANSACTION_SELECT)
    .not('recurring_frequency', 'is', null)
    .eq('is_auto_generated', false);

  if (error && isMissingAccountsSchemaError(error)) {
    supportsAccountColumns = false;
    const fallback = await supabase
      .from('transactions')
      .select(LEGACY_TRANSACTION_SELECT)
      .not('recurring_frequency', 'is', null)
      .eq('is_auto_generated', false);
    templates = fallback.data as typeof templates;
    error = fallback.error;
  }

  throwIfError('Failed to load recurring templates', error);

  for (const row of templates ?? []) {
    const templateRow = row as TransactionRow;
    const template = toTransaction(templateRow);
    if (!template.recurring || !RECURRING_FREQUENCIES.includes(template.recurring.frequency)) {
      continue;
    }

    const interval = Math.max(1, Math.floor(template.recurring.interval || 1));
    let nextRunDate =
      safeParseDate(template.recurring.nextRunDate) ||
      addRecurringInterval(
        safeParseDate(template.date) || now,
        template.recurring.frequency,
        interval
      );

    const endDate = safeParseDate(template.recurring.endDate);

    while (!isAfter(startOfDay(nextRunDate), today)) {
      if (endDate && isAfter(startOfDay(nextRunDate), startOfDay(endDate))) {
        break;
      }

      const runDay = format(nextRunDate, 'yyyy-MM-dd');
      const dayStart = `${runDay}T00:00:00.000Z`;
      const nextDay = addDays(nextRunDate, 1);
      const dayEnd = `${format(nextDay, 'yyyy-MM-dd')}T00:00:00.000Z`;

      const { data: existingRun, error: existingError } = await supabase
        .from('transactions')
        .select('id')
        .eq('recurring_origin_id', template.id)
        .gte('transaction_at', dayStart)
        .lt('transaction_at', dayEnd)
        .limit(1);

      throwIfError('Failed to validate recurring run duplication', existingError);

      if (!existingRun || existingRun.length === 0) {
        const timestamp = new Date().toISOString();
        const autoId = uuidv4();

        const insertPayload: Record<string, unknown> = {
          id: autoId,
          user_id: templateRow.user_id,
          amount: template.amount,
          type: template.type,
          category: template.category,
          sub_category:
            template.type === 'income'
              ? normalizeIncomeCategory(template.incomeCategory) ?? 'Other Income'
              : template.subCategory ?? null,
          merchant: template.merchant ?? null,
          description:
            template.description ||
            template.notes ||
            (template.type === 'income'
              ? template.incomeCategory || template.category
              : template.category),
          transaction_at: nextRunDate.toISOString(),
          payment_method: template.paymentMethod,
          notes: template.notes || '',
          tags: Array.isArray(template.tags) ? template.tags : [],
          attachment_base64: template.attachmentBase64 ?? null,
          savings_meta: template.savingsMeta ?? null,
          recurring_frequency: null,
          recurring_interval: null,
          recurring_next_run_at: null,
          recurring_end_at: null,
          recurring_origin_id: template.id,
          is_auto_generated: true,
          synced: true,
          created_at: timestamp,
          updated_at: timestamp,
        };

        if (supportsAccountColumns) {
          insertPayload.account_id = template.accountId ?? null;
          insertPayload.transfer_group_id = null;
          insertPayload.linked_transfer_group_id = template.linkedTransferGroupId ?? null;
          insertPayload.metadata = template.metadata ?? {};
        }

        const { error: insertError } = await supabase.from('transactions').insert(insertPayload);

        throwIfError('Failed to create recurring transaction', insertError);

        if (template.split) {
          await replaceTransactionSplits(supabase, autoId, template.split);
        }

        created += 1;
      }

      nextRunDate = addRecurringInterval(nextRunDate, template.recurring.frequency, interval);
    }

    const nextRunIso = nextRunDate.toISOString();
    if (template.recurring.nextRunDate !== nextRunIso) {
      const { error: updateTemplateError } = await supabase
        .from('transactions')
        .update({
          recurring_interval: interval,
          recurring_next_run_at: nextRunIso,
        })
        .eq('id', template.id);

      throwIfError('Failed to update recurring template', updateTemplateError);
    }
  }

  return { created };
}
