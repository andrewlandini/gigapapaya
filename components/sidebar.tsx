'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Play, Search, Zap, User, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SidebarProps {
  user: { username: string; name: string } | null;
}

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname();

  const links = [
    { href: '/', icon: Play, label: 'Feed' },
    { href: '/generate', icon: Zap, label: 'Generate' },
    ...(user ? [{ href: '/profile', icon: User, label: 'Profile' }] : []),
  ];

  return (
    <aside className="fixed left-0 top-0 h-full w-[60px] border-r border-[#222] bg-black flex flex-col items-center py-4 z-50">
      {/* Logo */}
      <Link href="/" className="mb-8 w-9 h-9 rounded-lg bg-[#ededed] flex items-center justify-center">
        <span className="text-black font-bold text-sm">gp</span>
      </Link>

      {/* Nav */}
      <nav className="flex-1 flex flex-col items-center gap-1">
        {links.map(({ href, icon: Icon, label }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              title={label}
              className={cn(
                'w-10 h-10 rounded-lg flex items-center justify-center transition-colors',
                active
                  ? 'bg-[#222] text-white'
                  : 'text-[#555] hover:text-white hover:bg-[#111]'
              )}
            >
              <Icon className="h-5 w-5" />
            </Link>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="flex flex-col items-center gap-1">
        {user ? (
          <form action="/api/auth/sign-out" method="POST">
            <button
              type="submit"
              title="Sign out"
              className="w-10 h-10 rounded-lg flex items-center justify-center text-[#555] hover:text-white hover:bg-[#111] transition-colors"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </form>
        ) : (
          <Link
            href="/auth/sign-in"
            title="Sign in"
            className="w-10 h-10 rounded-lg flex items-center justify-center text-[#555] hover:text-white hover:bg-[#111] transition-colors"
          >
            <User className="h-5 w-5" />
          </Link>
        )}
      </div>
    </aside>
  );
}
