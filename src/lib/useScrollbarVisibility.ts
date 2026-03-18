'use client';

import { useEffect } from 'react';

const SCROLL_TIMEOUT = 5000; // ms before scrollbar fades out

export function useScrollbarVisibility() {
  useEffect(() => {
    let scrollTimeout: NodeJS.Timeout | null = null;

    const handleScroll = () => {
      // Remove fade-out class to show scrollbar
      document.documentElement.classList.remove('scrolling-inactive');

      // Clear existing timeout
      if (scrollTimeout) {
        clearTimeout(scrollTimeout);
      }

      // Add fade-out class after timeout
      scrollTimeout = setTimeout(() => {
        document.documentElement.classList.add('scrolling-inactive');
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
