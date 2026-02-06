'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Play, Zap, User, FileVideo, Shield } from 'lucide-react';
import { useGeneration } from './generation-context';
import { cn } from '@/lib/utils';

interface SidebarProps {
  user: { username: string; name: string; isAdmin?: boolean } | null;
}

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname();
  const { activeDraftCount } = useGeneration();

  const links = [
    { href: '/', icon: Play, label: 'Feed' },
    { href: '/storyboard', icon: Zap, label: 'Storyboard' },
    ...(user ? [{ href: '/profile', icon: User, label: 'Profile' }] : []),
  ];

  return (
    <aside className="fixed left-0 top-0 h-full w-[60px] border-r border-[#222] bg-black flex flex-col items-center py-4 z-50">
      {/* Logo — Vercel Agent */}
      <Link href="/" className="mb-8 w-9 h-9 rounded-lg bg-white flex items-center justify-center">
        <svg width="20" height="20" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M2 11.6426C2.69036 11.6426 3.25 12.2022 3.25 12.8926C3.24987 13.5828 2.69027 14.1426 2 14.1426C1.30973 14.1426 0.750132 13.5828 0.75 12.8926C0.75 12.2022 1.30964 11.6426 2 11.6426ZM6 11.6426C6.69036 11.6426 7.25 12.2022 7.25 12.8926C7.24987 13.5828 6.69027 14.1426 6 14.1426C5.30973 14.1426 4.75013 13.5828 4.75 12.8926C4.75 12.2022 5.30964 11.6426 6 11.6426ZM10 11.6426C10.6904 11.6426 11.25 12.2022 11.25 12.8926C11.2499 13.5828 10.6903 14.1426 10 14.1426C9.30973 14.1426 8.75013 13.5828 8.75 12.8926C8.75 12.2022 9.30964 11.6426 10 11.6426ZM14 11.6426C14.6904 11.6426 15.25 12.2022 15.25 12.8926C15.2499 13.5828 14.6903 14.1426 14 14.1426C13.3097 14.1426 12.7501 13.5828 12.75 12.8926C12.75 12.2022 13.3096 11.6426 14 11.6426ZM4 8.17871C4.69036 8.17871 5.25 8.73836 5.25 9.42871C5.24974 10.1188 4.69019 10.6787 4 10.6787C3.30981 10.6787 2.75026 10.1188 2.75 9.42871C2.75 8.73836 3.30964 8.17871 4 8.17871ZM8 8.17871C8.69036 8.17871 9.25 8.73836 9.25 9.42871C9.24974 10.1188 8.69019 10.6787 8 10.6787C7.30981 10.6787 6.75026 10.1188 6.75 9.42871C6.75 8.73836 7.30964 8.17871 8 8.17871ZM12 8.17871C12.6904 8.17871 13.25 8.73836 13.25 9.42871C13.2497 10.1188 12.6902 10.6787 12 10.6787C11.3098 10.6787 10.7503 10.1188 10.75 9.42871C10.75 8.73836 11.3096 8.17871 12 8.17871ZM6 4.71387C6.69027 4.71387 7.24987 5.27362 7.25 5.96387C7.25 6.65422 6.69036 7.21387 6 7.21387C5.30964 7.21387 4.75 6.65422 4.75 5.96387C4.75013 5.27362 5.30973 4.71387 6 4.71387ZM10 4.71387C10.6903 4.71387 11.2499 5.27362 11.25 5.96387C11.25 6.65422 10.6904 7.21387 10 7.21387C9.30964 7.21387 8.75 6.65422 8.75 5.96387C8.75013 5.27362 9.30973 4.71387 10 4.71387ZM8 1.25C8.69036 1.25 9.25 1.80964 9.25 2.5C9.25 3.19036 8.69036 3.75 8 3.75C7.30964 3.75 6.75 3.19036 6.75 2.5C6.75 1.80964 7.30964 1.25 8 1.25Z" fill="black" />
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

        {/* Drafts — always visible for authenticated users */}
        {user && (
          <Link
            href="/drafts"
            title="Drafts"
            className={cn(
              'w-10 h-10 rounded-lg flex items-center justify-center transition-colors relative',
              pathname === '/drafts'
                ? 'bg-[#222] text-white'
                : 'text-[#555] hover:text-white hover:bg-[#111]'
            )}
          >
            <FileVideo className="h-5 w-5" />
            {activeDraftCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 h-4 min-w-[16px] px-1 rounded-full bg-[#0070f3] text-[10px] font-bold text-white flex items-center justify-center">
                {activeDraftCount}
              </span>
            )}
          </Link>
        )}
        {/* Admin — only visible to admins */}
        {user?.isAdmin && (
          <Link
            href="/admin"
            title="Admin"
            className={cn(
              'w-10 h-10 rounded-lg flex items-center justify-center transition-colors',
              pathname === '/admin'
                ? 'bg-[#222] text-white'
                : 'text-[#555] hover:text-white hover:bg-[#111]'
            )}
          >
            <Shield className="h-5 w-5" />
          </Link>
        )}
      </nav>

      {/* Bottom */}
      <div className="flex flex-col items-center gap-1">
        {!user && (
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
