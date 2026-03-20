'use client';

import { useEffect } from 'react';
import { X } from 'lucide-react';

interface SavingsRatePopupProps {
  open: boolean;
  onClose: () => void;
  savingsRate: number;
  firstName: string;
}

function getSavingsQuote(firstName: string, savingsRate: number): string {
  if (savingsRate >= 30) {
    return `Grabe ka ${firstName}! ${savingsRate}% saved — future-you is literally thanking you right now. Keep it up. 🟢`;
  }

  if (savingsRate >= 15) {
    return `Not bad, ${firstName}! ${savingsRate}% isn't perfect but it's honest. Let's push it higher next month. 💪`;
  }

  if (savingsRate >= 1) {
    return `Okay ${firstName}, ${savingsRate}% is a start. Kahit konti, basta consistent. You got this. 🌱`;
  }

  return `Ay. Negative savings this month, ${firstName}. Happens to everyone — but let's not make it a habit ha? 👀`;
}

export default function SavingsRatePopup({
  open,
  onClose,
  savingsRate,
  firstName,
}: SavingsRatePopupProps) {
  const normalizedRate = Number.isFinite(savingsRate) ? Math.round(savingsRate) : 0;
  const safeFirstName = firstName.trim() || 'friend';

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Savings rate details"
        className="modal-shell w-full max-w-md rounded-t-3xl bg-white p-5 animate-slide-up"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 28px)' }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-900">Savings rate</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close savings rate popup"
            className="rounded-full p-2 text-zinc-500 hover:bg-zinc-100"
          >
            <X size={20} />
          </button>
        </div>

        <div className="text-center">
          <p className="text-[48px] font-bold leading-none text-[#1D9E75]">{normalizedRate}%</p>
          <p className="mt-2 text-sm text-zinc-500">of your budget saved this month</p>
        </div>

        <div className="my-5 h-px bg-zinc-200" />

        <div className="rounded-2xl bg-zinc-50 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#1D9E75]">Berde says</p>
          <p className="mt-2 text-sm leading-relaxed text-zinc-700">
            {getSavingsQuote(safeFirstName, normalizedRate)}
          </p>
        </div>
      </div>
    </div>
  );
}
