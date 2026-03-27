'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { useScrollbarVisibility } from '@/lib/useScrollbarVisibility';

export type ThemePreference = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

function getSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined') {
    return 'light';
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

const ThemeContext = createContext<{
  theme: ThemePreference;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: ThemePreference) => void;
  toggle: () => void;
}>({
  theme: 'system',
  resolvedTheme: 'light',
  setTheme: () => {},
  toggle: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemePreference>(() => {
    if (typeof window === 'undefined') return 'system';
    const stored = localStorage.getItem('moneda-theme');
    return stored === 'light' || stored === 'dark' || stored === 'system'
      ? stored
      : 'system';
  });
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(() => getSystemTheme());
  const resolvedTheme: ResolvedTheme = theme === 'system' ? systemTheme : theme;

  // Initialize scrollbar visibility on mount
  useScrollbarVisibility();

  useEffect(() => {
    if (theme !== 'system') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (event: MediaQueryListEvent) => {
      setSystemTheme(event.matches ? 'dark' : 'light');
    };
    mediaQuery.addEventListener('change', handleChange);

    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('moneda-theme', theme);
    document.documentElement.classList.toggle('dark', resolvedTheme === 'dark');
  }, [theme, resolvedTheme]);

  const setTheme = (nextTheme: ThemePreference) => {
    if (nextTheme === 'system') {
      setSystemTheme(getSystemTheme());
    }

    setThemeState(nextTheme);
  };

  const toggle = () => {
    setThemeState((currentTheme) => {
      if (currentTheme === 'system') {
        return resolvedTheme === 'dark' ? 'light' : 'dark';
      }

      return currentTheme === 'light' ? 'dark' : 'light';
    });
  };

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}
