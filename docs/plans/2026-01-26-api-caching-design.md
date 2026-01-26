# API Caching with Dynamic Expiry

## Problem

The app is read-only with data that syncs once daily at 3:00 UTC. Currently, every API request hits the D1 database, which is unnecessary for data that rarely changes.

## Solution

Add Cloudflare edge caching with dynamic expiry that aligns with the sync schedule. Cache expires exactly when new data becomes available (3:00 UTC), ensuring:
- Maximum cache efficiency (one fetch per day per unique request)
- No stale data after sync
- No external dependencies (no Zone ID or cache purge API needed)

## Implementation

### Cache Utility (`src/lib/cache.ts`)

```typescript
const SYNC_HOUR_UTC = 3;

export function getCacheMaxAge(): number {
  const now = new Date();
  const nextSync = new Date(now);
  nextSync.setUTCHours(SYNC_HOUR_UTC, 0, 0, 0);

  if (now >= nextSync) {
    nextSync.setUTCDate(nextSync.getUTCDate() + 1);
  }

  return Math.floor((nextSync.getTime() - now.getTime()) / 1000);
}

export function getCacheHeader(): { 'Cache-Control': string } {
  return { 'Cache-Control': `public, max-age=${getCacheMaxAge()}` };
}
```

### API Routes

All routes use the `getCacheHeader()` utility:

- `src/app/api/categories/route.ts`
- `src/app/api/countries/route.ts`
- `src/app/api/channels/route.ts`
- `src/app/api/channels/[id]/route.ts`
- `src/app/api/streams/[channelId]/route.ts`

## How It Works

| Request Time (UTC) | Cache Expires | max-age |
|--------------------|---------------|---------|
| 11:00 PM | 3:00 AM next day | 4 hours |
| 2:00 AM | 3:00 AM same day | 1 hour |
| 4:00 AM | 3:00 AM next day | 23 hours |

## Benefits

- Responses served from Cloudflare edge (faster, lower latency)
- Reduced D1 database load (one query per day per unique request)
- Cache automatically expires when new data is available
- No infrastructure dependencies (works on `*.pages.dev` domains)
