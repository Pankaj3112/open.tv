import { getDB } from '@/lib/db';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ channelId: string }> }
) {
  const db = await getDB();
  const { channelId } = await params;

  const result = await db
    .prepare('SELECT channel_id, url, quality, http_referrer, user_agent FROM streams WHERE channel_id = ?')
    .bind(channelId)
    .all();

  return Response.json(result.results);
}
