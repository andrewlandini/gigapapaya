'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { LogOut, Key, User, X } from 'lucide-react';
import { useAvatar } from './avatar-context';

interface UserMenuProps {
  user: { username: string; name: string; avatarUrl?: string | null } | null;
}

export function UserMenu({ user }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const [showPasswordPopup, setShowPasswordPopup] = useState(false);
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
      setTimeout(() => { setShowPasswordPopup(false); setPwStatus(null); }, 1500);
    } else {
      const data = await res.json();
      setPwStatus(data.error || 'Failed to change password');
    }
    setSaving(false);
  };

  const openPasswordPopup = () => {
    setOpen(false);
    setShowPasswordPopup(true);
    setCurrentPw('');
    setNewPw('');
    setPwStatus(null);
  };

  return (
    <>
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
                onClick={openPasswordPopup}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-[#888] hover:text-white hover:bg-[#1a1a1a] transition-colors"
              >
                <Key className="h-4 w-4" />
                Change password
              </button>

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

      {/* Change password popup */}
      {showPasswordPopup && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowPasswordPopup(false)} />
          <div className="relative bg-[#111] border border-[#333] rounded-2xl w-full max-w-sm shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#222]">
              <div className="flex items-center gap-2">
                <Key className="h-4 w-4 text-[#888]" />
                <span className="text-sm font-medium text-[#ededed]">Change password</span>
              </div>
              <button
                onClick={() => setShowPasswordPopup(false)}
                className="p-1 rounded-lg text-[#555] hover:text-white hover:bg-[#222] transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <input
                type="password"
                value={currentPw}
                onChange={(e) => setCurrentPw(e.target.value)}
                placeholder="Current password"
                className="w-full bg-black border border-[#333] rounded-lg px-3 py-2.5 text-sm text-[#ededed] placeholder:text-[#555] focus:outline-none focus:border-[#555]"
              />
              <input
                type="password"
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleChangePassword()}
                placeholder="New password (6+ chars)"
                className="w-full bg-black border border-[#333] rounded-lg px-3 py-2.5 text-sm text-[#ededed] placeholder:text-[#555] focus:outline-none focus:border-[#555]"
              />
              {pwStatus && (
                <p className={`text-xs ${pwStatus === 'Password updated' ? 'text-[#00cc88]' : 'text-[#ff4444]'}`}>
                  {pwStatus}
                </p>
              )}
              <button
                onClick={handleChangePassword}
                disabled={saving}
                className="w-full h-10 rounded-lg bg-white text-black text-sm font-medium hover:bg-white/90 transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Update password'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
