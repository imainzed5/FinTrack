'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Receipt,
  Lightbulb,
  Clock,
  Settings,
} from 'lucide-react';

const navItems = [
  { href: '/dashboard', label: 'Home', icon: LayoutDashboard },
  { href: '/transactions', label: 'Transactions', icon: Receipt },
  { href: '/insights', label: 'Insights', icon: Lightbulb },
  { href: '/timeline', label: 'Timeline', icon: Clock },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 flex justify-center pb-[env(safe-area-inset-bottom)] sm:hidden">
      <nav className="mb-4 flex items-center gap-1 rounded-[28px] border border-zinc-100 bg-white px-2 py-1.5 shadow-[0_8px_32px_rgba(0,0,0,0.12),0_2px_8px_rgba(0,0,0,0.06)] dark:border-zinc-800 dark:bg-zinc-900">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-[3px] rounded-[18px] px-3 py-2 transition-colors ${
                isActive
                  ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400'
                  : 'text-zinc-400 dark:text-zinc-500'
              }`}
            >
              <Icon size={18} strokeWidth={isActive ? 2.5 : 1.8} />
              <span className="text-[10px] font-semibold leading-none">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
