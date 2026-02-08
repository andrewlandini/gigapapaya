import { getSession } from '@/lib/auth/session';
import { initDb, isUserAdmin, getPendingCreditRequests, reviewCreditRequest, setUserCredits } from '@/lib/db';

export async function GET() {
  await initDb();
  const user = await getSession();
  if (!user || !(await isUserAdmin(user.id))) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const requests = await getPendingCreditRequests();
  return Response.json(requests);
}

export async function POST(request: Request) {
  await initDb();
  const user = await getSession();
  if (!user || !(await isUserAdmin(user.id))) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { action, requestId, userId, amount, note } = await request.json();

  if (action === 'approve' || action === 'deny') {
    if (!requestId) {
      return Response.json({ error: 'requestId is required' }, { status: 400 });
    }
    await reviewCreditRequest(requestId, user.id, action === 'approve', note);
    return Response.json({ ok: true });
  }

  if (action === 'adjust') {
    if (!userId || typeof amount !== 'number' || amount < 0) {
      return Response.json({ error: 'userId and a valid amount are required' }, { status: 400 });
    }
    await setUserCredits(userId, amount);
    return Response.json({ ok: true });
  }

  return Response.json({ error: 'Invalid action' }, { status: 400 });
}
