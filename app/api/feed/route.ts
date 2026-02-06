import { NextRequest } from 'next/server';
import { getPublicVideosSorted, initDb } from '@/lib/db';

let dbInitialized = false;

export async function GET(request: NextRequest) {
  if (!dbInitialized) {
    await initDb();
    dbInitialized = true;
  }

  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get('limit') || '30');
  const offset = parseInt(searchParams.get('offset') || '0');
  const period = (searchParams.get('period') || 'all') as 'day' | 'week' | 'month' | 'year' | 'all';

  const videos = await getPublicVideosSorted(limit, offset, period);

  return Response.json(videos);
}
