import { NextRequest } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { initDb, isUserAdmin, getAllUsers, setUserAdmin } from '@/lib/db';

let dbInitialized = false;

export async function GET() {
  if (!dbInitialized) { await initDb(); dbInitialized = true; }

  const user = await getSession();
  if (!user || !(await isUserAdmin(user.id))) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const users = await getAllUsers();
  return Response.json(users);
}

export async function POST(request: NextRequest) {
  if (!dbInitialized) { await initDb(); dbInitialized = true; }

  const user = await getSession();
  if (!user || !(await isUserAdmin(user.id))) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { userId, isAdmin } = await request.json();
  await setUserAdmin(userId, isAdmin);

  return Response.json({ ok: true });
}
