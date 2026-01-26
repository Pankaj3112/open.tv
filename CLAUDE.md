# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

open.tv is an IPTV channel browser - a Next.js 16 + React 19 application for browsing and streaming live TV channels from around the world. It uses Cloudflare D1 as the database and syncs channel data from the public IPTV-ORG API.

## Commands

```bash
npm run dev           # Start development server (http://localhost:3000)
npm run build         # Build for production
npm run lint          # Run ESLint
npm run pages:build   # Build for Cloudflare Pages
npm run pages:preview # Preview Cloudflare Pages locally
npm run pages:deploy  # Deploy to Cloudflare Pages
```

## Architecture

### Tech Stack
- **Frontend:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4
- **Backend:** Cloudflare D1 (SQLite database), Cloudflare Workers (sync cron job)
- **UI:** Radix UI primitives + shadcn/ui (New York style)
- **Video:** Shaka Player for HLS/DASH streaming
- **Data Source:** IPTV-ORG public API (synced daily at 3:00 UTC)
- **Deployment:** Cloudflare Pages via OpenNext

### Key Directories
- `src/app/` - Next.js App Router pages (single page app at `page.tsx`)
- `src/app/api/` - API routes for D1 database queries
- `src/components/` - React components, `ui/` contains shadcn components
- `src/hooks/` - Custom hooks for data fetching, filters, favorites, history
- `src/lib/` - Utility functions including D1 database access
- `scripts/` - Sync scripts for daily data sync

### Data Flow
1. **Sync:** Sync script fetches from IPTV-ORG API daily (cron at 3:00 UTC)
2. **Storage:** Cloudflare D1 database stores channels, streams, categories, countries
3. **API:** Edge API routes query D1 directly (`/api/channels`, `/api/categories`, etc.)
4. **Frontend:** Uses custom fetch-based hooks for data fetching
5. **State:** URL params for filters (`useFilters`), localStorage for favorites/history

### Database Schema (schema.sql)
- `channels` - channel_id, name, logo, country, category, network
- `streams` - channel_id, url, quality, http_referrer, user_agent
- `categories` - category_id, name
- `countries` - code, name, flag
- `sync_status` - tracks sync status and timestamps

### API Routes
- `GET /api/categories` - List all categories
- `GET /api/countries` - List all countries
- `GET /api/channels` - List channels with filtering and pagination
- `GET /api/channels/[id]` - Get single channel by ID
- `GET /api/streams/[channelId]` - Get streams for a channel

### State Management
- **URL-based:** Search, country/category filters, playing channel (via `use-filters.ts`)
- **localStorage:** Favorites and watch history (via `use-favorites.ts`, `use-history.ts`)
- **Fetch hooks:** `useChannels`, `useChannel`, `useStreams`, `useCategories`, `useCountries`

### Path Alias
`@/*` maps to `./src/*` (configured in tsconfig.json)

## Deployment

1. Create D1 database: `npx wrangler d1 create opentv-db`
2. Update `database_id` in `wrangler.toml`
3. Apply schema: `npx wrangler d1 execute opentv-db --file=schema.sql`
4. Run sync script to populate data
5. Deploy Next.js: `npm run pages:deploy`
