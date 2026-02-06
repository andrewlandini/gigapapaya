import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import { getSession } from '@/lib/auth/session';
import { initDb, getDb } from '@/lib/db';

export async function POST(request: NextRequest) {
  await initDb();

  const user = await getSession();
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { currentPassword, newPassword } = await request.json();

  if (!currentPassword || !newPassword) {
    return Response.json({ error: 'Both fields required' }, { status: 400 });
  }

  if (newPassword.length < 6) {
    return Response.json({ error: 'New password must be at least 6 characters' }, { status: 400 });
  }

  // Verify current password
  const sql = getDb();
  const rows = await sql`SELECT password_hash FROM users WHERE id = ${user.id}`;
  if (!rows[0]) {
    return Response.json({ error: 'User not found' }, { status: 404 });
  }

  const valid = await bcrypt.compare(currentPassword, rows[0].password_hash);
  if (!valid) {
    return Response.json({ error: 'Current password is incorrect' }, { status: 403 });
  }

  const newHash = await bcrypt.hash(newPassword, 10);
  await sql`UPDATE users SET password_hash = ${newHash} WHERE id = ${user.id}`;

  return Response.json({ ok: true });
}
