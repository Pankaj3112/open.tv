import { getDB } from '@/lib/db';

export async function GET() {
  const db = await getDB();

  const result = await db
    .prepare('SELECT code, name, flag FROM countries ORDER BY name')
    .all();

  return Response.json(result.results, {
    headers: { 'Cache-Control': 'public, max-age=86400' },
  });
}
