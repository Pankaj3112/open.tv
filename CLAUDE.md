# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

open.tv is an IPTV channel browser - a Next.js 16 + React 19 application for browsing and streaming live TV channels from around the world. It uses Convex as the backend database and syncs channel data from the public IPTV-ORG API.

## Commands

```bash
npm run dev      # Start development server (http://localhost:3000)
npm run build    # Build for production
npm run lint     # Run ESLint
npx convex dev   # Start Convex dev server (required for backend)
```

**Note:** You need both `npm run dev` and `npx convex dev` running for full functionality.

## Architecture

### Tech Stack
- **Frontend:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4
- **Backend:** Convex (BaaS - queries, mutations, actions, cron jobs)
- **UI:** Radix UI primitives + shadcn/ui (New York style)
- **Video:** Shaka Player for HLS/DASH streaming
- **Data Source:** IPTV-ORG public API (synced daily at 3:00 UTC)

### Key Directories
- `src/app/` - Next.js App Router pages (single page app at `page.tsx`)
- `src/components/` - React components, `ui/` contains shadcn components
- `src/hooks/` - Custom hooks for filters, favorites, history
- `convex/` - Backend: schema, queries, mutations, sync actions, crons

### Data Flow
1. **Sync:** `convex/sync.ts` fetches from IPTV-ORG API daily (cron in `crons.ts`)
2. **Storage:** Convex database stores channels, streams, categories, countries
3. **Frontend:** Uses `useQuery`/`usePaginatedQuery` for reactive data fetching
4. **State:** URL params for filters (`useFilters`), localStorage for favorites/history

### Database Schema (convex/schema.ts)
- `channels` - channelId, name, logo, country, categories[], languages[]
- `streams` - channelId, url, quality, httpReferrer, userAgent
- `categories` - categoryId, name
- `countries` - code, name, flag, languages[]
- `syncStatus` - tracks sync status and timestamps

### State Management
- **URL-based:** Search, country/category filters, playing channel (via `use-filters.ts`)
- **localStorage:** Favorites and watch history (via `use-favorites.ts`, `use-history.ts`)
- **Server:** Convex handles all data fetching with real-time subscriptions

### Path Alias
`@/*` maps to `./src/*` (configured in tsconfig.json)

## Environment Variables

Required in `.env.local`:
```
NEXT_PUBLIC_CONVEX_URL=<your-convex-deployment-url>
```
