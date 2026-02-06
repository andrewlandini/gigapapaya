import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Create account',
  description: 'Create a gigapapaya account to generate and share AI videos.',
};

export default function SignUpLayout({ children }: { children: React.ReactNode }) {
  return children;
}
