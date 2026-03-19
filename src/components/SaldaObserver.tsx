'use client';

import { useEffect, useState } from 'react';
import SaldaIsland from './SaldaIsland';

const SECTION_MAP: Record<string, 'hero' | 'why' | 'features' | 'how'> = {
  'hero-section': 'hero',
  why: 'why',
  features: 'features',
  how: 'how',
};

export default function SaldaObserver() {
  const [activeSection, setActiveSection] = useState<'hero' | 'why' | 'features' | 'how'>('hero');

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const id = entry.target.id || entry.target.getAttribute('data-salda');
            if (id && SECTION_MAP[id]) {
              setActiveSection(SECTION_MAP[id]);
            }
          }
        }
      },
      {
        threshold: 0.6,
        rootMargin: '0px 0px -40% 0px',
      }
    );

    const targets = document.querySelectorAll('[data-salda]');
    targets.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, []);

  return <SaldaIsland section={activeSection} />;
}
