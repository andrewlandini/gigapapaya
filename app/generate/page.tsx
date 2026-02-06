import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { VideoGenerator } from '@/components/video-generator';

export const metadata: Metadata = {
  title: 'Generate',
  description: 'Generate AI videos with multi-agent scene crafting or direct prompts. Powered by Google Veo 3.1.',
};

export default async function GeneratePage() {
  const user = await getSession();
  if (!user) redirect('/auth/sign-in');

  return <VideoGenerator />;
}
