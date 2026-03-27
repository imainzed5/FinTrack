'use client';

import { format } from 'date-fns';
import {
  AlertTriangle,
  BarChart3,
  CalendarDays,
  Lightbulb,
  TrendingUp,
  X,
} from 'lucide-react';
import { useEffect, useState, type ComponentType, type ReactNode } from 'react';
import BerdeSprite from '@/components/BerdeSprite';
import {
  type BerdeInsight,
  type BerdeMood,
} from '../../lib/berde-messages';

interface BerdeDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  berdeInsights: BerdeInsight[];
}

const moodTagStyles: Record<
  BerdeMood,
  { background: string; color: string; label: string }
> = {
  good: {
    background: '#E1F5EE',
    color: '#0F6E56',
    label: 'not bad tho',
  },
  sarcastic: {
    background: '#FAEEDA',
    color: '#854F0B',
    label: 'just saying',
  },
  hype: {
    background: '#E6F1FB',
    color: '#185FA5',
    label: 'looking good',
  },
  warning: {
    background: '#FAECE7',
    color: '#993C1D',
    label: 'heads up',
  },
  dry: {
    background: '#F1EFE8',
    color: '#5F5E5A',
    label: 'keeping notes',
  },
};

const moodIconMap: Record<BerdeMood, ComponentType<{ size?: number; className?: string }>> = {
  good: Lightbulb,
  sarcastic: BarChart3,
  hype: TrendingUp,
  warning: AlertTriangle,
  dry: CalendarDays,
};

function InsightRow({ insight }: { insight: BerdeInsight }) {
  const tagStyle = moodTagStyles[insight.mood];
  const Icon = moodIconMap[insight.mood];

  return (
    <article className="flex items-start gap-3 rounded-xl border-[0.5px] border-[color:var(--color-border-tertiary,#d9d7cf)] bg-white p-3.5">
      <div
        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
        style={{
          background: tagStyle.background,
          color: tagStyle.color,
        }}
      >
        <Icon size={14} />
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-sm leading-snug text-zinc-800">
          {insight.message}{' '}
          {insight.boldPhrase ? (
            <strong className="font-semibold text-zinc-900">{insight.boldPhrase}</strong>
          ) : null}
        </p>
        <p className="mt-1 text-xs text-zinc-500">{insight.dataLine}</p>
        <span
          className="mt-2 inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium"
          style={{
            background: tagStyle.background,
            color: tagStyle.color,
          }}
        >
          {tagStyle.label}
        </span>
      </div>
    </article>
  );
}

export default function BerdeDrawer({
  isOpen,
  onClose,
  berdeInsights,
}: BerdeDrawerProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const generatedInsights = berdeInsights;

  useEffect(() => {
    let immediateTimer: number | null = null;
    let hideTimer: number | null = null;
    let firstFrame = 0;
    let secondFrame = 0;

    if (isOpen) {
      immediateTimer = window.setTimeout(() => {
        setIsVisible(true);
        firstFrame = window.requestAnimationFrame(() => {
          secondFrame = window.requestAnimationFrame(() => setIsAnimating(true));
        });
      }, 0);
    } else {
      immediateTimer = window.setTimeout(() => {
        setIsAnimating(false);
      }, 0);
      hideTimer = window.setTimeout(() => setIsVisible(false), 320);
    }

    return () => {
      if (immediateTimer !== null) {
        window.clearTimeout(immediateTimer);
      }
      if (hideTimer !== null) {
        window.clearTimeout(hideTimer);
      }
      if (firstFrame) {
        window.cancelAnimationFrame(firstFrame);
      }
      if (secondFrame) {
        window.cancelAnimationFrame(secondFrame);
      }
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isVisible) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isVisible, onClose]);

  if (!isVisible) {
    return null;
  }

  const drawerContent: ReactNode = (
    <>
      <div className="mx-auto mt-2.5 h-1.5 w-12 rounded-full bg-zinc-300" />

      <div className="flex items-start justify-between gap-3 border-b border-zinc-200 px-4 pb-3 pt-3.5 sm:px-5">
        <div className="flex items-start gap-2.5">
          <div className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[#0F6E56]">
            <BerdeSprite state="neutral" size={22} animated={false} />
          </div>
          <div>
            <h2 className="font-display text-lg text-zinc-900">Berde has thoughts</h2>
            <p className="mt-0.5 text-xs text-zinc-500">
              {format(new Date(), 'MMMM yyyy')} - {generatedInsights.length} things on his mind
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Close Berde thoughts"
          className="ml-auto flex h-7 w-7 items-center justify-center rounded-full transition-colors duration-150 hover:bg-black/5"
          style={{ flexShrink: 0 }}
        >
          <X size={14} className="text-zinc-500" />
        </button>
      </div>

      <div className="max-h-[78vh] space-y-2.5 overflow-y-auto px-4 py-3.5 sm:px-5 sm:py-4">
        {generatedInsights.map((insight, index) => (
          <InsightRow key={`${insight.type}-${index}`} insight={insight} />
        ))}
      </div>
    </>
  );

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center md:items-center"
      style={{
        background: 'rgba(0, 0, 0, 0.35)',
        opacity: isAnimating ? 1 : 0,
        transition: 'opacity 280ms cubic-bezier(0.4, 0, 0.2, 1)',
      }}
      onClick={onClose}
    >
      <div
        className="relative w-full md:hidden"
        style={{
          maxHeight: '78vh',
          borderRadius: '24px 24px 0 0',
          background: '#f5f5f0',
          border: '1px solid #e4e4df',
          borderBottomWidth: 0,
          transform: isAnimating ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 320ms cubic-bezier(0.4, 0, 0.2, 1)',
        }}
        onClick={(event) => event.stopPropagation()}
      >
        {drawerContent}
      </div>

      <div
        className="hidden w-full max-w-lg md:block"
        style={{
          borderRadius: '20px',
          background: '#f5f5f0',
          border: '1px solid #e4e4df',
          maxHeight: '78vh',
          overflowY: 'auto',
          transform: isAnimating ? 'scale(1) translateY(0)' : 'scale(0.96) translateY(8px)',
          opacity: isAnimating ? 1 : 0,
          transition:
            'transform 280ms cubic-bezier(0.4, 0, 0.2, 1), opacity 250ms cubic-bezier(0.4, 0, 0.2, 1)',
        }}
        onClick={(event) => event.stopPropagation()}
      >
        {drawerContent}
      </div>
    </div>
  );
}
