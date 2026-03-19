'use client';

import { useRouter } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';
import BerdeSprite from '@/components/BerdeSprite';

interface EmptyStateProps {
  icon: LucideIcon | 'berde';
  headline: string;
  subtext: string;
  cta?: {
    label: string;
    action: 'add-transaction' | 'go-to-settings' | 'clear-filters';
  };
  onAddTransaction?: () => void;
  onClearFilters?: () => void;
}

export default function EmptyState({
  icon,
  headline,
  subtext,
  cta,
  onAddTransaction,
  onClearFilters,
}: EmptyStateProps) {
  const router = useRouter();

  const handleCtaClick = () => {
    if (!cta) return;

    if (cta.action === 'add-transaction') {
      onAddTransaction?.();
      return;
    }

    if (cta.action === 'go-to-settings') {
      router.push('/settings');
      return;
    }

    onClearFilters?.();
  };

  const isCtaDisabled =
    cta?.action === 'add-transaction'
      ? !onAddTransaction
      : cta?.action === 'clear-filters'
        ? !onClearFilters
        : false;

  const Icon = icon === 'berde' ? null : icon;

  return (
    <div className="flex h-full min-h-[12rem] w-full items-center justify-center px-4 py-8 text-center">
      <div className="flex w-full max-w-md flex-col items-center">
        <div className="mb-4">
          {icon === 'berde' ? (
            <BerdeSprite state="neutral" size={64} />
          ) : (
            Icon && <Icon size={40} className="text-zinc-400 dark:text-zinc-500" />
          )}
        </div>

        <h3 className="font-display text-lg font-bold text-zinc-900 dark:text-white sm:text-xl">{headline}</h3>
        <p className="mt-1 max-w-sm font-body text-sm text-zinc-500 dark:text-zinc-400">{subtext}</p>

        {cta && (
          <button
            type="button"
            onClick={handleCtaClick}
            disabled={isCtaDisabled}
            className="mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-emerald-500 px-5 text-sm font-semibold text-white transition-colors hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          >
            {cta.label}
          </button>
        )}
      </div>
    </div>
  );
}
