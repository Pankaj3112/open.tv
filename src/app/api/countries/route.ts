import { getDB } from '@/lib/db';
import { getCacheHeader } from '@/lib/cache';

export async function GET() {
  const db = await getDB();

  const result = await db
    .prepare('SELECT code, name, flag FROM countries ORDER BY name')
    .all();

  return Response.json(result.results, {
    headers: getCacheHeader(),
  });
}
