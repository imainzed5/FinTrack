import test from 'node:test';
import assert from 'node:assert/strict';
import { validateTransferBody } from '@/app/api/transfers/route';
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
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.data.amount, 250.5);
    assert.equal(result.data.fromAccountId, 'a1');
    assert.equal(result.data.toAccountId, 'a2');
  }
});

test('normalizeAccountAction only allows archive and restore', () => {
  assert.equal(normalizeAccountAction('archive'), 'archive');
  assert.equal(normalizeAccountAction('restore'), 'restore');
  assert.equal(normalizeAccountAction('delete'), undefined);
});
