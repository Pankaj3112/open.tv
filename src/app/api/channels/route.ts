import { getDB } from '@/lib/db';

export async function GET(request: Request) {
  const db = await getDB();
  const { searchParams } = new URL(request.url);

  const countriesParam = searchParams.get('countries');
  const categoriesParam = searchParams.get('categories');
  const search = searchParams.get('search');
  const cursor = parseInt(searchParams.get('cursor') || '0');
  const limit = parseInt(searchParams.get('limit') || '20');

  const countries = countriesParam?.split(',').filter(Boolean);
  const categories = categoriesParam?.split(',').filter(Boolean);

  let query = 'SELECT channel_id, name, logo, country, category, network FROM channels WHERE 1=1';
  const params: (string | number)[] = [];

  if (search) {
    query += ' AND name LIKE ?';
    params.push(`%${search}%`);
  }

  if (countries && countries.length > 0) {
    query += ` AND country IN (${countries.map(() => '?').join(',')})`;
    params.push(...countries);
  }

  if (categories && categories.length > 0) {
    query += ` AND category IN (${categories.map(() => '?').join(',')})`;
    params.push(...categories);
  }

  query += ' ORDER BY name LIMIT ? OFFSET ?';
  params.push(limit + 1, cursor);

  const result = await db.prepare(query).bind(...params).all();

  const hasMore = result.results.length > limit;
  const channels = result.results.slice(0, limit);

  return Response.json({
    channels,
    nextCursor: hasMore ? cursor + limit : null,
  });
}
