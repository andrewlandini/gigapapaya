'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { LogOut, Key, User, X, Coins } from 'lucide-react';
import { useAvatar } from './avatar-context';
import { useCredits } from './credits-context';

interface UserMenuProps {
  user: { username: string; name: string; avatarUrl?: string | null } | null;
}

interface CreditRequest {
  id: string;
  amount: number;
  reason: string;
  status: string;
  created_at: string;
}

export function UserMenu({ user }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const [showPasswordPopup, setShowPasswordPopup] = useState(false);
  const [showCreditsPopup, setShowCreditsPopup] = useState(false);
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [pwStatus, setPwStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { avatarUrl } = useAvatar();
  const { credits, refreshCredits } = useCredits();

  // Credits request state
  const [reqAmount, setReqAmount] = useState('');
  const [reqReason, setReqReason] = useState('');
  const [reqStatus, setReqStatus] = useState<string | null>(null);
  const [reqSaving, setReqSaving] = useState(false);
  const [requests, setRequests] = useState<CreditRequest[]>([]);

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

  const openCreditsPopup = async () => {
    setOpen(false);
    setShowCreditsPopup(true);
    setReqAmount('');
    setReqReason('');
    setReqStatus(null);
    try {
      const res = await fetch('/api/credits/request');
      if (res.ok) setRequests(await res.json());
    } catch {}
  };

  const handleRequestCredits = async () => {
    const amount = parseInt(reqAmount);
    if (!amount || amount < 1 || amount > 50000) {
      setReqStatus('Amount must be between 1 and 50,000');
      return;
    }
    if (!reqReason.trim()) {
      setReqStatus('Please provide a reason');
      return;
    }
    setReqSaving(true);
    setReqStatus(null);
    const res = await fetch('/api/credits/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount, reason: reqReason.trim() }),
    });
    if (res.ok) {
      setReqStatus('Request submitted');
      setReqAmount('');
      setReqReason('');
      const listRes = await fetch('/api/credits/request');
      if (listRes.ok) setRequests(await listRes.json());
    } else {
      const data = await res.json();
      setReqStatus(data.error || 'Failed to submit request');
    }
    setReqSaving(false);
  };

  return (
    <>
      <div className="fixed bottom-4 left-[15px] z-[55]" ref={ref}>
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
          <div className="absolute bottom-full left-0 mb-2 w-64 rounded-xl border border-[#333] bg-[#111]/95 backdrop-blur-xl shadow-2xl overflow-hidden animate-fade-in">
            {/* User info */}
            <div className="px-4 py-3 border-b border-[#222]">
              <p className="text-sm text-[#ededed] font-medium">{user.name}</p>
              <p className="text-xs text-[#555] font-mono">@{user.username}</p>
              {credits !== null && (
                <p className="text-xs font-mono text-[#00DC82] mt-1">{credits.toLocaleString()} credits</p>
              )}
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
                onClick={openCreditsPopup}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-[#888] hover:text-white hover:bg-[#1a1a1a] transition-colors"
              >
                <Coins className="h-4 w-4" />
                Request credits
              </button>

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

      {/* Request credits popup */}
      {showCreditsPopup && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowCreditsPopup(false)} />
          <div className="relative bg-[#111] border border-[#333] rounded-2xl w-full max-w-sm shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#222]">
              <div className="flex items-center gap-2">
                <Coins className="h-4 w-4 text-[#888]" />
                <span className="text-sm font-medium text-[#ededed]">Request credits</span>
              </div>
              <button
                onClick={() => setShowCreditsPopup(false)}
                className="p-1 rounded-lg text-[#555] hover:text-white hover:bg-[#222] transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              {credits !== null && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[#888]">Current balance</span>
                  <span className="font-mono text-[#00DC82]">{credits.toLocaleString()} credits</span>
                </div>
              )}
              <div className="space-y-3">
                <input
                  type="number"
                  value={reqAmount}
                  onChange={(e) => setReqAmount(e.target.value)}
                  placeholder="Amount (e.g. 5000)"
                  min={1}
                  max={50000}
                  className="w-full bg-black border border-[#333] rounded-lg px-3 py-2.5 text-sm text-[#ededed] placeholder:text-[#555] focus:outline-none focus:border-[#555]"
                />
                <textarea
                  value={reqReason}
                  onChange={(e) => setReqReason(e.target.value)}
                  placeholder="Reason for request..."
                  rows={2}
                  className="w-full bg-black border border-[#333] rounded-lg px-3 py-2.5 text-sm text-[#ededed] placeholder:text-[#555] focus:outline-none focus:border-[#555] resize-none"
                />
                {reqStatus && (
                  <p className={`text-xs ${reqStatus === 'Request submitted' ? 'text-[#00cc88]' : 'text-[#ff4444]'}`}>
                    {reqStatus}
                  </p>
                )}
                <button
                  onClick={handleRequestCredits}
                  disabled={reqSaving}
                  className="w-full h-10 rounded-lg bg-white text-black text-sm font-medium hover:bg-white/90 transition-colors disabled:opacity-50"
                >
                  {reqSaving ? 'Submitting...' : 'Submit request'}
                </button>
              </div>

              {/* Recent requests */}
              {requests.length > 0 && (
                <div className="border-t border-[#222] pt-3 space-y-2">
                  <span className="text-xs font-mono text-[#555]">Recent requests</span>
                  {requests.slice(0, 5).map((r) => (
                    <div key={r.id} className="flex items-center justify-between text-xs">
                      <span className="font-mono text-[#888]">{r.amount.toLocaleString()} credits</span>
                      <span className={`font-mono ${
                        r.status === 'approved' ? 'text-[#00DC82]' :
                        r.status === 'denied' ? 'text-[#ff4444]' :
                        'text-[#888]'
                      }`}>
                        {r.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
