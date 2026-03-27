import type { ExternalWithdrawalRequest } from '../types';

import { getAuthedClient } from './client';
import { toExternalWithdrawalRequest } from './mappers';
import { EXTERNAL_WITHDRAWAL_REQUEST_SELECT } from './selects';
import type { ExternalWithdrawalRequestRow } from './rows';
import { isMissingAccountsSchemaError, throwIfError } from './shared';

export async function getExternalWithdrawalRequests(): Promise<ExternalWithdrawalRequest[]> {
  const { supabase, userId } = await getAuthedClient();
  const { data, error } = await supabase
    .from('external_withdrawal_requests')
    .select(EXTERNAL_WITHDRAWAL_REQUEST_SELECT)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error && isMissingAccountsSchemaError(error)) {
    return [];
  }

  throwIfError('Failed to load external withdrawal requests', error);

  return (data ?? []).map((row) => toExternalWithdrawalRequest(row as ExternalWithdrawalRequestRow));
}

export async function createExternalWithdrawalRequest(input: {
  fromAccountId: string;
  amount: number;
  feeAmount: number;
  destinationSummary: string;
  etaAt?: string;
  idempotencyKey: string;
  metadata?: Record<string, unknown>;
}): Promise<ExternalWithdrawalRequest> {
  const { supabase } = await getAuthedClient();

  const { data, error } = await supabase.rpc('create_external_withdrawal_request', {
    p_from_account_id: input.fromAccountId,
    p_amount: Number(input.amount.toFixed(2)),
    p_fee_amount: Number(input.feeAmount.toFixed(2)),
    p_destination_summary: input.destinationSummary,
    p_eta_at: input.etaAt ? new Date(input.etaAt).toISOString() : null,
    p_idempotency_key: input.idempotencyKey,
    p_metadata: input.metadata ?? null,
  });

  throwIfError('Failed to create external withdrawal request', error);

  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.id) {
    throw new Error('External withdrawal request was not created.');
  }

  return toExternalWithdrawalRequest(row as ExternalWithdrawalRequestRow);
}

export async function updateExternalWithdrawalRequestStatus(input: {
  id: string;
  action: 'complete' | 'fail';
  providerRef?: string;
  failureReason?: string;
  metadata?: Record<string, unknown>;
}): Promise<ExternalWithdrawalRequest> {
  const { supabase } = await getAuthedClient();

  const rpcName = input.action === 'complete'
    ? 'complete_external_withdrawal_request'
    : 'fail_external_withdrawal_request';
  const args = input.action === 'complete'
    ? {
        p_request_id: input.id,
        p_provider_ref: input.providerRef ?? null,
        p_metadata: input.metadata ?? null,
      }
    : {
        p_request_id: input.id,
        p_failure_reason: input.failureReason ?? 'External withdrawal failed.',
        p_provider_ref: input.providerRef ?? null,
        p_metadata: input.metadata ?? null,
      };

  const { data, error } = await supabase.rpc(rpcName, args);

  throwIfError('Failed to update external withdrawal request', error);

  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.id) {
    throw new Error('External withdrawal request update did not return a row.');
  }

  return toExternalWithdrawalRequest(row as ExternalWithdrawalRequestRow);
}
