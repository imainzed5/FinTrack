'use client';

import { Plus } from 'lucide-react';

interface FABProps {
  onClick: () => void;
}

export default function FloatingAddButton({ onClick }: FABProps) {
  return (
    <button
      onClick={onClick}
      className="fixed bottom-20 right-4 sm:bottom-8 sm:right-8 z-30 w-14 h-14 bg-emerald-500 hover:bg-emerald-600 text-white rounded-full shadow-lg shadow-emerald-500/30 flex items-center justify-center transition-all hover:scale-105 active:scale-95"
      aria-label="Add expense"
    >
      <Plus size={24} strokeWidth={2.5} />
    </button>
  );
}
