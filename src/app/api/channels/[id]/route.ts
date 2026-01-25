import { getDB } from '@/lib/db';

export const runtime = 'edge';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const db = getDB();
  const { id } = await params;

  const result = await db
    .prepare('SELECT channel_id, name, logo, country, category, network FROM channels WHERE channel_id = ?')
    .bind(id)
    .first();

  if (!result) {
    return Response.json({ error: 'Channel not found' }, { status: 404 });
  }

  return Response.json(result);
}
