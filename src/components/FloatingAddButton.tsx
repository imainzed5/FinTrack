'use client';

import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';

interface FABProps {
  onClick: () => void;
}

const FAB_TOOLTIP_KEY = 'moneda:add-transaction-fab-tooltip-seen';

export default function FloatingAddButton({ onClick }: FABProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  useEffect(() => {
    let shouldShowTooltip = false;

    try {
      const hasSeenTooltip = window.localStorage.getItem(FAB_TOOLTIP_KEY) === 'true';
      shouldShowTooltip = !hasSeenTooltip;
    } catch {
      shouldShowTooltip = true;
    }

    if (!shouldShowTooltip) return;

    const openTooltipId = window.setTimeout(() => {
      setShowTooltip(true);
    }, 0);

    return () => window.clearTimeout(openTooltipId);
  }, []);

  useEffect(() => {
    if (!showTooltip) return;

    const timeoutId = window.setTimeout(() => {
      setShowTooltip(false);
      try {
        window.localStorage.setItem(FAB_TOOLTIP_KEY, 'true');
      } catch {
        // Ignore localStorage issues.
      }
    }, 7000);

    return () => window.clearTimeout(timeoutId);
  }, [showTooltip]);

  const dismissTooltip = () => {
    setShowTooltip(false);
    try {
      window.localStorage.setItem(FAB_TOOLTIP_KEY, 'true');
    } catch {
      // Ignore localStorage issues.
    }
  };

  const handleClick = () => {
    dismissTooltip();
    onClick();
  };

  return (
    <div className="fixed bottom-20 mobile-fab-offset right-4 sm:bottom-8 sm:right-8 z-30 flex flex-col items-end gap-2">
      {showTooltip && (
        <button
          type="button"
          onClick={dismissTooltip}
          className="rounded-xl bg-zinc-900 text-white px-3 py-2 text-xs font-semibold shadow-lg shadow-zinc-900/20"
        >
          + Transaction
        </button>
      )}

      <button
        onClick={handleClick}
        className="h-14 min-h-14 bg-emerald-500 hover:bg-emerald-600 text-white rounded-full shadow-lg shadow-emerald-500/30 inline-flex items-center gap-2 px-5 transition-all hover:scale-105 active:scale-95"
        aria-label="Add transaction"
      >
        <Plus size={22} strokeWidth={2.5} />
        <span className="text-sm font-semibold">+ Transaction</span>
      </button>
    </div>
  );
}
