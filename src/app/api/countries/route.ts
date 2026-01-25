import { getDB } from '@/lib/db';

export const runtime = 'edge';

export async function GET() {
  const db = getDB();

  const result = await db
    .prepare('SELECT code, name, flag FROM countries ORDER BY name')
    .all();

  return Response.json(result.results);
}
