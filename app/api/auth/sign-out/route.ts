import { deleteSession } from '@/lib/auth/session';
import { redirect } from 'next/navigation';

export async function POST() {
  await deleteSession();
  redirect('/');
}
