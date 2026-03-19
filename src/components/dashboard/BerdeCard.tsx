'use client';

import { Clock3 } from 'lucide-react';
import BerdeSprite from '@/components/BerdeSprite';
import { getBerdeSubtitle, type BerdeInsight, type BerdeMood } from '../../lib/berde-messages';

interface BerdeCardProps {
  insight: BerdeInsight;
  onClick: () => void;
}

function resolveSpriteState(mood: BerdeMood) {
  if (mood === 'warning') return 'worried' as const;
  if (mood === 'sarcastic') return 'sarcastic' as const;
  if (mood === 'hype') return 'hype' as const;
  if (mood === 'good') return 'proud' as const;
  return 'neutral' as const;
}

export default function BerdeCard({ insight, onClick }: BerdeCardProps) {
  const spriteState = resolveSpriteState(insight.mood);

  return (
    <button
      type="button"
      onClick={onClick}
      className="relative w-full overflow-hidden rounded-[20px] border border-[#0b5b47] px-4 py-4 text-left md:rounded-2xl md:px-5"
      style={{ background: '#0F6E56' }}
      aria-label="Open Berde insights drawer"
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
          <BerdeSprite state={spriteState} size={60} animated={false} />
        </div>

        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.05em] text-emerald-100/90">
            BERDE SAYS
          </p>
          <p className="mt-1 text-sm font-medium leading-snug text-white md:text-[15px]">
            {insight.message}{' '}
            {insight.boldPhrase ? (
              <strong className="font-semibold text-emerald-100">{insight.boldPhrase}</strong>
            ) : null}
          </p>
          <div
            className="mt-[5px] text-[11px] italic"
            style={{ color: 'rgba(255,255,255,0.55)' }}
          >
            {getBerdeSubtitle(insight.mood)}
          </div>
          <div
            className="mt-[7px] flex items-center gap-1 text-[10px]"
            style={{ color: 'rgba(255,255,255,0.4)' }}
          >
            <Clock3 size={10} />
            <span>Berde has more to say - tap to read</span>
          </div>
        </div>
      </div>
    </button>
  );
}
