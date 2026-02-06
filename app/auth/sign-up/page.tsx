'use client';

import { useState } from 'react';
import Link from 'next/link';
import { signUp } from '@/lib/auth/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function SignUpPage() {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError('');
    const result = await signUp(formData);
    if (result?.error) {
      setError(result.error);
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">Create account</h1>
          <p className="text-sm text-[#666]">Join gigapapaya to generate and share videos</p>
        </div>

        <form action={handleSubmit} className="space-y-4">
          <div className="space-y-3">
            <Input name="name" placeholder="Display name" required disabled={loading} />
            <Input name="username" placeholder="Username" required disabled={loading} className="font-mono" />
            <Input name="email" type="email" placeholder="Email" required disabled={loading} />
            <Input name="password" type="password" placeholder="Password (6+ chars)" required disabled={loading} />
          </div>

          {error && (
            <p className="text-sm text-[#ff4444] bg-[#ff4444]/10 border border-[#ff4444]/20 rounded-lg px-3 py-2">{error}</p>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Creating...' : 'Create account'}
          </Button>
        </form>

        <p className="text-center text-sm text-[#666]">
          Already have an account?{' '}
          <Link href="/auth/sign-in" className="text-[#ededed] hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
