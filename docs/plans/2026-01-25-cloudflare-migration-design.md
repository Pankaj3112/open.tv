# Cloudflare Migration Design

Migrate from Convex to Cloudflare (D1 + Workers + Pages via OpenNext).

## Motivation

- Data is static (syncs once daily) - Convex real-time features are overkill
- High Convex costs for bandwidth
- Simpler hosting with everything on one platform
- Cloudflare free tier is sufficient for this data size

## Target Architecture

- **Hosting**: Cloudflare Pages via OpenNext adapter
- **Database**: Cloudflare D1 (SQLite at the edge)
- **Sync**: Cloudflare Worker with Cron Trigger (daily at 3:00 UTC)
- **Frontend**: Same Next.js app with fetch-based data hooks

## Database Schema (D1)

```sql
CREATE TABLE channels (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  channel_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  logo TEXT,
  country TEXT NOT NULL,
  category TEXT NOT NULL,
  network TEXT,
  created_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX idx_channels_country ON channels(country);
CREATE INDEX idx_channels_category ON channels(category);
CREATE INDEX idx_channels_category_country ON channels(category, country);
CREATE INDEX idx_channels_name ON channels(name);

CREATE TABLE streams (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  channel_id TEXT NOT NULL,
  url TEXT NOT NULL,
  quality TEXT,
  http_referrer TEXT,
  user_agent TEXT
);

CREATE INDEX idx_streams_channel_id ON streams(channel_id);

CREATE TABLE categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL
);

CREATE TABLE countries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  flag TEXT
);

CREATE TABLE sync_status (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  last_sync_at INTEGER NOT NULL,
  status TEXT NOT NULL,
  channel_count INTEGER,
  error TEXT
);
```

## API Routes

```
src/app/api/
├── channels/
│   └── route.ts      # GET - list with filters, pagination, search
├── channels/[id]/
│   └── route.ts      # GET - single channel by channelId
├── streams/[id]/
│   └── route.ts      # GET - streams for a channel
├── categories/
│   └── route.ts      # GET - all categories
└── countries/
    └── route.ts      # GET - all countries
```

### Channels Endpoint

`GET /api/channels?countries=US,GB&categories=news&search=bbc&cursor=0&limit=20`

Returns:
```json
{
  "channels": [...],
  "nextCursor": 20 | null
}
```

Query logic:
- Search uses `WHERE name LIKE '%term%'`
- Countries/categories use `IN (...)` clauses
- Offset-based pagination with cursor

## Sync Worker

Separate Cloudflare Worker project: `iptv-sync-worker/`

**wrangler.toml:**
```toml
name = "iptv-sync-worker"
main = "src/index.ts"

[[d1_databases]]
binding = "DB"
database_name = "iptv-db"
database_id = "<your-d1-id>"

[triggers]
crons = ["0 3 * * *"]
```

**Sync logic:**
1. Fetch channels, streams, categories, countries, logos from IPTV-ORG API
2. Parse logos CSV, select best logo per channel
3. Filter out NSFW/closed channels
4. Delete all existing data and insert fresh (full replace)
5. Update sync_status table

## Frontend Changes

Replace Convex hooks with custom fetch hooks:

**New hooks:**
- `useChannels({ countries, categories, search })` - paginated channel list
- `useChannel(channelId)` - single channel
- `useStreams(channelId)` - streams for channel
- `useCategories()` - all categories
- `useCountries()` - all countries

**Changes to page.tsx:**
- Remove `convex/react` imports
- Use new fetch-based hooks
- Same component structure, just different data source

**What stays the same:**
- All React components
- URL-based filter state (useFilters)
- localStorage for favorites/history
- Shaka Player for video

## File Changes

**Delete:**
- `convex/` directory
- `convex` and `convex-helpers` from package.json

**Create:**
- `schema.sql` - D1 database schema
- `src/app/api/channels/route.ts`
- `src/app/api/channels/[id]/route.ts`
- `src/app/api/streams/[id]/route.ts`
- `src/app/api/categories/route.ts`
- `src/app/api/countries/route.ts`
- `src/hooks/use-channels.ts`
- `src/hooks/use-reference-data.ts`
- `iptv-sync-worker/` - separate worker project

## Deployment Steps

1. Create D1 database:
   ```bash
   npx wrangler d1 create iptv-db
   npx wrangler d1 execute iptv-db --file=schema.sql
   ```

2. Deploy sync worker:
   ```bash
   cd iptv-sync-worker
   npx wrangler deploy
   ```

3. Trigger initial sync manually

4. Configure Next.js for Cloudflare:
   - Install `@opennextjs/cloudflare`
   - Add D1 binding in wrangler.toml
   - Update next.config.js

5. Deploy to Cloudflare Pages:
   ```bash
   npx opennextjs-cloudflare build
   npx wrangler pages deploy .open-next/assets --project-name=iptv
   ```
