import { getDB } from '@/lib/db';

export const runtime = 'edge';

export async function GET() {
  const db = await getDB();

  const result = await db
    .prepare('SELECT category_id, name FROM categories ORDER BY name')
    .all();

  return Response.json(result.results);
}
