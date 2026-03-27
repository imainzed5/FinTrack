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
    <div className="bottom-nav fixed bottom-[calc(env(safe-area-inset-bottom)+0.8rem)] left-0 right-0 z-40 flex justify-center px-3 sm:hidden">
      <nav className="relative grid w-full max-w-[21.25rem] grid-cols-5 items-center rounded-[24px] border border-[#e6dccd] bg-[linear-gradient(180deg,rgba(255,251,245,0.97)_0%,rgba(248,242,232,0.96)_100%)] p-1 shadow-[0_12px_26px_rgba(36,31,22,0.11),0_2px_8px_rgba(36,31,22,0.06)] backdrop-blur-md dark:border-zinc-800 dark:bg-[linear-gradient(180deg,rgba(28,28,30,0.96)_0%,rgba(18,18,20,0.96)_100%)]">
        <div className="pointer-events-none absolute inset-x-6 top-1 h-px rounded-full bg-white/70 dark:bg-white/10" />
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`relative z-10 flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-[18px] px-1 py-1.5 transition-all duration-300 ${
                isActive
                  ? 'border border-emerald-200/80 bg-[linear-gradient(180deg,rgba(222,247,237,0.95)_0%,rgba(209,242,230,0.92)_100%)] text-emerald-800 shadow-[0_6px_14px_rgba(29,158,117,0.10)] dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-200'
                  : 'text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200'
              }`}
              aria-current={isActive ? 'page' : undefined}
            >
              <span
                className={`inline-flex h-5.5 w-5.5 items-center justify-center rounded-full transition-all duration-300 ${
                  isActive
                    ? 'bg-white/65 text-emerald-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] dark:bg-emerald-900/50 dark:text-emerald-200'
                    : 'bg-transparent'
                }`}
              >
                <Icon size={15} strokeWidth={isActive ? 2.15 : 1.75} />
              </span>
              <span
                className={`truncate text-[10px] leading-none transition-colors ${
                  isActive
                    ? 'font-semibold tracking-[0.01em] text-emerald-800 dark:text-emerald-200'
                    : 'font-medium text-zinc-500 dark:text-zinc-400'
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
