'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Receipt,
  Lightbulb,
  Clock,
  Settings,
  Wallet,
  Sun,
  Moon,
} from 'lucide-react';
import { useTheme } from './ThemeProvider';

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/transactions', label: 'Transactions', icon: Receipt },
  { href: '/insights', label: 'Insights', icon: Lightbulb },
  { href: '/timeline', label: 'Timeline', icon: Clock },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { theme, toggle } = useTheme();

  return (
    <aside className="hidden sm:flex flex-col w-64 bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 h-screen fixed left-0 top-0">
      <div className="flex items-center gap-3 px-6 py-5 border-b border-zinc-200 dark:border-zinc-800">
        <div className="w-9 h-9 rounded-xl bg-emerald-500 flex items-center justify-center">
          <Wallet size={18} className="text-white" />
        </div>
        <div>
          <h1 className="font-bold text-zinc-900 dark:text-white text-base">FinTrack</h1>
          <p className="text-[10px] text-zinc-400 dark:text-zinc-500">Financial Intelligence</p>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                isActive
                  ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                  : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:text-zinc-700 dark:hover:text-zinc-200'
              }`}
            >
              <Icon size={18} strokeWidth={isActive ? 2.5 : 1.5} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="px-4 py-4 border-t border-zinc-200 dark:border-zinc-800 space-y-3">
        <button
          onClick={toggle}
          className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
        >
          <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
            {theme === 'dark' ? 'Dark Mode' : 'Light Mode'}
          </span>
          {theme === 'dark' ? (
            <Moon size={14} className="text-zinc-500 dark:text-zinc-400" />
          ) : (
            <Sun size={14} className="text-zinc-500" />
          )}
        </button>
        <p className="text-xs text-zinc-400 dark:text-zinc-600 text-center">
          Personal Financial Intelligence
        </p>
      </div>
    </aside>
  );
}
