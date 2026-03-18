'use client';

import { useState } from 'react';
import BerdeSprite from '@/components/berde/BerdeSprite';
import { getBerdeQuote, resolveBerdeState } from '@/components/berde/berde.logic';
import type { BerdeInputs, BerdeState } from '@/components/berde/berde.types';

interface BerdeCardProps {
  inputs: BerdeInputs;
  className?: string;
}

const STATE_BG: Record<BerdeState, string> = {
  neutral:   'from-[#0F6E56] to-[#1D9E75]',
  proud:     'from-[#085041] to-[#1D9E75]',
  worried:   'from-[#854F0B] to-[#BA7517]',
  hype:      'from-[#26215C] to-[#534AB7]',
  sarcastic: 'from-[#993C1D] to-[#D85A30]',
};

export default function BerdeCard({ inputs, className = '' }: BerdeCardProps) {
  const { state, quote, triggerReason } = resolveBerdeState(inputs);
  const [quoteIdx, setQuoteIdx] = useState(0);
  const [flashing, setFlashing] = useState(false);
  const displayQuote = quoteIdx === 0 ? quote : getBerdeQuote(state, quoteIdx);

  const cycleQuote = () => {
    setQuoteIdx((prev) => prev + 1);
    setFlashing(true);
    window.setTimeout(() => setFlashing(false), 120);
  };

  return (
    <div
      className={`
        relative overflow-hidden rounded-2xl px-4 py-4 cursor-pointer
        bg-gradient-to-br ${STATE_BG[state]}
        transition-all duration-500
        ${flashing ? 'brightness-150' : ''}
        ${className}
      `}
      onClick={cycleQuote}
      role="button"
      aria-label="Tap to hear what Berde has to say"
    >
      {/* Decorative circles */}
      <div className="absolute -top-5 -right-5 w-20 h-20 rounded-full bg-white/5 pointer-events-none" />
      <div className="absolute -bottom-8 right-10 w-16 h-16 rounded-full bg-white/[0.03] pointer-events-none" />

      <div className="relative z-10 flex flex-col items-center gap-3 sm:flex-row sm:items-center sm:gap-4">
        <div className="shrink-0">
          <BerdeSprite state={state} size={64} animated />
        </div>

        <div className="w-full min-w-0 flex-1">
          <p className="mb-1 text-center text-[10px] font-semibold uppercase tracking-widest text-emerald-300 sm:text-left">
            Berde says
          </p>
          <p className="break-words text-center text-sm leading-relaxed text-emerald-50 sm:text-left">
            {displayQuote}
          </p>
          <p className="mt-1.5 break-words text-center text-[10px] text-emerald-400 sm:text-left">
            {triggerReason} · tap for more
          </p>
        </div>
      </div>
    </div>
  );
}
