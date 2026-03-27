'use client';

import { useEffect, useState } from 'react';

const NET_WORTH_VISIBILITY_KEY = 'moneda_nw_visible';

function parseStoredVisibility(value: string | null): boolean {
  if (value === null) return true;
  return value !== 'false';
}

export function useNetWorthVisibility() {
  const [visible, setVisible] = useState(true);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const storedValue = window.localStorage.getItem(NET_WORTH_VISIBILITY_KEY);
      setVisible(parseStoredVisibility(storedValue));
    } catch {
      setVisible(true);
    } finally {
      setHydrated(true);
    }
  }, []);

  const toggle = () => {
    setVisible((currentValue) => {
      const nextValue = !currentValue;

      try {
        window.localStorage.setItem(NET_WORTH_VISIBILITY_KEY, String(nextValue));
      } catch {
        // Ignore persistence failures and keep the in-memory preference.
      }

      return nextValue;
    });
  };

  return {
    visible,
    toggle,
    hydrated,
  };
}
