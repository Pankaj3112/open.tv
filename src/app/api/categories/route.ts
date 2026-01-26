import { getDB } from '@/lib/db';

export async function GET() {
  const db = await getDB();

  const result = await db
    .prepare('SELECT category_id, name FROM categories ORDER BY name')
    .all();

  return Response.json(result.results, {
    headers: { 'Cache-Control': 'public, max-age=86400' },
  });
}
