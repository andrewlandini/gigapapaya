'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Shield, ShieldOff } from 'lucide-react';

interface User {
  id: string;
  username: string;
  name: string;
  email: string;
  avatar_url: string | null;
  is_admin: boolean;
  created_at: string;
  video_count: string;
}

export default function AdminPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    const res = await fetch('/api/admin/users');
    if (res.ok) {
      setUsers(await res.json());
    } else if (res.status === 403) {
      setError('You do not have admin access.');
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const toggleAdmin = async (userId: string, currentAdmin: boolean) => {
    await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, isAdmin: !currentAdmin }),
    });
    load();
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
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="border border-[#222] rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#222] text-left">
                <th className="px-4 py-3 text-xs font-mono text-[#555]">User</th>
                <th className="px-4 py-3 text-xs font-mono text-[#555]">Email</th>
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
