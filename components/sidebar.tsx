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
      {/* Logo — Vercel Agent: triangle with sparkle */}
      <Link href="/" className="mb-8 w-9 h-9 rounded-lg bg-white flex items-center justify-center relative">
        <svg width="14" height="14" viewBox="0 0 76 65" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M37.5274 0L75.0548 65H0L37.5274 0Z" fill="black" />
        </svg>
        <svg width="8" height="8" viewBox="0 0 16 16" fill="none" className="absolute -top-0.5 -right-0.5">
          <path d="M8 0L9.5 6.5L16 8L9.5 9.5L8 16L6.5 9.5L0 8L6.5 6.5L8 0Z" fill="black" />
        </svg>
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
