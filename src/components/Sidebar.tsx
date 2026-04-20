'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronRight,
  Database,
  Shield,
  LayoutDashboard,
  Receipt,
  Lightbulb,
  MessageCircleMore,
  LogOut,
  PiggyBank,
  Settings,
  History,
  Users,
  Wallet,
} from 'lucide-react';

const navSections = [
  {
    label: 'Overview',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/transactions', label: 'Transactions', icon: Receipt },
      { href: '/debts', label: 'Debts & Splits', icon: Users },
      { href: '/insights', label: 'Insights', icon: Lightbulb },
    ],
  },
  {
    label: 'Chat',
    items: [
      { href: '/berde', label: 'Berde', icon: MessageCircleMore },
    ],
  },
  {
    label: 'Plan',
    items: [
      { href: '/savings', label: 'Savings', icon: PiggyBank },
      { href: '/budgets', label: 'Budgets', icon: PiggyBank },
      { href: '/accounts', label: 'Accounts', icon: Wallet },
      { href: '/timeline', label: 'Timeline', icon: History },
    ],
  },
  {
    label: 'Account',
    items: [
      { href: '/settings?section=accounts', label: 'Settings', icon: Settings },
      { href: '/settings?section=security', label: 'Security', icon: Shield },
      { href: '/settings?section=sync-data', label: 'Sync & Data', icon: Database },
      { href: '/settings?section=payday', label: 'Payday', icon: Wallet },
    ],
  },
];

type SidebarSectionLabel = (typeof navSections)[number]['label'];

interface SidebarViewer {
  displayName: string;
  email: string | null;
  authenticated: boolean;
  storageCopy: string;
}

interface SidebarProps {
  viewer: SidebarViewer;
  onLoggedOut: () => Promise<void>;
}

function getInitials(name: string): string {
  const words = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) return 'FT';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[1][0]}`.toUpperCase();
}

export default function Sidebar({ viewer, onLoggedOut }: SidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [collapsedSections, setCollapsedSections] = useState<
    Record<SidebarSectionLabel, boolean>
  >({
    Overview: false,
    Chat: false,
    Plan: false,
    Account: false,
  });
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);

  const displayName = useMemo(() => viewer.displayName.trim() || 'Moneda', [viewer.displayName]);
  const initials = useMemo(() => getInitials(displayName), [displayName]);

  const activeHref = useMemo(() => {
    const section = searchParams.get('section');
    return pathname === '/settings' && section ? `/settings?section=${section}` : pathname;
  }, [pathname, searchParams]);

  const toggleSection = (label: SidebarSectionLabel) => {
    setCollapsedSections((current) => ({
      ...current,
      [label]: !current[label],
    }));
  };

  useEffect(() => {
    if (!isMenuOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!menuRef.current) return;
      if (event.target instanceof Node && menuRef.current.contains(event.target)) return;
      setIsMenuOpen(false);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsMenuOpen(false);
      }
    };

    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleEscape);

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isMenuOpen]);

  const handleLogout = async () => {
    if (isLoggingOut) return;

    setIsLoggingOut(true);
    setLogoutError('');

    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
      });

      const data = (await response.json().catch(() => null)) as {
        success?: boolean;
        error?: string;
        redirectTo?: string;
      } | null;

      if (!response.ok || !data?.success) {
        setLogoutError(data?.error || 'Unable to log out right now. Please try again.');
        return;
      }

      setIsMenuOpen(false);
      await onLoggedOut();
      router.push(data?.redirectTo || '/auth/login');
      router.refresh();
    } catch {
      setLogoutError('Network error. Please try again.');
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <aside className="fixed left-0 top-0 hidden h-screen w-60 flex-col border-r border-black/[0.07] bg-white sm:flex">
      <div className="flex items-center gap-2.5 px-4 pt-5 pb-5">
        <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center shrink-0">
          <Wallet size={16} className="text-white" />
        </div>
        <div>
          <p className="text-sm font-semibold text-zinc-900 leading-tight">Moneda</p>
          <p className="text-[10px] text-zinc-500 leading-tight">
            Financial Intelligence
          </p>
        </div>
      </div>

      <nav className="flex-1 px-3 py-2 overflow-y-auto">
        {navSections.map((section) => (
          <div key={section.label} className="mb-4">
            <button
              type="button"
              onClick={() => toggleSection(section.label)}
              className="mb-1 flex w-full cursor-pointer items-center px-3 text-[10px] tracking-widest font-medium text-zinc-500 uppercase"
              aria-expanded={!collapsedSections[section.label]}
            >
              <span>{section.label}</span>
            </button>

            <div className={collapsedSections[section.label] ? 'hidden' : 'block'}>
              {section.items.map((item) => {
                const isActive = item.href === activeHref;
                const Icon = item.icon;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`mb-0.5 flex items-center gap-[9px] rounded-lg px-2 py-[7px] text-[13.5px] ${
                      isActive
                        ? 'bg-[#1D9E75] text-white font-medium'
                        : 'text-zinc-600 font-normal hover:bg-black/5 hover:text-zinc-900'
                    }`}
                  >
                    <Icon
                      size={15}
                      strokeWidth={isActive ? 2.5 : 1.5}
                      className={isActive ? 'opacity-90' : 'opacity-60'}
                    />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="px-3 py-3">
        <div ref={menuRef} className="relative mx-0 mt-2 rounded-lg border border-black/[0.08] bg-white/50 p-2">
          {viewer.authenticated && isMenuOpen ? (
            <div className="absolute bottom-[calc(100%+0.5rem)] left-0 right-0 rounded-lg border border-black/[0.08] bg-white p-2 shadow-lg">
              <div className="border-b border-zinc-100 px-2 pb-2">
                <p className="text-[11px] uppercase tracking-wide text-zinc-400">
                  Signed in as
                </p>
                <p className="truncate text-xs font-medium text-zinc-700">
                  {viewer.email}
                </p>
              </div>
              <button
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="mt-2 inline-flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm font-medium text-rose-600 transition-colors hover:bg-rose-50 disabled:cursor-not-allowed disabled:text-rose-300"
              >
                {isLoggingOut ? 'Logging out...' : 'Log out'}
                <LogOut size={16} />
              </button>
              {logoutError ? (
                <p className="px-2 pt-1 text-xs text-rose-600">{logoutError}</p>
              ) : null}
            </div>
          ) : null}

          {viewer.authenticated ? (
            <button
              onClick={() => {
                setIsMenuOpen((previous) => !previous);
                setLogoutError('');
              }}
              className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-black/5"
              aria-expanded={isMenuOpen}
              aria-haspopup="menu"
            >
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#1D9E75] text-[11px] font-medium text-white">
                {initials}
              </div>
              <div className="min-w-0 flex-1 text-left">
                <p className="truncate text-[12.5px] font-medium leading-tight text-zinc-900">
                  {displayName}
                </p>
                <p className="truncate text-[11px] leading-tight text-zinc-500">
                  {viewer.email}
                </p>
              </div>
              <ChevronRight
                size={13}
                className="shrink-0 text-zinc-900 opacity-35"
              />
            </button>
          ) : (
            <div className="rounded-2xl border border-amber-200 bg-amber-50/90 px-3 py-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
                  {initials}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-medium leading-tight text-zinc-900 dark:text-zinc-100">
                    {displayName}
                  </p>
                  <p className="truncate text-[11px] leading-tight text-zinc-500 dark:text-zinc-400">
                    {viewer.storageCopy}
                  </p>
                </div>
              </div>

              <Link
                href="/settings?section=sync-data"
                className="mt-3 inline-flex min-h-10 w-full items-center justify-center rounded-xl border border-amber-300 bg-white/80 px-3 text-xs font-semibold uppercase tracking-[0.12em] text-amber-900 transition-colors hover:bg-white"
              >
                Add backup and sync
              </Link>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
