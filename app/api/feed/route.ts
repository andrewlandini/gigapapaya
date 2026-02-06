import { NextRequest } from 'next/server';
import { getPublicVideosSorted, initDb } from '@/lib/db';

export async function GET(request: NextRequest) {
  await initDb();

  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get('limit') || '30');
  const offset = parseInt(searchParams.get('offset') || '0');
  const period = (searchParams.get('period') || 'all') as 'day' | 'week' | 'month' | 'year' | 'all';

  const videos = await getPublicVideosSorted(limit, offset, period);

  return Response.json(videos, {
    headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' },
  });
}
