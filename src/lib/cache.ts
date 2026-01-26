const SYNC_HOUR_UTC = 3;

/**
 * Calculate seconds until next sync time (3:00 UTC).
 * Used for Cache-Control max-age to ensure cache expires when new data is available.
 */
export function getCacheMaxAge(): number {
  const now = new Date();
  const nextSync = new Date(now);
  nextSync.setUTCHours(SYNC_HOUR_UTC, 0, 0, 0);

  if (now >= nextSync) {
    nextSync.setUTCDate(nextSync.getUTCDate() + 1);
  }

  return Math.floor((nextSync.getTime() - now.getTime()) / 1000);
}

/**
 * Get Cache-Control header value with dynamic max-age until next sync.
 */
export function getCacheHeader(): { 'Cache-Control': string } {
  return { 'Cache-Control': `public, max-age=${getCacheMaxAge()}` };
}
