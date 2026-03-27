import test from 'node:test';
import assert from 'node:assert/strict';
import { validateTransferBody } from '@/app/api/transfers/route';
import { validateExternalWithdrawalBody } from '@/app/api/external-withdrawals/route';
import { normalizeAccountAction } from '@/app/api/accounts/route';

test('validateTransferBody rejects same-account transfers', () => {
  const result = validateTransferBody({
    fromAccountId: 'a1',
    toAccountId: 'a1',
    amount: 100,
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(result.error, /same account/i);
  }
});

test('validateTransferBody accepts valid payload', () => {
  const result = validateTransferBody({
    fromAccountId: 'a1',
    toAccountId: 'a2',
    amount: 250.5,
    notes: 'Move to emergency wallet',
    metadata: {
      flow: 'withdraw',
      destinationType: 'cash',
    },
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.data.amount, 250.5);
    assert.equal(result.data.fromAccountId, 'a1');
    assert.equal(result.data.toAccountId, 'a2');
    assert.equal(result.data.metadata?.flow, 'withdraw');
    assert.equal(result.data.metadata?.destinationType, 'cash');
  }
});

test('validateTransferBody rejects unsupported transfer destinations', () => {
  const result = validateTransferBody({
    fromAccountId: 'a1',
    toAccountId: 'a2',
    amount: 250.5,
    metadata: {
      destinationType: 'external',
    },
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(result.error, /destination/i);
  }
});

test('normalizeAccountAction only allows archive and restore', () => {
  assert.equal(normalizeAccountAction('archive'), 'archive');
  assert.equal(normalizeAccountAction('restore'), 'restore');
  assert.equal(normalizeAccountAction('delete'), undefined);
});

test('validateExternalWithdrawalBody accepts valid pending payout payload', () => {
  const result = validateExternalWithdrawalBody({
    fromAccountId: 'a1',
    amount: 500,
    feeAmount: 15,
    destinationSummary: 'BPI ending 4821',
    metadata: {
      destinationType: 'external',
    },
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.data.amount, 500);
    assert.equal(result.data.feeAmount, 15);
    assert.equal(result.data.destinationSummary, 'BPI ending 4821');
  }
});

test('validateExternalWithdrawalBody rejects fees that consume the payout', () => {
  const result = validateExternalWithdrawalBody({
    fromAccountId: 'a1',
    amount: 50,
    feeAmount: 50,
    destinationSummary: 'BPI ending 4821',
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(result.error, /fee/i);
  }
});
