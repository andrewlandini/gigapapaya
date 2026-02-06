'use client';

import { useState } from 'react';
import Link from 'next/link';
import { signIn } from '@/lib/auth/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function SignInPage() {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError('');
    const result = await signIn(formData);
    if (result?.error) {
      setError(result.error);
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
          <p className="text-sm text-[#666]">Welcome back to gigapapaya</p>
        </div>

        <form action={handleSubmit} className="space-y-4">
          <div className="space-y-3">
            <Input name="email" type="email" placeholder="Email" required disabled={loading} />
            <Input name="password" type="password" placeholder="Password" required disabled={loading} />
          </div>

          {error && (
            <p className="text-sm text-[#ff4444] bg-[#ff4444]/10 border border-[#ff4444]/20 rounded-lg px-3 py-2">{error}</p>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign in'}
          </Button>
        </form>

        <p className="text-center text-sm text-[#666]">
          No account?{' '}
          <Link href="/auth/sign-up" className="text-[#ededed] hover:underline">
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
