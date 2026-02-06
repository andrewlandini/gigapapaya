import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sign in',
  description: 'Sign in to gigapapaya to generate and share AI videos.',
};

export default function SignInLayout({ children }: { children: React.ReactNode }) {
  return children;
}
