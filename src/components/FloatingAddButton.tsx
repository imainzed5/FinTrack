'use client';

import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';

interface FABProps {
  onClick: () => void;
  visible?: boolean;
  topCategories?: string[];
  onCategorySelect?: (category: string) => void;
  compactOnMobile?: boolean;
}

const FAB_TOOLTIP_KEY = 'moneda:add-transaction-fab-tooltip-seen';

const CATEGORY_EMOJI: Record<string, string> = {
  Food: '🍔',
  Transport: '🚌',
  Transportation: '🚌',
  School: '📚',
  Education: '📚',
  Entertainment: '🎮',
  Shopping: '🛍️',
  Health: '💊',
  Bills: '📋',
  Utilities: '📋',
  Subscriptions: '📱',
  Savings: '🐷',
  Other: '📦',
  Miscellaneous: '📦',
};

export default function FloatingAddButton({
  onClick,
  visible = true,
  topCategories,
  onCategorySelect,
  compactOnMobile = false,
}: FABProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const menuCategories = (topCategories ?? []).slice(0, 5);
  const hasShortcutMenu = menuCategories.length > 0;

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

  useEffect(() => {
    if (visible) return;

    const closeMenuId = window.setTimeout(() => {
      setMenuOpen(false);
    }, 0);

    return () => window.clearTimeout(closeMenuId);
  }, [visible]);

  useEffect(() => {
    if (!menuOpen) return;

    const closeTooltipId = window.setTimeout(() => {
      setShowTooltip(false);
    }, 0);

    return () => window.clearTimeout(closeTooltipId);
  }, [menuOpen]);

  const dismissTooltip = () => {
    setShowTooltip(false);
    try {
      window.localStorage.setItem(FAB_TOOLTIP_KEY, 'true');
    } catch {
      // Ignore localStorage issues.
    }
  };

  const handleFabClick = () => {
    dismissTooltip();

    if (hasShortcutMenu) {
      setMenuOpen((prev) => !prev);
      return;
    }

    onClick();
  };

  const handleCategoryClick = (category: string) => {
    setMenuOpen(false);
    if (onCategorySelect) {
      onCategorySelect(category);
      return;
    }

    onClick();
  };

  const buttonClassName = compactOnMobile
    ? 'relative z-50 inline-flex h-12 min-h-12 items-center gap-2 rounded-full bg-emerald-500 px-4 text-white shadow-lg shadow-emerald-500/30 transition-all hover:scale-105 hover:bg-emerald-600 active:scale-95 sm:h-14 sm:min-h-14 sm:px-5'
    : 'relative z-50 inline-flex h-14 min-h-14 items-center gap-2 rounded-full bg-emerald-500 px-5 text-white shadow-lg shadow-emerald-500/30 transition-all hover:scale-105 hover:bg-emerald-600 active:scale-95';

  return (
    <>
      {menuOpen && (
        <button
          type="button"
          aria-label="Close category shortcuts"
          onClick={() => setMenuOpen(false)}
          className="fixed inset-0 z-40 bg-transparent"
        />
      )}

      <div
        className="fixed bottom-20 mobile-fab-offset right-4 sm:bottom-8 sm:right-8 z-50 flex flex-col items-end gap-2"
        style={{
          opacity: visible ? 1 : 0,
          pointerEvents: visible ? 'auto' : 'none',
          transition: 'opacity 0.2s ease',
        }}
      >
        {menuOpen && hasShortcutMenu && (
          <div className="flex flex-col items-end gap-2">
            <div className="flex flex-col-reverse items-end gap-2">
              {menuCategories.map((category, index) => (
                <button
                  key={category}
                  type="button"
                  onClick={() => handleCategoryClick(category)}
                  className="flex items-center justify-end gap-2 transition-all"
                  style={{
                    opacity: menuOpen ? 1 : 0,
                    transform: menuOpen ? 'translateY(0)' : 'translateY(8px)',
                    transitionDelay: `${index * 45}ms`,
                    transitionDuration: '220ms',
                    pointerEvents: menuOpen ? 'auto' : 'none',
                  }}
                >
                  <span className="whitespace-nowrap rounded-full border border-gray-100 bg-white px-3 py-1 text-xs font-medium text-gray-800 shadow-sm">
                    {category}
                  </span>
                  <span className="flex h-8 w-8 items-center justify-center rounded-full border border-gray-100 bg-white text-sm shadow-sm">
                    {CATEGORY_EMOJI[category] ?? '📦'}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {showTooltip && !menuOpen && (
          <button
            type="button"
            onClick={dismissTooltip}
            className="rounded-xl bg-zinc-900 px-3 py-2 text-xs font-semibold text-white shadow-lg shadow-zinc-900/20"
          >
            Transaction
          </button>
        )}

        <button
          onClick={handleFabClick}
          className={buttonClassName}
          aria-label="Add transaction"
        >
          <Plus
            size={22}
            strokeWidth={2.5}
            className={`transition-transform duration-[250ms] ${menuOpen ? 'rotate-45' : 'rotate-0'}`}
          />
          <span className="text-sm font-semibold">Transaction</span>
        </button>
      </div>
    </>
  );
}
