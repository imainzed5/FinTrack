'use client';

import Link from 'next/link';
import { ArrowLeft, Wallet } from 'lucide-react';
import AccountsSection from '@/components/settings/AccountsSection';

export default function AccountsPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
      <div className="flex items-center gap-2 mb-4">
        <Link
          href="/settings"
          className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
        >
          <ArrowLeft size={13} /> Back to Settings
        </Link>
      </div>

      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
          <Wallet size={20} className="text-zinc-600 dark:text-zinc-400" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold text-zinc-900 dark:text-white">Accounts</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Manage wallets, starting balances, and manual balance adjustments.
          </p>
        </div>
      </div>

      <AccountsSection />
    </div>
  );
}
