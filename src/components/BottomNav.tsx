'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Receipt,
  Lightbulb,
  PiggyBank,
  Settings,
} from 'lucide-react';

const navItems = [
  { href: '/dashboard', label: 'Home', icon: LayoutDashboard },
  { href: '/transactions', label: 'Transactions', icon: Receipt },
  { href: '/insights', label: 'Insights', icon: Lightbulb },
  { href: '/savings', label: 'Savings', icon: PiggyBank },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <div className="bottom-nav fixed bottom-0 left-0 right-0 z-40 flex justify-center pb-[env(safe-area-inset-bottom)] sm:hidden">
      <nav className="mb-4 flex items-center justify-around gap-0.5 rounded-[28px] border border-zinc-200 bg-white px-2 py-1 shadow-[0_10px_30px_rgba(0,0,0,0.12),0_2px_8px_rgba(0,0,0,0.08)] dark:border-zinc-800 dark:bg-zinc-900">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-[3px] px-3 py-2 rounded-xl transition-colors min-w-0 ${
                isActive
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-zinc-400 dark:text-zinc-500'
              }`}
            >
              <Icon size={19} strokeWidth={isActive ? 2.5 : 1.5} />
              <span
                className={`text-[10px] leading-none font-medium truncate ${
                  isActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-400 dark:text-zinc-500'
                }`}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
