'use client';

import { useEffect, useId, useMemo, useState } from 'react';
import { ArrowLeftRight, Wallet, X } from 'lucide-react';

interface AccountOption {
  id: string;
  name: string;
  type: string;
  computedBalance: number;
  isSystemCashWallet?: boolean;
}

type TransferMode = 'transfer' | 'withdraw';
type WithdrawDestinationType = 'cash' | 'internal' | 'external';

interface TransferModalResult {
  kind: 'transfer' | 'external-request';
  message?: string;
  externalWithdrawalRequestId?: string;
}

interface TransferModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (result?: TransferModalResult) => void;
  mode?: TransferMode;
  initialFromAccountId?: string;
  onRequestRecordExpense?: (payload: { accountId: string; transferGroupId?: string }) => void;
}

function formatPeso(amount: number): string {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function estimateExternalFee(amount: number): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  return Number(Math.min(Math.max(amount * 0.01, 15), 75).toFixed(2));
}

function estimateExternalEta(dateValue: string): string {
  const eta = new Date(dateValue);
  eta.setDate(eta.getDate() + 1);
  eta.setHours(18, 0, 0, 0);
  return eta.toISOString();
}

function formatEta(value: string): string {
  return new Intl.DateTimeFormat('en-PH', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

export default function TransferModal({
  open,
  onClose,
  onCreated,
  mode = 'transfer',
  initialFromAccountId,
  onRequestRecordExpense,
}: TransferModalProps) {
  const titleId = useId();
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [fromAccountId, setFromAccountId] = useState('');
  const [toAccountId, setToAccountId] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [destinationType, setDestinationType] = useState<WithdrawDestinationType>('cash');
  const [externalDestinationSummary, setExternalDestinationSummary] = useState('');
  const [recordAsExpense, setRecordAsExpense] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cashWallet = useMemo(
    () =>
      accounts.find((account) => account.isSystemCashWallet) ??
      accounts.find((account) => account.name === 'Cash' && account.type === 'Cash') ??
      null,
    [accounts]
  );

  const fromAccount = useMemo(
    () => accounts.find((account) => account.id === fromAccountId) ?? null,
    [accounts, fromAccountId]
  );

  const toAccount = useMemo(
    () => accounts.find((account) => account.id === toAccountId) ?? null,
    [accounts, toAccountId]
  );

  const internalDestinationAccounts = useMemo(
    () => accounts.filter((account) => account.id !== fromAccountId && !account.isSystemCashWallet),
    [accounts, fromAccountId]
  );

  const cashDestinationAvailable = Boolean(cashWallet && cashWallet.id !== fromAccountId);
  const amountValue = Number(amount);
  const hasPositiveAmount = Number.isFinite(amountValue) && amountValue > 0;
  const externalFee = estimateExternalFee(amountValue);
  const externalNetAmount = hasPositiveAmount ? Number((amountValue - externalFee).toFixed(2)) : 0;
  const externalEta = estimateExternalEta(date);
  const projectedBalance = fromAccount && hasPositiveAmount
    ? Number((fromAccount.computedBalance - amountValue).toFixed(2))
    : fromAccount?.computedBalance ?? null;
  const insufficientBalance = fromAccount !== null && hasPositiveAmount && projectedBalance !== null && projectedBalance < -0.005;
  const requiresExternalDestination = mode === 'withdraw' && destinationType === 'external';

  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    async function fetchAccounts() {
      try {
        const res = await fetch('/api/accounts', { cache: 'no-store' });
        if (!res.ok) return;

        const json = (await res.json()) as AccountOption[];
        if (cancelled) return;

        const nextAccounts = Array.isArray(json) ? json : [];
        const preferredFromAccountId = nextAccounts.some((account) => account.id === initialFromAccountId)
          ? initialFromAccountId ?? ''
          : nextAccounts[0]?.id ?? '';
        const preferredCashWallet = nextAccounts.find((account) => account.isSystemCashWallet) ??
          nextAccounts.find((account) => account.name === 'Cash' && account.type === 'Cash') ??
          null;

        setAccounts(nextAccounts);
        setError(null);
        setAmount('');
        setNotes('');
        setRecordAsExpense(false);
        setExternalDestinationSummary('');
        setDate(new Date().toISOString().split('T')[0]);

        if (mode === 'withdraw') {
          const nextDestinationType: WithdrawDestinationType = preferredCashWallet && preferredCashWallet.id !== preferredFromAccountId
            ? 'cash'
            : 'internal';
          const fallbackInternal = nextAccounts.find((account) => account.id !== preferredFromAccountId && !account.isSystemCashWallet);

          setFromAccountId(preferredFromAccountId);
          setDestinationType(nextDestinationType);
          setToAccountId(
            nextDestinationType === 'cash'
              ? (preferredCashWallet?.id ?? '')
              : (fallbackInternal?.id ?? '')
          );
          return;
        }

        const fallbackToAccountId = nextAccounts.find((account) => account.id !== preferredFromAccountId)?.id ?? '';
        setFromAccountId(preferredFromAccountId);
        setToAccountId(fallbackToAccountId);
      } catch {
        if (!cancelled) {
          setAccounts([]);
        }
      }
    }

    void fetchAccounts();
    return () => {
      cancelled = true;
    };
  }, [initialFromAccountId, mode, open]);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose, open]);

  useEffect(() => {
    if (!open || mode !== 'withdraw') return;

    if (!cashDestinationAvailable && destinationType === 'cash') {
      setDestinationType('internal');
      return;
    }

    if (destinationType === 'cash') {
      const nextCashWalletId = cashWallet?.id ?? '';
      if (nextCashWalletId && toAccountId !== nextCashWalletId) {
        setToAccountId(nextCashWalletId);
      }
      return;
    }

    if (destinationType === 'internal') {
      if (
        !toAccountId ||
        toAccountId === fromAccountId ||
        accounts.some((account) => account.id === toAccountId && account.isSystemCashWallet)
      ) {
        setToAccountId(internalDestinationAccounts[0]?.id ?? '');
      }
      return;
    }

    setToAccountId('');
  }, [
    accounts,
    cashDestinationAvailable,
    cashWallet,
    destinationType,
    fromAccountId,
    internalDestinationAccounts,
    mode,
    open,
    toAccountId,
  ]);

  useEffect(() => {
    if (!open || mode !== 'transfer') return;

    if (!toAccountId || toAccountId === fromAccountId) {
      setToAccountId(accounts.find((account) => account.id !== fromAccountId)?.id ?? '');
    }
  }, [accounts, fromAccountId, mode, open, toAccountId]);

  if (!open) return null;

  const canSubmit =
    hasPositiveAmount &&
    fromAccountId.length > 0 &&
    (requiresExternalDestination ? externalDestinationSummary.trim().length > 0 : toAccountId.length > 0) &&
    (requiresExternalDestination || fromAccountId !== toAccountId) &&
    !insufficientBalance &&
    (!requiresExternalDestination || externalNetAmount > 0);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!canSubmit) {
      if (insufficientBalance) {
        setError('This withdrawal would overdraw the selected account.');
      } else if (requiresExternalDestination && externalNetAmount <= 0) {
        setError('Amount must be greater than the estimated payout fee.');
      } else if (requiresExternalDestination) {
        setError('Enter where this payout should be sent.');
      } else {
        setError('Choose different accounts and enter a positive amount.');
      }
      return;
    }

    setLoading(true);
    try {
      if (requiresExternalDestination) {
        const res = await fetch('/api/external-withdrawals', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fromAccountId,
            amount: Number(amountValue.toFixed(2)),
            feeAmount: externalFee,
            etaAt: externalEta,
            destinationSummary: externalDestinationSummary.trim(),
            notes: notes.trim() || undefined,
            metadata: {
              flow: mode,
              destinationType,
            },
          }),
        });

        const payload = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(payload.error || 'Failed to create external withdrawal request.');
        }

        setAmount('');
        setNotes('');
        setExternalDestinationSummary('');
        onCreated({
          kind: 'external-request',
          externalWithdrawalRequestId: typeof payload.id === 'string' ? payload.id : undefined,
          message: typeof payload.etaAt === 'string'
            ? `External withdrawal is pending. Estimated arrival: ${formatEta(payload.etaAt)}.`
            : 'External withdrawal is pending.',
        });
        onClose();
        return;
      }

      const res = await fetch('/api/transfers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromAccountId,
          toAccountId,
          amount: Number(amountValue.toFixed(2)),
          date: new Date(date).toISOString(),
          notes: notes.trim() || undefined,
          metadata: {
            flow: mode,
            destinationType: mode === 'withdraw' ? destinationType : 'internal',
          },
        }),
      });

      const payload = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(payload.error || 'Failed to create transfer.');
      }

      if (mode === 'withdraw' && destinationType === 'cash' && recordAsExpense && toAccountId) {
        onRequestRecordExpense?.({
          accountId: toAccountId,
          transferGroupId: typeof payload.transferGroupId === 'string' ? payload.transferGroupId : undefined,
        });
      }

      setAmount('');
      setNotes('');
      setRecordAsExpense(false);
      onCreated({ kind: 'transfer' });
      onClose();
    } catch (transferError) {
      setError(transferError instanceof Error ? transferError.message : 'Failed to create transfer.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <form
        onSubmit={handleSubmit}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative flex w-full max-w-sm flex-col gap-2 rounded-3xl bg-zinc-100 p-3 dark:bg-zinc-900"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {mode === 'withdraw'
              ? <Wallet size={16} className="text-emerald-600" />
              : <ArrowLeftRight size={16} className="text-emerald-600" />}
            <p id={titleId} className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
              {mode === 'withdraw' ? 'Withdraw funds' : 'Transfer funds'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-full border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-800"
          >
            <X className="h-3.5 w-3.5 text-zinc-500" />
          </button>
        </div>

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400">
            {error}
          </div>
        )}

        <div className="space-y-2.5 rounded-2xl border border-zinc-200 bg-white px-3.5 py-3 dark:border-zinc-700 dark:bg-zinc-800">
          {mode === 'withdraw' && (
            <>
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
                {destinationType === 'cash'
                  ? 'This moves money to your Cash wallet. It is not counted as spending until you log the expense.'
                  : destinationType === 'external'
                    ? 'External payouts stay pending until they are confirmed. Your account balance does not change yet.'
                    : 'This moves money out of this account without recording a spending event.'}
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-zinc-400">Destination</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    disabled={!cashDestinationAvailable}
                    onClick={() => setDestinationType('cash')}
                    className={`h-9 rounded-lg border px-2 text-xs font-medium transition-colors ${
                      destinationType === 'cash'
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
                        : 'border-zinc-200 bg-zinc-50 text-zinc-600 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300'
                    }`}
                  >
                    Cash
                  </button>
                  <button
                    type="button"
                    onClick={() => setDestinationType('internal')}
                    className={`h-9 rounded-lg border px-2 text-xs font-medium transition-colors ${
                      destinationType === 'internal'
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
                        : 'border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300'
                    }`}
                  >
                    Internal
                  </button>
                  <button
                    type="button"
                    onClick={() => setDestinationType('external')}
                    className={`h-9 rounded-lg border px-2 text-xs font-medium transition-colors ${
                      destinationType === 'external'
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
                        : 'border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300'
                    }`}
                  >
                    External
                  </button>
                </div>
              </div>
            </>
          )}

          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-zinc-400">From account</label>
            <select
              value={fromAccountId}
              onChange={(event) => setFromAccountId(event.target.value)}
              className="h-9 rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 text-xs dark:border-zinc-700 dark:bg-zinc-900"
            >
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name} ({account.type})
                </option>
              ))}
            </select>
          </div>

          {mode === 'withdraw' && destinationType === 'cash' ? (
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-zinc-400">To account</label>
              <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-2 text-xs text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
                {toAccount ? `${toAccount.name} (${toAccount.type})` : 'Cash wallet unavailable'}
              </div>
            </div>
          ) : mode === 'withdraw' && destinationType === 'external' ? (
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-zinc-400">Payout destination</label>
              <input
                type="text"
                value={externalDestinationSummary}
                onChange={(event) => setExternalDestinationSummary(event.target.value)}
                placeholder="e.g., BPI ending 4821"
                className="h-9 rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 text-xs dark:border-zinc-700 dark:bg-zinc-900"
              />
              <p className="text-[10px] text-zinc-400">
                Saved recipients and provider integration can be added on top of this pending flow later.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-zinc-400">To account</label>
              <select
                value={toAccountId}
                onChange={(event) => setToAccountId(event.target.value)}
                className="h-9 rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 text-xs dark:border-zinc-700 dark:bg-zinc-900"
              >
                {(mode === 'withdraw' ? internalDestinationAccounts : accounts.filter((account) => account.id !== fromAccountId)).map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name} ({account.type})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between gap-2">
                <label className="text-[10px] text-zinc-400">Amount</label>
                {mode === 'withdraw' && fromAccount && fromAccount.computedBalance > 0 && (
                  <button
                    type="button"
                    onClick={() => setAmount(fromAccount.computedBalance.toFixed(2))}
                    className="text-[10px] font-medium text-emerald-600"
                  >
                    Withdraw all
                  </button>
                )}
              </div>
              <input
                type="number"
                inputMode="decimal"
                min="0.01"
                step="0.01"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder="0.00"
                className="h-9 rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 text-xs dark:border-zinc-700 dark:bg-zinc-900"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-zinc-400">Date</label>
              <input
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                className="h-9 rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 text-xs dark:border-zinc-700 dark:bg-zinc-900"
              />
            </div>
          </div>

          {fromAccount && (
            <div className={`rounded-2xl border px-3 py-2 text-xs ${
              insufficientBalance
                ? 'border-red-200 bg-red-50 text-red-600 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400'
                : 'border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300'
            }`}>
              <div className="flex items-center justify-between">
                <span>Current balance</span>
                <span className="font-medium">{formatPeso(fromAccount.computedBalance)}</span>
              </div>
              <div className="mt-1 flex items-center justify-between">
                <span>{requiresExternalDestination ? 'Pending balance after approval' : `After ${mode === 'withdraw' ? 'withdrawal' : 'transfer'}`}</span>
                <span className="font-medium">{formatPeso(projectedBalance ?? fromAccount.computedBalance)}</span>
              </div>
              {requiresExternalDestination && (
                <>
                  <div className="mt-1 flex items-center justify-between">
                    <span>Estimated fee</span>
                    <span className="font-medium">{formatPeso(externalFee)}</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between">
                    <span>Estimated net payout</span>
                    <span className="font-medium">{formatPeso(externalNetAmount)}</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between">
                    <span>Estimated arrival</span>
                    <span className="font-medium">{formatEta(externalEta)}</span>
                  </div>
                </>
              )}
              {insufficientBalance && (
                <p className="mt-2">This account does not have enough available balance.</p>
              )}
            </div>
          )}

          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-zinc-400">Notes (optional)</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder={
                mode === 'withdraw'
                  ? (requiresExternalDestination ? 'e.g., emergency bank payout' : 'e.g., ATM cash out')
                  : 'e.g., Move savings to digital wallet'
              }
              className="resize-none rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-2 text-xs dark:border-zinc-700 dark:bg-zinc-900"
            />
          </div>

          {mode === 'withdraw' && destinationType === 'cash' && toAccountId && (
            <label className="flex items-start gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
              <input
                type="checkbox"
                checked={recordAsExpense}
                onChange={(event) => setRecordAsExpense(event.target.checked)}
                className="mt-0.5 h-3.5 w-3.5 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500"
              />
              <span>Record as expense now after this transfer completes.</span>
            </label>
          )}
        </div>

        <button
          type="submit"
          disabled={loading || !canSubmit || accounts.length < 2}
          className="h-10 rounded-full bg-emerald-500 text-sm font-medium text-white hover:bg-emerald-600 disabled:opacity-60"
        >
          {loading
            ? (requiresExternalDestination ? 'Creating pending payout...' : mode === 'withdraw' ? 'Creating withdrawal...' : 'Transferring...')
            : (requiresExternalDestination ? 'Create pending payout' : mode === 'withdraw' ? 'Create withdrawal' : 'Create transfer')}
        </button>
      </form>
    </div>
  );
}
