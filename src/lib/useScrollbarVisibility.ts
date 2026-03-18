'use client';

import { useEffect } from 'react';

const SCROLL_TIMEOUT = 1000; // ms before scrollbar fades out

export function useScrollbarVisibility() {
  useEffect(() => {
    let scrollTimeout: NodeJS.Timeout | null = null;

    const handleScroll = () => {
      // Add scrolling class to document element
      document.documentElement.classList.add('scrolling');

      // Clear existing timeout
      if (scrollTimeout) {
        clearTimeout(scrollTimeout);
      }

      // Remove scrolling class after timeout
      scrollTimeout = setTimeout(() => {
        document.documentElement.classList.remove('scrolling');
      }, SCROLL_TIMEOUT);
    };

    // Attach scroll listener to window
    window.addEventListener('scroll', handleScroll, { passive: true });

    // Cleanup
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (scrollTimeout) {
        clearTimeout(scrollTimeout);
      }
    };
  }, []);
}
