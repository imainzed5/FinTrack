'use client';

import { Clock3 } from 'lucide-react';
import BerdeSprite from '@/components/BerdeSprite';
import { type BerdeInsight, type BerdeMood } from '../../lib/berde-messages';

interface BerdeCardProps {
  insight: BerdeInsight;
  quote?: string;
  hasThoughts?: boolean;
  onClick: () => void;
  footerHint?: string;
  ariaLabel?: string;
}

function resolveSpriteState(mood: BerdeMood) {
  if (mood === 'warning') return 'worried' as const;
  if (mood === 'sarcastic') return 'sarcastic' as const;
  if (mood === 'hype') return 'hype' as const;
  if (mood === 'good') return 'proud' as const;
  return 'neutral' as const;
}

export default function BerdeCard({
  insight,
  quote,
  hasThoughts = true,
  onClick,
  footerHint,
  ariaLabel,
}: BerdeCardProps) {
  const spriteState = resolveSpriteState(insight.mood);

  return (
    <button
      type="button"
      onClick={onClick}
      className="relative w-full overflow-hidden rounded-[20px] px-4 py-4 text-left md:rounded-2xl md:px-5 md:py-4"
      style={{ background: '#0F6E56' }}
      aria-label={ariaLabel || 'Open Berde'}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute"
        style={{
          right: -30,
          top: -30,
          width: 120,
          height: 120,
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.06)',
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute"
        style={{
          right: 40,
          bottom: -40,
          width: 90,
          height: 90,
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.04)',
        }}
      />

      <div className="relative z-[1] flex items-center gap-3 md:gap-4">
        <div className="shrink-0 rounded-2xl bg-[#E1F5EE] p-1.5">
          <BerdeSprite state={spriteState} size={60} />
        </div>

        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.05em] text-emerald-100/90">
            BERDE SAYS
          </p>
          <p className="mt-1 text-sm font-medium leading-snug text-white md:text-[15px] md:leading-6">
            {insight.message}{' '}
            {insight.boldPhrase ? (
              <strong className="font-semibold text-emerald-100">{insight.boldPhrase}</strong>
            ) : null}
          </p>
          {quote ? (
            <div
              className="mt-1.5 text-[11px] italic md:text-[12px]"
              style={{ color: 'rgba(255,255,255,0.78)' }}
            >
              {quote}
            </div>
          ) : null}
          <div
            className="mt-2.5 flex items-center gap-1.5 text-[10px] md:text-[11px]"
            style={{ color: 'rgba(255,255,255,0.68)' }}
          >
            <Clock3 size={10} />
            <span>
              {footerHint || (hasThoughts ? 'Berde has more to say - tap to read' : 'Still learning from this device')}
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}
