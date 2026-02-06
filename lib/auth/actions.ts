'use server';

import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { redirect } from 'next/navigation';
import { createUser, getUserByEmail, isUserAdmin, initDb } from '@/lib/db';
import { createSession, deleteSession } from './session';

async function ensureDb() {
  await initDb();
}

export async function signUp(formData: FormData) {
  await ensureDb();

  const email = (formData.get('email') as string)?.trim().toLowerCase();
  const password = formData.get('password') as string;
  const username = (formData.get('username') as string)?.trim().toLowerCase();
  const name = (formData.get('name') as string)?.trim();

  if (!email || !password || !username || !name) {
    return { error: 'All fields are required' };
  }

  if (username.length < 3 || !/^[a-z0-9_]+$/.test(username)) {
    return { error: 'Username must be 3+ chars, lowercase letters, numbers, underscores' };
  }

  if (password.length < 6) {
    return { error: 'Password must be at least 6 characters' };
  }

  const existing = await getUserByEmail(email);
  if (existing) {
    return { error: 'Email already in use' };
  }

  const id = crypto.randomUUID();
  const passwordHash = await bcrypt.hash(password, 10);

  try {
    await createUser({ id, email, passwordHash, username, name });
  } catch (e: any) {
    if (e.message?.includes('unique') || e.message?.includes('duplicate')) {
      return { error: 'Username already taken' };
    }
    return { error: 'Failed to create account' };
  }

  await createSession({ id, username, name, avatarUrl: null });
  redirect('/storyboard');
}

export async function signIn(formData: FormData) {
  await ensureDb();

  const email = (formData.get('email') as string)?.trim().toLowerCase();
  const password = formData.get('password') as string;

  if (!email || !password) {
    return { error: 'Email and password are required' };
  }

  const user = await getUserByEmail(email);
  if (!user) {
    return { error: 'Invalid email or password' };
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    return { error: 'Invalid email or password' };
  }

  const admin = await isUserAdmin(user.id);
  await createSession({
    id: user.id,
    username: user.username,
    name: user.name,
    avatarUrl: user.avatar_url,
    isAdmin: admin,
  });
  redirect('/storyboard');
}

export async function signOut() {
  await deleteSession();
  redirect('/');
}
