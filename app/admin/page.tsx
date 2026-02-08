'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Shield, ShieldOff, Check, X, Coins } from 'lucide-react';

interface User {
  id: string;
  username: string;
  name: string;
  email: string;
  avatar_url: string | null;
  is_admin: boolean;
  credits: number;
  created_at: string;
  video_count: string;
}

interface CreditRequest {
  id: string;
  user_id: string;
  username: string;
  name: string;
  email: string;
  credits: number;
  amount: number;
  reason: string;
  status: string;
  created_at: string;
}

export default function AdminPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [requests, setRequests] = useState<CreditRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingCredits, setEditingCredits] = useState<string | null>(null);
  const [creditInput, setCreditInput] = useState('');

  const loadUsers = async () => {
    const res = await fetch('/api/admin/users');
    if (res.ok) {
      setUsers(await res.json());
    } else if (res.status === 403) {
      setError('You do not have admin access.');
    }
  };

  const loadRequests = async () => {
    const res = await fetch('/api/admin/credits');
    if (res.ok) {
      setRequests(await res.json());
    }
  };

  const load = async () => {
    await Promise.all([loadUsers(), loadRequests()]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const toggleAdmin = async (userId: string, currentAdmin: boolean) => {
    await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, isAdmin: !currentAdmin }),
    });
    loadUsers();
  };

  const adjustCredits = async (userId: string) => {
    const amount = parseInt(creditInput);
    if (isNaN(amount) || amount < 0) return;
    await fetch('/api/admin/credits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'adjust', userId, amount }),
    });
    setEditingCredits(null);
    setCreditInput('');
    loadUsers();
  };

  const handleRequest = async (requestId: string, action: 'approve' | 'deny') => {
    await fetch('/api/admin/credits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, requestId }),
    });
    await Promise.all([loadUsers(), loadRequests()]);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <span className="text-[#555] text-sm font-mono">loading...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center space-y-2">
          <p className="text-[#ff4444] text-sm">{error}</p>
          <Link href="/" className="text-sm text-[#0070f3] hover:underline">Back to feed</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      <header className="border-b border-[#222]">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center gap-3">
          <Link href="/" className="text-[#555] hover:text-white transition-colors">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <span className="text-[15px] font-semibold tracking-tight">Admin</span>
          <span className="text-xs font-mono text-[#555]">{users.length} users</span>
          {requests.length > 0 && (
            <span className="text-xs font-mono text-[#ff8800]">{requests.length} pending</span>
          )}
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        {/* Credit Requests */}
        {requests.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Coins className="h-4 w-4 text-[#ff8800]" />
              <h2 className="text-sm font-medium text-[#ededed]">Credit Requests</h2>
            </div>
            <div className="grid gap-3">
              {requests.map((r) => (
                <div key={r.id} className="border border-[#222] rounded-xl p-4 flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-[#ededed] font-medium">{r.name}</span>
                      <span className="text-xs font-mono text-[#555]">@{r.username}</span>
                      <span className="text-xs font-mono text-[#444]">·</span>
                      <span className="text-xs font-mono text-[#888]">has {r.credits.toLocaleString()} credits</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-mono text-[#00DC82]">+{r.amount.toLocaleString()} credits</span>
                      <span className="text-xs text-[#666]">{r.reason}</span>
                    </div>
                    <span className="text-[10px] font-mono text-[#444]">{new Date(r.created_at).toLocaleString()}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleRequest(r.id, 'approve')}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#00DC82]/10 text-[#00DC82] border border-[#00DC82]/20 hover:bg-[#00DC82]/20 transition-colors"
                    >
                      <Check className="h-3 w-3" />
                      Approve
                    </button>
                    <button
                      onClick={() => handleRequest(r.id, 'deny')}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#ff4444]/10 text-[#ff4444] border border-[#ff4444]/20 hover:bg-[#ff4444]/20 transition-colors"
                    >
                      <X className="h-3 w-3" />
                      Deny
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Users table */}
        <div className="border border-[#222] rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#222] text-left">
                <th className="px-4 py-3 text-xs font-mono text-[#555]">User</th>
                <th className="px-4 py-3 text-xs font-mono text-[#555]">Email</th>
                <th className="px-4 py-3 text-xs font-mono text-[#555]">Credits</th>
                <th className="px-4 py-3 text-xs font-mono text-[#555]">Videos</th>
                <th className="px-4 py-3 text-xs font-mono text-[#555]">Joined</th>
                <th className="px-4 py-3 text-xs font-mono text-[#555]">Admin</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-[#181818] last:border-b-0 hover:bg-[#0a0a0a] transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {u.avatar_url ? (
                        <img src={u.avatar_url} alt={u.name} className="w-7 h-7 rounded-full object-cover border border-[#333]" />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-[#222] border border-[#333] flex items-center justify-center text-xs font-bold text-[#888]">
                          {u.name[0].toUpperCase()}
                        </div>
                      )}
                      <div>
                        <p className="text-sm text-[#ededed]">{u.name}</p>
                        <p className="text-xs text-[#555] font-mono">@{u.username}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-[#888] font-mono">{u.email}</td>
                  <td className="px-4 py-3">
                    {editingCredits === u.id ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          value={creditInput}
                          onChange={(e) => setCreditInput(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && adjustCredits(u.id)}
                          className="w-20 bg-black border border-[#333] rounded px-2 py-1 text-xs text-[#ededed] font-mono focus:outline-none focus:border-[#555]"
                          autoFocus
                        />
                        <button
                          onClick={() => adjustCredits(u.id)}
                          className="text-[#00DC82] hover:text-[#00DC82]/80 transition-colors"
                        >
                          <Check className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => { setEditingCredits(null); setCreditInput(''); }}
                          className="text-[#555] hover:text-[#888] transition-colors"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setEditingCredits(u.id); setCreditInput(String(u.credits ?? 0)); }}
                        className="text-xs font-mono text-[#00DC82] hover:underline cursor-pointer"
                      >
                        {(u.credits ?? 0).toLocaleString()}
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-[#888] font-mono">{u.video_count}</td>
                  <td className="px-4 py-3 text-xs text-[#555] font-mono">
                    {new Date(u.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleAdmin(u.id, u.is_admin)}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                        u.is_admin
                          ? 'bg-[#0070f3]/10 text-[#0070f3] border border-[#0070f3]/20 hover:bg-[#0070f3]/20'
                          : 'bg-[#222] text-[#666] border border-[#333] hover:bg-[#333]'
                      }`}
                    >
                      {u.is_admin ? (
                        <>
                          <Shield className="h-3 w-3" />
                          Admin
                        </>
                      ) : (
                        <>
                          <ShieldOff className="h-3 w-3" />
                          User
                        </>
                      )}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
