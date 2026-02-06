import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { VideoGenerator } from '@/components/video-generator';

export default async function GeneratePage() {
  const user = await getSession();
  if (!user) redirect('/auth/sign-in');

  return <VideoGenerator />;
}
