import { getSession } from '@/lib/auth/session';
import { initDb, createCreditRequest, getUserCreditRequests } from '@/lib/db';

export async function GET() {
  await initDb();
  const user = await getSession();
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const requests = await getUserCreditRequests(user.id);
  return Response.json(requests);
}

export async function POST(request: Request) {
  await initDb();
  const user = await getSession();
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { amount, reason } = await request.json();

  if (!amount || typeof amount !== 'number' || amount < 1 || amount > 50000) {
    return Response.json({ error: 'Amount must be between 1 and 50,000 credits' }, { status: 400 });
  }
  if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
    return Response.json({ error: 'Reason is required' }, { status: 400 });
  }

  const id = crypto.randomUUID();
  await createCreditRequest(id, user.id, amount, reason.trim());

  return Response.json({ id, status: 'pending' });
}
