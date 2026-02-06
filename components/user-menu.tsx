'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { LogOut, Key, User } from 'lucide-react';
import { useAvatar } from './avatar-context';

interface UserMenuProps {
  user: { username: string; name: string; avatarUrl?: string | null } | null;
}

export function UserMenu({ user }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [pwStatus, setPwStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { avatarUrl } = useAvatar();

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setShowPasswordForm(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [open]);

  if (!user) return null;

  const handleChangePassword = async () => {
    if (!currentPw || !newPw || newPw.length < 6) {
      setPwStatus('New password must be at least 6 characters');
      return;
    }
    setSaving(true);
    setPwStatus(null);
    const res = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
    });
    if (res.ok) {
      setPwStatus('Password updated');
      setCurrentPw('');
      setNewPw('');
      setTimeout(() => { setShowPasswordForm(false); setPwStatus(null); }, 1500);
    } else {
      const data = await res.json();
      setPwStatus(data.error || 'Failed to change password');
    }
    setSaving(false);
  };

  return (
    <div className="fixed top-3 right-4 z-[55]" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="w-8 h-8 rounded-full overflow-hidden border border-[#333] hover:border-[#555] transition-colors bg-[#222] flex items-center justify-center"
      >
        {avatarUrl ? (
          <img src={avatarUrl} alt={user.name} className="w-full h-full object-cover" />
        ) : (
          <span className="text-xs font-bold text-[#888]">{user.name[0].toUpperCase()}</span>
        )}
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-2 w-64 rounded-xl border border-[#333] bg-[#111]/95 backdrop-blur-xl shadow-2xl overflow-hidden animate-fade-in">
          {/* User info */}
          <div className="px-4 py-3 border-b border-[#222]">
            <p className="text-sm text-[#ededed] font-medium">{user.name}</p>
            <p className="text-xs text-[#555] font-mono">@{user.username}</p>
          </div>

          <div className="p-1">
            <Link
              href="/profile"
              onClick={() => setOpen(false)}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-[#888] hover:text-white hover:bg-[#1a1a1a] transition-colors"
            >
              <User className="h-4 w-4" />
              Profile
            </Link>

            <button
              onClick={() => setShowPasswordForm(!showPasswordForm)}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-[#888] hover:text-white hover:bg-[#1a1a1a] transition-colors"
            >
              <Key className="h-4 w-4" />
              Change password
            </button>

            {showPasswordForm && (
              <div className="px-3 py-2 space-y-2">
                <input
                  type="password"
                  value={currentPw}
                  onChange={(e) => setCurrentPw(e.target.value)}
                  placeholder="Current password"
                  className="w-full bg-black border border-[#333] rounded-lg px-3 py-1.5 text-xs text-[#ededed] placeholder:text-[#555] focus:outline-none focus:border-[#555]"
                />
                <input
                  type="password"
                  value={newPw}
                  onChange={(e) => setNewPw(e.target.value)}
                  placeholder="New password (6+ chars)"
                  className="w-full bg-black border border-[#333] rounded-lg px-3 py-1.5 text-xs text-[#ededed] placeholder:text-[#555] focus:outline-none focus:border-[#555]"
                />
                {pwStatus && (
                  <p className={`text-[10px] ${pwStatus === 'Password updated' ? 'text-[#00cc88]' : 'text-[#ff4444]'}`}>
                    {pwStatus}
                  </p>
                )}
                <button
                  onClick={handleChangePassword}
                  disabled={saving}
                  className="w-full h-7 rounded-lg bg-white text-black text-xs font-medium hover:bg-white/90 transition-colors disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Update'}
                </button>
              </div>
            )}

            <div className="border-t border-[#222] mt-1 pt-1">
              <form action="/api/auth/sign-out" method="POST">
                <button
                  type="submit"
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-[#888] hover:text-[#ff4444] hover:bg-[#1a1a1a] transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                  Sign out
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
