# Cloudflare Migration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Migrate from Convex to Cloudflare D1 + Workers + Pages for simpler, cheaper hosting of static IPTV data.

**Architecture:** Next.js app deployed to Cloudflare Pages via OpenNext. D1 database for channel/stream data. Separate Worker with cron trigger for daily sync from IPTV-ORG API. API routes in Next.js query D1 directly.

**Tech Stack:** Next.js 16, Cloudflare D1, Cloudflare Workers, OpenNext, Wrangler CLI

---

## Phase 1: Database Setup

### Task 1: Create D1 Schema File

**Files:**
- Create: `schema.sql`

**Step 1: Write the schema file**

```sql
-- Channels table
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

-- Streams table
CREATE TABLE streams (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  channel_id TEXT NOT NULL,
  url TEXT NOT NULL,
  quality TEXT,
  http_referrer TEXT,
  user_agent TEXT
);

CREATE INDEX idx_streams_channel_id ON streams(channel_id);

-- Categories table
CREATE TABLE categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL
);

-- Countries table
CREATE TABLE countries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  flag TEXT
);

-- Sync status table
CREATE TABLE sync_status (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  last_sync_at INTEGER NOT NULL,
  status TEXT NOT NULL,
  channel_count INTEGER,
  error TEXT
);
```

**Step 2: Commit**

```bash
git add schema.sql
git commit -m "feat: add D1 database schema"
```

---

## Phase 2: API Routes

### Task 2: Create Categories API Route

**Files:**
- Create: `src/app/api/categories/route.ts`
- Create: `src/lib/db.ts`

**Step 1: Create database utility**

Create `src/lib/db.ts`:

```typescript
import { getRequestContext } from '@cloudflare/next-on-pages';

export function getDB() {
  return getRequestContext().env.DB;
}
```

**Step 2: Create categories route**

Create `src/app/api/categories/route.ts`:

```typescript
import { getDB } from '@/lib/db';

export const runtime = 'edge';

export async function GET() {
  const db = getDB();

  const result = await db
    .prepare('SELECT category_id, name FROM categories ORDER BY name')
    .all();

  return Response.json(result.results);
}
```

**Step 3: Commit**

```bash
git add src/lib/db.ts src/app/api/categories/route.ts
git commit -m "feat: add categories API route"
```

---

### Task 3: Create Countries API Route

**Files:**
- Create: `src/app/api/countries/route.ts`

**Step 1: Create countries route**

Create `src/app/api/countries/route.ts`:

```typescript
import { getDB } from '@/lib/db';

export const runtime = 'edge';

export async function GET() {
  const db = getDB();

  const result = await db
    .prepare('SELECT code, name, flag FROM countries ORDER BY name')
    .all();

  return Response.json(result.results);
}
```

**Step 2: Commit**

```bash
git add src/app/api/countries/route.ts
git commit -m "feat: add countries API route"
```

---

### Task 4: Create Channels List API Route

**Files:**
- Create: `src/app/api/channels/route.ts`

**Step 1: Create channels route**

Create `src/app/api/channels/route.ts`:

```typescript
import { getDB } from '@/lib/db';

export const runtime = 'edge';

export async function GET(request: Request) {
  const db = getDB();
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
```

**Step 2: Commit**

```bash
git add src/app/api/channels/route.ts
git commit -m "feat: add channels list API route with filtering and pagination"
```

---

### Task 5: Create Channel By ID API Route

**Files:**
- Create: `src/app/api/channels/[id]/route.ts`

**Step 1: Create channel by ID route**

Create `src/app/api/channels/[id]/route.ts`:

```typescript
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
```

**Step 2: Commit**

```bash
git add src/app/api/channels/[id]/route.ts
git commit -m "feat: add channel by ID API route"
```

---

### Task 6: Create Streams API Route

**Files:**
- Create: `src/app/api/streams/[channelId]/route.ts`

**Step 1: Create streams route**

Create `src/app/api/streams/[channelId]/route.ts`:

```typescript
import { getDB } from '@/lib/db';

export const runtime = 'edge';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ channelId: string }> }
) {
  const db = getDB();
  const { channelId } = await params;

  const result = await db
    .prepare('SELECT channel_id, url, quality, http_referrer, user_agent FROM streams WHERE channel_id = ?')
    .bind(channelId)
    .all();

  return Response.json(result.results);
}
```

**Step 2: Commit**

```bash
git add src/app/api/streams/[channelId]/route.ts
git commit -m "feat: add streams API route"
```

---

## Phase 3: Frontend Hooks

### Task 7: Create Reference Data Hooks

**Files:**
- Create: `src/hooks/use-categories.ts`
- Create: `src/hooks/use-countries.ts`

**Step 1: Create categories hook**

Create `src/hooks/use-categories.ts`:

```typescript
import { useState, useEffect } from 'react';

interface Category {
  category_id: string;
  name: string;
}

export function useCategories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch('/api/categories')
      .then((res) => res.json())
      .then((data) => {
        setCategories(data);
        setIsLoading(false);
      })
      .catch(() => {
        setIsLoading(false);
      });
  }, []);

  return { categories, isLoading };
}
```

**Step 2: Create countries hook**

Create `src/hooks/use-countries.ts`:

```typescript
import { useState, useEffect } from 'react';

interface Country {
  code: string;
  name: string;
  flag: string;
}

export function useCountries() {
  const [countries, setCountries] = useState<Country[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch('/api/countries')
      .then((res) => res.json())
      .then((data) => {
        setCountries(data);
        setIsLoading(false);
      })
      .catch(() => {
        setIsLoading(false);
      });
  }, []);

  return { countries, isLoading };
}
```

**Step 3: Commit**

```bash
git add src/hooks/use-categories.ts src/hooks/use-countries.ts
git commit -m "feat: add useCategories and useCountries hooks"
```

---

### Task 8: Create Channels Hook

**Files:**
- Create: `src/hooks/use-channels.ts`

**Step 1: Create channels hook**

Create `src/hooks/use-channels.ts`:

```typescript
import { useState, useEffect, useCallback, useRef } from 'react';

interface Channel {
  channel_id: string;
  name: string;
  logo: string | null;
  country: string;
  category: string;
  network: string | null;
}

interface UseChannelsOptions {
  countries?: string[];
  categories?: string[];
  search?: string;
}

type Status = 'loading' | 'idle' | 'hasMore' | 'loadingMore';

export function useChannels(options: UseChannelsOptions) {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [status, setStatus] = useState<Status>('loading');
  const cursorRef = useRef<number | null>(null);

  const buildUrl = useCallback((cursor: number) => {
    const params = new URLSearchParams();
    if (options.search) params.set('search', options.search);
    if (options.countries?.length) params.set('countries', options.countries.join(','));
    if (options.categories?.length) params.set('categories', options.categories.join(','));
    params.set('cursor', String(cursor));
    params.set('limit', '20');
    return `/api/channels?${params}`;
  }, [options.search, options.countries, options.categories]);

  // Reset and fetch on filter change
  useEffect(() => {
    setChannels([]);
    cursorRef.current = null;
    setStatus('loading');

    fetch(buildUrl(0))
      .then((res) => res.json())
      .then((data) => {
        setChannels(data.channels);
        cursorRef.current = data.nextCursor;
        setStatus(data.nextCursor !== null ? 'hasMore' : 'idle');
      })
      .catch(() => {
        setStatus('idle');
      });
  }, [buildUrl]);

  const loadMore = useCallback(() => {
    if (status !== 'hasMore' || cursorRef.current === null) return;

    setStatus('loadingMore');
    fetch(buildUrl(cursorRef.current))
      .then((res) => res.json())
      .then((data) => {
        setChannels((prev) => [...prev, ...data.channels]);
        cursorRef.current = data.nextCursor;
        setStatus(data.nextCursor !== null ? 'hasMore' : 'idle');
      })
      .catch(() => {
        setStatus('hasMore'); // Allow retry
      });
  }, [buildUrl, status]);

  return {
    channels,
    status,
    isLoading: status === 'loading',
    hasMore: status === 'hasMore' || status === 'loadingMore',
    loadMore,
  };
}
```

**Step 2: Commit**

```bash
git add src/hooks/use-channels.ts
git commit -m "feat: add useChannels hook with pagination"
```

---

### Task 9: Create Channel and Streams Hooks

**Files:**
- Create: `src/hooks/use-channel.ts`
- Create: `src/hooks/use-streams.ts`

**Step 1: Create channel hook**

Create `src/hooks/use-channel.ts`:

```typescript
import { useState, useEffect } from 'react';

interface Channel {
  channel_id: string;
  name: string;
  logo: string | null;
  country: string;
  category: string;
  network: string | null;
}

export function useChannel(channelId: string | null) {
  const [channel, setChannel] = useState<Channel | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!channelId) {
      setChannel(null);
      return;
    }

    setIsLoading(true);
    fetch(`/api/channels/${channelId}`)
      .then((res) => res.json())
      .then((data) => {
        setChannel(data.error ? null : data);
        setIsLoading(false);
      })
      .catch(() => {
        setChannel(null);
        setIsLoading(false);
      });
  }, [channelId]);

  return { channel, isLoading };
}
```

**Step 2: Create streams hook**

Create `src/hooks/use-streams.ts`:

```typescript
import { useState, useEffect } from 'react';

interface Stream {
  channel_id: string;
  url: string;
  quality: string | null;
  http_referrer: string | null;
  user_agent: string | null;
}

export function useStreams(channelId: string | null) {
  const [streams, setStreams] = useState<Stream[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!channelId) {
      setStreams([]);
      return;
    }

    setIsLoading(true);
    fetch(`/api/streams/${channelId}`)
      .then((res) => res.json())
      .then((data) => {
        setStreams(data);
        setIsLoading(false);
      })
      .catch(() => {
        setStreams([]);
        setIsLoading(false);
      });
  }, [channelId]);

  return { streams, isLoading };
}
```

**Step 3: Commit**

```bash
git add src/hooks/use-channel.ts src/hooks/use-streams.ts
git commit -m "feat: add useChannel and useStreams hooks"
```

---

### Task 10: Create Channels By IDs Hook

**Files:**
- Create: `src/hooks/use-channels-by-ids.ts`

**Step 1: Create channels by IDs hook**

Create `src/hooks/use-channels-by-ids.ts`:

```typescript
import { useState, useEffect } from 'react';

interface Channel {
  channel_id: string;
  name: string;
  logo: string | null;
  country: string;
  category: string;
  network: string | null;
}

export function useChannelsByIds(channelIds: string[]) {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (channelIds.length === 0) {
      setChannels([]);
      return;
    }

    setIsLoading(true);

    // Fetch each channel individually and combine
    Promise.all(
      channelIds.map((id) =>
        fetch(`/api/channels/${id}`)
          .then((res) => res.json())
          .then((data) => (data.error ? null : data))
          .catch(() => null)
      )
    ).then((results) => {
      setChannels(results.filter((ch): ch is Channel => ch !== null));
      setIsLoading(false);
    });
  }, [channelIds.join(',')]); // Join to create stable dependency

  return { channels, isLoading };
}
```

**Step 2: Commit**

```bash
git add src/hooks/use-channels-by-ids.ts
git commit -m "feat: add useChannelsByIds hook for favorites and history"
```

---

## Phase 4: Update Main Page

### Task 11: Update page.tsx to Use New Hooks

**Files:**
- Modify: `src/app/page.tsx`

**Step 1: Update imports and hooks**

Replace Convex imports and hooks in `src/app/page.tsx`:

```typescript
"use client";

import { Header } from "@/components/header";
import { Sidebar } from "@/components/sidebar";
import { ChannelGrid } from "@/components/channel-grid";
import { VideoPlayer } from "@/components/video-player";
import { FilterChips } from "@/components/filter-chips";
import { useFilters } from "@/hooks/use-filters";
import { useFavorites } from "@/hooks/use-favorites";
import { useHistory } from "@/hooks/use-history";
import { useCategories } from "@/hooks/use-categories";
import { useCountries } from "@/hooks/use-countries";
import { useChannels } from "@/hooks/use-channels";
import { useChannel } from "@/hooks/use-channel";
import { useStreams } from "@/hooks/use-streams";
import { useChannelsByIds } from "@/hooks/use-channels-by-ids";
import { useMemo, useState, useCallback, Suspense } from "react";

function HomeContent() {
  const { filters, updateFilters, clearFilters } = useFilters();
  const { favorites, toggleFavorite, clearFavorites } = useFavorites();
  const { addToHistory, getHistoryChannelIds, clearHistory, history } =
    useHistory();

  const [showFavorites, setShowFavorites] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const [favoritesSort, setFavoritesSort] = useState<
    "recent" | "most-watched" | "alphabetical"
  >("recent");

  const [historyTimeFilter, setHistoryTimeFilter] = useState<
    "today" | "week" | "all"
  >("all");

  const sidebarMode = showFavorites
    ? "favorites"
    : showHistory
      ? "history"
      : "browse";

  // Fetch reference data
  const { categories: categoriesData } = useCategories();
  const { countries: countriesData } = useCountries();

  // Fetch channels with pagination
  const {
    channels,
    isLoading: channelsLoading,
    hasMore,
    loadMore,
  } = useChannels({
    search: filters.search || undefined,
    countries: filters.countries.length ? filters.countries : undefined,
    categories: filters.categories.length ? filters.categories : undefined,
  });

  // Fetch favorite channels
  const { channels: favoriteChannels, isLoading: favoritesLoading } =
    useChannelsByIds(showFavorites ? favorites : []);

  // Fetch history channels
  const historyChannelIds = getHistoryChannelIds();
  const { channels: historyChannels, isLoading: historyLoading } =
    useChannelsByIds(showHistory ? historyChannelIds : []);

  // Fetch current playing channel and stream
  const { channel: playingChannel } = useChannel(filters.playing);
  const { streams: playingStreams } = useStreams(filters.playing);

  // Transform data for components
  const categoryOptions = useMemo(
    () =>
      categoriesData.map((c) => ({
        id: c.category_id,
        label: c.name,
      })),
    [categoriesData],
  );

  const countryOptions = useMemo(
    () =>
      countriesData.map((c) => ({
        id: c.code,
        label: c.name,
        icon: c.flag,
      })),
    [countriesData],
  );

  const countryFlags = useMemo(
    () =>
      countriesData.reduce(
        (acc, c) => {
          acc[c.code] = c.flag;
          return acc;
        },
        {} as Record<string, string>,
      ),
    [countriesData],
  );

  const now = Date.now();
  const oneDayAgo = now - 24 * 60 * 60 * 1000;
  const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;

  // Determine which channels to display
  const displayChannels = useMemo(() => {
    if (showFavorites) {
      if (favorites.length === 0) return [];

      const filtered = [...favoriteChannels];

      if (favoritesSort === "alphabetical") {
        filtered.sort((a, b) => a.name.localeCompare(b.name));
      } else if (favoritesSort === "recent") {
        const favoriteOrder = favorites.reduce(
          (acc, id, index) => {
            acc[id] = index;
            return acc;
          },
          {} as Record<string, number>,
        );
        filtered.sort(
          (a, b) =>
            (favoriteOrder[b.channel_id] ?? 0) -
            (favoriteOrder[a.channel_id] ?? 0),
        );
      } else if (favoritesSort === "most-watched") {
        const watchCounts = history.reduce(
          (acc, entry) => {
            acc[entry.channelId] = (acc[entry.channelId] || 0) + 1;
            return acc;
          },
          {} as Record<string, number>,
        );
        filtered.sort(
          (a, b) =>
            (watchCounts[b.channel_id] || 0) - (watchCounts[a.channel_id] || 0),
        );
      }

      return filtered;
    }

    if (showHistory) {
      if (history.length === 0) return [];

      let filtered = [...historyChannels];

      const filteredHistoryEntries = history.filter((entry) => {
        if (historyTimeFilter === "today") return entry.timestamp >= oneDayAgo;
        if (historyTimeFilter === "week") return entry.timestamp >= oneWeekAgo;
        return true;
      });

      const filteredChannelIds = new Set(
        filteredHistoryEntries.map((e) => e.channelId),
      );
      filtered = filtered.filter((channel) =>
        filteredChannelIds.has(channel.channel_id),
      );

      const timeOrder = filteredHistoryEntries.reduce(
        (acc, entry, index) => {
          acc[entry.channelId] = index;
          return acc;
        },
        {} as Record<string, number>,
      );
      filtered.sort(
        (a, b) =>
          (timeOrder[a.channel_id] ?? Infinity) -
          (timeOrder[b.channel_id] ?? Infinity),
      );

      return filtered;
    }

    return channels;
  }, [
    showFavorites,
    favoriteChannels,
    showHistory,
    historyChannels,
    channels,
    favoritesSort,
    favorites,
    history,
    historyTimeFilter,
    oneDayAgo,
    oneWeekAgo,
  ]);

  const filterChips = useMemo(() => {
    const chips: Array<{
      type: "category" | "country";
      id: string;
      label: string;
      icon?: string;
    }> = [];

    filters.categories.forEach((id) => {
      const cat = categoriesData.find((c) => c.category_id === id);
      if (cat) chips.push({ type: "category", id, label: cat.name });
    });

    filters.countries.forEach((id) => {
      const country = countriesData.find((c) => c.code === id);
      if (country)
        chips.push({
          type: "country",
          id,
          label: country.name,
          icon: country.flag,
        });
    });

    return chips;
  }, [filters, categoriesData, countriesData]);

  const activeFilterCount =
    filters.categories.length +
    filters.countries.length +
    (filters.search ? 1 : 0);

  const handlePlay = useCallback(
    (channelId: string) => {
      updateFilters({ playing: channelId });
      addToHistory(channelId);
    },
    [updateFilters, addToHistory],
  );

  const handleClosePlayer = useCallback(() => {
    updateFilters({ playing: null });
  }, [updateFilters]);

  const handleRemoveChip = useCallback(
    (type: "category" | "country", id: string) => {
      if (type === "category") {
        updateFilters({
          categories: filters.categories.filter((c) => c !== id),
        });
      } else {
        updateFilters({
          countries: filters.countries.filter((c) => c !== id),
        });
      }
    },
    [filters, updateFilters],
  );

  const handleShowFavorites = (show: boolean) => {
    setShowFavorites(show);
    if (show) setShowHistory(false);
  };

  const handleShowHistory = (show: boolean) => {
    setShowHistory(show);
    if (show) setShowFavorites(false);
  };

  const handleBackToBrowse = useCallback(() => {
    setShowFavorites(false);
    setShowHistory(false);
  }, []);

  const handleClearFavorites = useCallback(() => {
    clearFavorites();
  }, [clearFavorites]);

  const handleClearHistory = useCallback(() => {
    clearHistory();
  }, [clearHistory]);

  const handleLoadMore = useCallback(() => {
    loadMore();
  }, [loadMore]);

  const isLoading = useMemo(() => {
    if (showFavorites) {
      return favorites.length > 0 && favoritesLoading;
    }
    if (showHistory) {
      return historyChannelIds.length > 0 && historyLoading;
    }
    return channelsLoading;
  }, [showFavorites, showHistory, favorites.length, favoritesLoading, historyChannelIds.length, historyLoading, channelsLoading]);

  // Map channel data to expected format
  const mappedChannels = useMemo(() => {
    return displayChannels.map((ch) => ({
      channelId: ch.channel_id,
      name: ch.name,
      logo: ch.logo ?? undefined,
      country: ch.country,
      category: ch.category,
      network: ch.network ?? undefined,
    }));
  }, [displayChannels]);

  return (
    <div className="min-h-screen bg-background">
      <Header
        search={filters.search}
        onSearchChange={(search) => updateFilters({ search })}
        categories={categoryOptions}
        selectedCategories={filters.categories}
        onCategoriesChange={(categories) => updateFilters({ categories })}
        countries={countryOptions}
        selectedCountries={filters.countries}
        onCountriesChange={(countries) => updateFilters({ countries })}
        showFavorites={showFavorites}
        onShowFavoritesChange={handleShowFavorites}
        showHistory={showHistory}
        onShowHistoryChange={handleShowHistory}
        activeFilterCount={activeFilterCount}
      />

      <div className="flex">
        <Sidebar
          className="hidden lg:flex w-72 shrink-0 border-r h-[calc(100vh-3.5rem)] sticky top-14"
          mode={sidebarMode}
          search={filters.search}
          onSearchChange={(search) => updateFilters({ search })}
          categories={categoryOptions}
          selectedCategories={filters.categories}
          onCategoriesChange={(categories) => updateFilters({ categories })}
          countries={countryOptions}
          selectedCountries={filters.countries}
          onCountriesChange={(countries) => updateFilters({ countries })}
          showFavorites={showFavorites}
          onShowFavoritesChange={handleShowFavorites}
          showHistory={showHistory}
          onShowHistoryChange={handleShowHistory}
          onBackToBrowse={handleBackToBrowse}
          favoriteCount={favorites.length}
          historyCount={history.length}
          favoritesSort={favoritesSort}
          onFavoritesSortChange={setFavoritesSort}
          historyTimeFilter={historyTimeFilter}
          onHistoryTimeFilterChange={setHistoryTimeFilter}
          onClearFavorites={handleClearFavorites}
          onClearHistory={handleClearHistory}
        />

        <main className="flex-1 p-4 lg:p-6">
          {filters.playing && playingChannel && (
            <div className="mb-6">
              <VideoPlayer
                channelName={playingChannel.name}
                stream={playingStreams?.[0] ? {
                  url: playingStreams[0].url,
                  quality: playingStreams[0].quality ?? undefined,
                  httpReferrer: playingStreams[0].http_referrer ?? undefined,
                  userAgent: playingStreams[0].user_agent ?? undefined,
                } : null}
                onClose={handleClosePlayer}
              />
            </div>
          )}

          <div className="mb-4">
            <FilterChips
              chips={filterChips}
              onRemove={handleRemoveChip}
              onClearAll={clearFilters}
            />
          </div>

          <ChannelGrid
            channels={mappedChannels}
            countryFlags={countryFlags}
            playingChannelId={filters.playing ?? undefined}
            favorites={favorites}
            onPlay={handlePlay}
            onToggleFavorite={toggleFavorite}
            isLoading={isLoading}
            hasMore={hasMore && !showFavorites && !showHistory}
            onLoadMore={handleLoadMore}
            mode={sidebarMode}
          />
        </main>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<div className="p-8">Loading...</div>}>
      <HomeContent />
    </Suspense>
  );
}
```

**Step 2: Commit**

```bash
git add src/app/page.tsx
git commit -m "refactor: update page.tsx to use new fetch-based hooks"
```

---

## Phase 5: Remove Convex

### Task 12: Remove Convex Dependencies and Files

**Files:**
- Delete: `convex/` directory
- Modify: `package.json`
- Delete: `src/app/layout.tsx` (Convex provider removal)

**Step 1: Delete convex directory**

```bash
rm -rf convex/
```

**Step 2: Remove Convex from package.json**

Remove these dependencies from package.json:
- `convex`
- `convex-helpers`

**Step 3: Update layout.tsx to remove ConvexClientProvider**

Update `src/app/layout.tsx` to remove the Convex provider wrapper.

**Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove Convex dependencies and files"
```

---

## Phase 6: Cloudflare Configuration

### Task 13: Add Cloudflare/OpenNext Configuration

**Files:**
- Create: `wrangler.toml`
- Modify: `next.config.ts`
- Modify: `package.json`

**Step 1: Install OpenNext dependencies**

```bash
npm install @opennextjs/cloudflare @cloudflare/next-on-pages wrangler --save-dev
```

**Step 2: Create wrangler.toml**

Create `wrangler.toml`:

```toml
name = "iptv"
compatibility_date = "2024-01-01"
compatibility_flags = ["nodejs_compat"]

[[d1_databases]]
binding = "DB"
database_name = "iptv-db"
database_id = "<your-d1-database-id>"
```

**Step 3: Update next.config.ts**

Add edge runtime configuration to `next.config.ts`.

**Step 4: Add scripts to package.json**

Add to scripts:
```json
{
  "pages:build": "npx @cloudflare/next-on-pages",
  "pages:preview": "npm run pages:build && wrangler pages dev .vercel/output/static",
  "pages:deploy": "npm run pages:build && wrangler pages deploy .vercel/output/static"
}
```

**Step 5: Commit**

```bash
git add wrangler.toml next.config.ts package.json package-lock.json
git commit -m "feat: add Cloudflare Pages configuration"
```

---

## Phase 7: Sync Worker

### Task 14: Create Sync Worker Project

**Files:**
- Create: `iptv-sync-worker/` directory structure

**Step 1: Create worker directory and files**

```bash
mkdir -p iptv-sync-worker/src
```

Create `iptv-sync-worker/package.json`:

```json
{
  "name": "iptv-sync-worker",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy"
  },
  "devDependencies": {
    "wrangler": "^3.0.0",
    "@cloudflare/workers-types": "^4.0.0",
    "typescript": "^5.0.0"
  }
}
```

Create `iptv-sync-worker/wrangler.toml`:

```toml
name = "iptv-sync-worker"
main = "src/index.ts"
compatibility_date = "2024-01-01"

[[d1_databases]]
binding = "DB"
database_name = "iptv-db"
database_id = "<your-d1-database-id>"

[triggers]
crons = ["0 3 * * *"]
```

Create `iptv-sync-worker/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2021",
    "module": "ESNext",
    "moduleResolution": "node",
    "strict": true,
    "types": ["@cloudflare/workers-types"]
  }
}
```

**Step 2: Commit structure**

```bash
git add iptv-sync-worker/
git commit -m "feat: add sync worker project structure"
```

---

### Task 15: Implement Sync Worker Logic

**Files:**
- Create: `iptv-sync-worker/src/index.ts`

**Step 1: Create worker implementation**

Create `iptv-sync-worker/src/index.ts`:

```typescript
interface Env {
  DB: D1Database;
}

const API_BASE = "https://iptv-org.github.io/api";
const LOGOS_URL = "https://raw.githubusercontent.com/iptv-org/database/master/data/logos.csv";

interface ApiChannel {
  id: string;
  name: string;
  country: string;
  categories?: string[];
  network?: string;
  is_nsfw?: boolean;
  closed?: string;
}

interface ApiStream {
  channel: string;
  url: string;
  quality?: string;
  http_referrer?: string;
  user_agent?: string;
}

interface ApiCategory {
  id: string;
  name: string;
}

interface ApiCountry {
  code: string;
  name: string;
  flag?: string;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function calculateLogoScore(
  feed: string,
  tags: string,
  width: string,
  height: string,
  format: string
): number {
  let score = 0;
  if (!feed) score += 1000;
  const size = (parseInt(width) || 0) * (parseInt(height) || 0);
  score += Math.min(size / 1000, 500);
  if (tags?.includes("color")) score += 100;
  if (tags?.includes("picons")) score -= 50;
  if (format === "PNG") score += 50;
  else if (format === "JPEG") score += 30;
  else if (format === "SVG") score += 20;
  return score;
}

function parseLogosCSV(csv: string): Map<string, string> {
  const lines = csv.split("\n");
  const logoMap = new Map<string, { url: string; score: number }>();

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = parseCSVLine(line);
    if (values.length < 7) continue;

    const [channel, feed, tags, width, height, format, url] = values;
    if (!channel || !url) continue;

    const score = calculateLogoScore(feed, tags, width, height, format);
    const existing = logoMap.get(channel);
    if (!existing || score > existing.score) {
      logoMap.set(channel, { url, score });
    }
  }

  return new Map([...logoMap].map(([k, v]) => [k, v.url]));
}

export default {
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    console.log("Starting IPTV data sync...");

    try {
      const [channelsRes, streamsRes, categoriesRes, countriesRes, logosRes] =
        await Promise.all([
          fetch(`${API_BASE}/channels.json`),
          fetch(`${API_BASE}/streams.json`),
          fetch(`${API_BASE}/categories.json`),
          fetch(`${API_BASE}/countries.json`),
          fetch(LOGOS_URL),
        ]);

      const [channels, streams, categories, countries, logosCSV] =
        await Promise.all([
          channelsRes.json() as Promise<ApiChannel[]>,
          streamsRes.json() as Promise<ApiStream[]>,
          categoriesRes.json() as Promise<ApiCategory[]>,
          countriesRes.json() as Promise<ApiCountry[]>,
          logosRes.text(),
        ]);

      const logoMap = parseLogosCSV(logosCSV);
      console.log(`Parsed ${logoMap.size} channel logos`);

      const safeChannels = channels.filter(
        (c) => !c.is_nsfw && !c.closed && c.id && c.country
      );

      const validStreams = streams.filter((s) => s.channel && s.url);

      console.log(
        `Fetched ${safeChannels.length} safe channels, ${validStreams.length} valid streams`
      );

      // Delete all existing data
      await env.DB.batch([
        env.DB.prepare("DELETE FROM channels"),
        env.DB.prepare("DELETE FROM streams"),
        env.DB.prepare("DELETE FROM categories"),
        env.DB.prepare("DELETE FROM countries"),
      ]);

      // Insert categories
      const categoryStmts = categories.map((c) =>
        env.DB.prepare(
          "INSERT INTO categories (category_id, name) VALUES (?, ?)"
        ).bind(c.id, c.name)
      );
      await env.DB.batch(categoryStmts);

      // Insert countries
      const countryStmts = countries.map((c) =>
        env.DB.prepare(
          "INSERT INTO countries (code, name, flag) VALUES (?, ?, ?)"
        ).bind(c.code, c.name, c.flag || "")
      );
      await env.DB.batch(countryStmts);

      // Insert channels in batches of 100
      const BATCH_SIZE = 100;
      for (let i = 0; i < safeChannels.length; i += BATCH_SIZE) {
        const batch = safeChannels.slice(i, i + BATCH_SIZE);
        const stmts = batch.map((c) =>
          env.DB.prepare(
            "INSERT INTO channels (channel_id, name, logo, country, category, network) VALUES (?, ?, ?, ?, ?, ?)"
          ).bind(
            c.id,
            c.name,
            logoMap.get(c.id) || null,
            c.country,
            c.categories?.[0] || "general",
            c.network || null
          )
        );
        await env.DB.batch(stmts);
      }

      // Insert streams in batches
      for (let i = 0; i < validStreams.length; i += BATCH_SIZE) {
        const batch = validStreams.slice(i, i + BATCH_SIZE);
        const stmts = batch.map((s) =>
          env.DB.prepare(
            "INSERT INTO streams (channel_id, url, quality, http_referrer, user_agent) VALUES (?, ?, ?, ?, ?)"
          ).bind(
            s.channel,
            s.url,
            s.quality || null,
            s.http_referrer || null,
            s.user_agent || null
          )
        );
        await env.DB.batch(stmts);
      }

      // Update sync status
      await env.DB.prepare(
        "INSERT INTO sync_status (last_sync_at, status, channel_count) VALUES (?, ?, ?)"
      ).bind(Date.now(), "success", safeChannels.length).run();

      console.log("Sync completed successfully");
    } catch (error) {
      console.error("Sync failed:", error);
      await env.DB.prepare(
        "INSERT INTO sync_status (last_sync_at, status, error) VALUES (?, ?, ?)"
      ).bind(Date.now(), "error", String(error)).run();
    }
  },
};
```

**Step 2: Commit**

```bash
git add iptv-sync-worker/src/index.ts
git commit -m "feat: implement sync worker with IPTV-ORG data fetch"
```

---

## Phase 8: Environment Type Definitions

### Task 16: Add Cloudflare Environment Types

**Files:**
- Create: `src/env.d.ts`

**Step 1: Create environment type definitions**

Create `src/env.d.ts`:

```typescript
interface CloudflareEnv {
  DB: D1Database;
}

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      [key: string]: string | undefined;
    }
  }
}

export {};
```

**Step 2: Commit**

```bash
git add src/env.d.ts
git commit -m "feat: add Cloudflare environment type definitions"
```

---

## Phase 9: Final Cleanup

### Task 17: Update CLAUDE.md and Clean Up

**Files:**
- Modify: `CLAUDE.md`
- Delete: `.env.local` references to Convex

**Step 1: Update CLAUDE.md with new architecture**

Update CLAUDE.md to reflect Cloudflare architecture instead of Convex.

**Step 2: Final commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md for Cloudflare architecture"
```

---

## Deployment Checklist

After all tasks complete:

1. Create D1 database: `npx wrangler d1 create iptv-db`
2. Update `database_id` in both `wrangler.toml` files
3. Apply schema: `npx wrangler d1 execute iptv-db --file=schema.sql`
4. Deploy sync worker: `cd iptv-sync-worker && npm install && npm run deploy`
5. Trigger initial sync via Cloudflare dashboard
6. Deploy Next.js: `npm run pages:deploy`
7. Verify app works at Cloudflare Pages URL
