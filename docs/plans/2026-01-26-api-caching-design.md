# API Caching with Cache Purge After Sync

## Problem

The app is read-only with data that syncs once daily at 3:00 UTC. Currently, every API request hits the D1 database, which is unnecessary for data that rarely changes.

## Solution

Add Cloudflare edge caching with cache purge after sync:
1. API routes return `Cache-Control: public, max-age=86400` (24 hours)
2. Sync script purges cache after successful data update

## Implementation

### Part 1: Add Cache Headers to API Routes

Update all API routes to include cache headers:

**Files:**
- `src/app/api/categories/route.ts`
- `src/app/api/countries/route.ts`
- `src/app/api/channels/route.ts`
- `src/app/api/channels/[id]/route.ts`
- `src/app/api/streams/[channelId]/route.ts`

**Change:**
```typescript
return Response.json(data, {
  headers: { 'Cache-Control': 'public, max-age=86400' }
});
```

### Part 2: Cache Purge in Sync Script

Add cache purge at the end of `scripts/sync-iptv.mjs`:

```javascript
async function purgeCache() {
  const ZONE_ID = process.env.CLOUDFLARE_ZONE_ID;
  const API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;

  if (!ZONE_ID || !API_TOKEN) {
    console.log('Skipping cache purge: missing CLOUDFLARE_ZONE_ID or CLOUDFLARE_API_TOKEN');
    return;
  }

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/purge_cache`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ purge_everything: true }),
    }
  );

  if (response.ok) {
    console.log('✓ Cache purged successfully');
  } else {
    console.error('✗ Cache purge failed:', await response.text());
  }
}
```

### Part 3: GitHub Actions Setup

Add `CLOUDFLARE_ZONE_ID` secret:
- Go to repo → Settings → Secrets → Actions
- Add new secret: `CLOUDFLARE_ZONE_ID` with the Zone ID value

Ensure API token has "Zone - Cache Purge - Purge" permission.

## Benefits

- Responses served from Cloudflare edge (faster, lower latency)
- Reduced D1 database load
- Fresh data immediately after sync
- No stale data issues
