# IPTV Platform Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a modern IPTV channel browser with search, filters, and video playback.

**Architecture:** Next.js App Router frontend with Convex backend. Daily cron syncs channel data from iptv-org API. Shaka Player handles HLS/DASH streams. URL params for shareable filter state, localStorage for favorites/history.

**Tech Stack:** Next.js 15, Convex, Tailwind CSS, shadcn/ui, Shaka Player

---

## Phase 1: Project Setup

### Task 1.1: Initialize Next.js Project

**Files:**
- Create: `package.json`, `next.config.ts`, `tsconfig.json`, etc. (via create-next-app)

**Step 1: Create Next.js app with TypeScript and Tailwind**

```bash
cd /Users/pankajbeniwal/Code/iptv/.worktrees/feature-mvp
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm
```

Select: No to Turbopack (use stable webpack)

**Step 2: Verify installation**

```bash
npm run dev
```

Expected: Server starts at http://localhost:3000

**Step 3: Stop dev server and commit**

```bash
git add -A
git commit -m "chore: initialize Next.js 15 with TypeScript and Tailwind"
```

---

### Task 1.2: Initialize Convex

**Files:**
- Create: `convex/` directory, `convex.json`

**Step 1: Install Convex**

```bash
npm install convex
```

**Step 2: Initialize Convex project**

```bash
npx convex init
```

Follow prompts to create new project (name: "iptv" or similar)

**Step 3: Verify Convex files created**

Expected files:
- `convex/_generated/` (auto-generated)
- `convex.json`

**Step 4: Commit**

```bash
git add -A
git commit -m "chore: initialize Convex backend"
```

---

### Task 1.3: Install and Configure shadcn/ui

**Files:**
- Create: `components.json`, `src/components/ui/`
- Modify: `tailwind.config.ts`, `src/app/globals.css`

**Step 1: Initialize shadcn/ui**

```bash
npx shadcn@latest init
```

Select:
- Style: Default
- Base color: Slate
- CSS variables: Yes

**Step 2: Add required components**

```bash
npx shadcn@latest add button checkbox input badge scroll-area sheet skeleton
```

**Step 3: Verify dark mode setup in tailwind.config.ts**

Ensure `darkMode: "class"` is set.

**Step 4: Update globals.css for dark-only mode**

Add to `src/app/globals.css` after the existing content:

```css
/* Force dark mode */
:root {
  color-scheme: dark;
}
```

**Step 5: Commit**

```bash
git add -A
git commit -m "chore: add shadcn/ui with dark mode components"
```

---

### Task 1.4: Set Up Convex Provider

**Files:**
- Create: `src/components/providers/convex-provider.tsx`
- Modify: `src/app/layout.tsx`

**Step 1: Create Convex provider component**

Create `src/components/providers/convex-provider.tsx`:

```typescript
"use client";

import { ConvexProvider, ConvexReactClient } from "convex/react";
import { ReactNode } from "react";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  return <ConvexProvider client={convex}>{children}</ConvexProvider>;
}
```

**Step 2: Update layout.tsx to wrap app with provider**

Modify `src/app/layout.tsx`:

```typescript
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ConvexClientProvider } from "@/components/providers/convex-provider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "IPTV Browser",
  description: "Browse and watch IPTV channels from around the world",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={inter.className}>
        <ConvexClientProvider>{children}</ConvexClientProvider>
      </body>
    </html>
  );
}
```

**Step 3: Verify app still loads**

```bash
npm run dev
```

Expected: App loads without errors (Convex URL warning OK for now)

**Step 4: Commit**

```bash
git add -A
git commit -m "feat: add Convex provider to app layout"
```

---

## Phase 2: Convex Schema and Queries

### Task 2.1: Define Database Schema

**Files:**
- Create: `convex/schema.ts`

**Step 1: Create schema file**

Create `convex/schema.ts`:

```typescript
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  channels: defineTable({
    channelId: v.string(),
    name: v.string(),
    logo: v.optional(v.string()),
    country: v.string(),
    categories: v.array(v.string()),
    languages: v.array(v.string()),
    network: v.optional(v.string()),
  })
    .index("by_channelId", ["channelId"])
    .index("by_country", ["country"])
    .searchIndex("search_name", { searchField: "name" }),

  streams: defineTable({
    channelId: v.string(),
    url: v.string(),
    quality: v.optional(v.string()),
    httpReferrer: v.optional(v.string()),
    userAgent: v.optional(v.string()),
  }).index("by_channelId", ["channelId"]),

  categories: defineTable({
    categoryId: v.string(),
    name: v.string(),
  }).index("by_categoryId", ["categoryId"]),

  countries: defineTable({
    code: v.string(),
    name: v.string(),
    flag: v.string(),
    languages: v.array(v.string()),
  }).index("by_code", ["code"]),

  languages: defineTable({
    code: v.string(),
    name: v.string(),
  }).index("by_code", ["code"]),

  syncStatus: defineTable({
    lastSyncAt: v.number(),
    status: v.string(),
    channelCount: v.optional(v.number()),
    error: v.optional(v.string()),
  }),
});
```

**Step 2: Push schema to Convex**

```bash
npx convex dev
```

Let it run to sync schema, then stop with Ctrl+C.

**Step 3: Commit**

```bash
git add -A
git commit -m "feat: add Convex database schema"
```

---

### Task 2.2: Create Channel Queries

**Files:**
- Create: `convex/channels.ts`

**Step 1: Create channels query file**

Create `convex/channels.ts`:

```typescript
import { query } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {
    countries: v.optional(v.array(v.string())),
    categories: v.optional(v.array(v.string())),
    languages: v.optional(v.array(v.string())),
    search: v.optional(v.string()),
    cursor: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 48;

    // If search is provided, use search index
    if (args.search && args.search.trim()) {
      const results = await ctx.db
        .query("channels")
        .withSearchIndex("search_name", (q) => q.search("name", args.search!))
        .take(limit);

      // Apply filters to search results
      return filterChannels(results, args);
    }

    // Otherwise, get all channels with pagination
    let query = ctx.db.query("channels");

    const results = await query.collect();

    // Apply filters
    const filtered = filterChannels(results, args);

    // Manual pagination
    const startIndex = args.cursor ? parseInt(args.cursor) : 0;
    const paginated = filtered.slice(startIndex, startIndex + limit);
    const nextCursor =
      startIndex + limit < filtered.length
        ? String(startIndex + limit)
        : undefined;

    return {
      channels: paginated,
      nextCursor,
      totalCount: filtered.length,
    };
  },
});

function filterChannels(
  channels: any[],
  args: {
    countries?: string[];
    categories?: string[];
    languages?: string[];
  }
) {
  return channels.filter((channel) => {
    if (args.countries?.length) {
      if (!args.countries.includes(channel.country)) return false;
    }
    if (args.categories?.length) {
      if (!channel.categories.some((c: string) => args.categories!.includes(c)))
        return false;
    }
    if (args.languages?.length) {
      if (!channel.languages.some((l: string) => args.languages!.includes(l)))
        return false;
    }
    return true;
  });
}

export const getById = query({
  args: { channelId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("channels")
      .withIndex("by_channelId", (q) => q.eq("channelId", args.channelId))
      .first();
  },
});

export const getByIds = query({
  args: { channelIds: v.array(v.string()) },
  handler: async (ctx, args) => {
    const channels = await Promise.all(
      args.channelIds.map((id) =>
        ctx.db
          .query("channels")
          .withIndex("by_channelId", (q) => q.eq("channelId", id))
          .first()
      )
    );
    return channels.filter(Boolean);
  },
});
```

**Step 2: Verify no TypeScript errors**

```bash
npx convex dev
```

**Step 3: Commit**

```bash
git add -A
git commit -m "feat: add channel list and getById queries"
```

---

### Task 2.3: Create Stream Queries

**Files:**
- Create: `convex/streams.ts`

**Step 1: Create streams query file**

Create `convex/streams.ts`:

```typescript
import { query } from "./_generated/server";
import { v } from "convex/values";

export const getByChannelId = query({
  args: { channelId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("streams")
      .withIndex("by_channelId", (q) => q.eq("channelId", args.channelId))
      .collect();
  },
});
```

**Step 2: Commit**

```bash
git add -A
git commit -m "feat: add stream query by channel ID"
```

---

### Task 2.4: Create Reference Data Queries

**Files:**
- Create: `convex/categories.ts`, `convex/countries.ts`, `convex/languages.ts`

**Step 1: Create categories query**

Create `convex/categories.ts`:

```typescript
import { query } from "./_generated/server";

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("categories").collect();
  },
});
```

**Step 2: Create countries query**

Create `convex/countries.ts`:

```typescript
import { query } from "./_generated/server";

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("countries").collect();
  },
});
```

**Step 3: Create languages query**

Create `convex/languages.ts`:

```typescript
import { query } from "./_generated/server";

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("languages").collect();
  },
});
```

**Step 4: Commit**

```bash
git add -A
git commit -m "feat: add category, country, and language queries"
```

---

## Phase 3: Data Sync

### Task 3.1: Create Sync Functions

**Files:**
- Create: `convex/sync.ts`

**Step 1: Create sync functions**

Create `convex/sync.ts`:

```typescript
import { internalAction, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

const API_BASE = "https://iptv-org.github.io/api";

export const syncAll = internalAction({
  args: {},
  handler: async (ctx) => {
    console.log("Starting IPTV data sync...");

    try {
      // Fetch all data in parallel
      const [channelsRes, streamsRes, categoriesRes, countriesRes, languagesRes] =
        await Promise.all([
          fetch(`${API_BASE}/channels.json`),
          fetch(`${API_BASE}/streams.json`),
          fetch(`${API_BASE}/categories.json`),
          fetch(`${API_BASE}/countries.json`),
          fetch(`${API_BASE}/languages.json`),
        ]);

      const [channels, streams, categories, countries, languages] =
        await Promise.all([
          channelsRes.json(),
          streamsRes.json(),
          categoriesRes.json(),
          countriesRes.json(),
          languagesRes.json(),
        ]);

      // Filter out NSFW channels
      const safeChannels = channels.filter(
        (c: any) => !c.is_nsfw && !c.closed
      );

      console.log(`Fetched ${safeChannels.length} safe channels`);

      // Sync each data type
      await ctx.runMutation(internal.sync.upsertCategories, {
        categories: categories.map((c: any) => ({
          categoryId: c.id,
          name: c.name,
        })),
      });

      await ctx.runMutation(internal.sync.upsertCountries, {
        countries: countries.map((c: any) => ({
          code: c.code,
          name: c.name,
          flag: c.flag || "",
          languages: c.languages || [],
        })),
      });

      await ctx.runMutation(internal.sync.upsertLanguages, {
        languages: languages.map((l: any) => ({
          code: l.code,
          name: l.name,
        })),
      });

      // Sync channels in batches
      const BATCH_SIZE = 100;
      for (let i = 0; i < safeChannels.length; i += BATCH_SIZE) {
        const batch = safeChannels.slice(i, i + BATCH_SIZE);
        await ctx.runMutation(internal.sync.upsertChannelsBatch, {
          channels: batch.map((c: any) => ({
            channelId: c.id,
            name: c.name,
            logo: c.logo || undefined,
            country: c.country,
            categories: c.categories || [],
            languages: c.languages || [],
            network: c.network || undefined,
          })),
        });
      }

      // Sync streams in batches
      for (let i = 0; i < streams.length; i += BATCH_SIZE) {
        const batch = streams.slice(i, i + BATCH_SIZE);
        await ctx.runMutation(internal.sync.upsertStreamsBatch, {
          streams: batch.map((s: any) => ({
            channelId: s.channel,
            url: s.url,
            quality: s.quality || undefined,
            httpReferrer: s.http_referrer || undefined,
            userAgent: s.user_agent || undefined,
          })),
        });
      }

      // Update sync status
      await ctx.runMutation(internal.sync.updateSyncStatus, {
        status: "success",
        channelCount: safeChannels.length,
      });

      console.log("Sync completed successfully");
    } catch (error) {
      console.error("Sync failed:", error);
      await ctx.runMutation(internal.sync.updateSyncStatus, {
        status: "error",
        error: String(error),
      });
    }
  },
});

export const upsertCategories = internalMutation({
  args: {
    categories: v.array(
      v.object({
        categoryId: v.string(),
        name: v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    for (const category of args.categories) {
      const existing = await ctx.db
        .query("categories")
        .withIndex("by_categoryId", (q) => q.eq("categoryId", category.categoryId))
        .first();

      if (existing) {
        await ctx.db.patch(existing._id, category);
      } else {
        await ctx.db.insert("categories", category);
      }
    }
  },
});

export const upsertCountries = internalMutation({
  args: {
    countries: v.array(
      v.object({
        code: v.string(),
        name: v.string(),
        flag: v.string(),
        languages: v.array(v.string()),
      })
    ),
  },
  handler: async (ctx, args) => {
    for (const country of args.countries) {
      const existing = await ctx.db
        .query("countries")
        .withIndex("by_code", (q) => q.eq("code", country.code))
        .first();

      if (existing) {
        await ctx.db.patch(existing._id, country);
      } else {
        await ctx.db.insert("countries", country);
      }
    }
  },
});

export const upsertLanguages = internalMutation({
  args: {
    languages: v.array(
      v.object({
        code: v.string(),
        name: v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    for (const language of args.languages) {
      const existing = await ctx.db
        .query("languages")
        .withIndex("by_code", (q) => q.eq("code", language.code))
        .first();

      if (existing) {
        await ctx.db.patch(existing._id, language);
      } else {
        await ctx.db.insert("languages", language);
      }
    }
  },
});

export const upsertChannelsBatch = internalMutation({
  args: {
    channels: v.array(
      v.object({
        channelId: v.string(),
        name: v.string(),
        logo: v.optional(v.string()),
        country: v.string(),
        categories: v.array(v.string()),
        languages: v.array(v.string()),
        network: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, args) => {
    for (const channel of args.channels) {
      const existing = await ctx.db
        .query("channels")
        .withIndex("by_channelId", (q) => q.eq("channelId", channel.channelId))
        .first();

      if (existing) {
        await ctx.db.patch(existing._id, channel);
      } else {
        await ctx.db.insert("channels", channel);
      }
    }
  },
});

export const upsertStreamsBatch = internalMutation({
  args: {
    streams: v.array(
      v.object({
        channelId: v.string(),
        url: v.string(),
        quality: v.optional(v.string()),
        httpReferrer: v.optional(v.string()),
        userAgent: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, args) => {
    for (const stream of args.streams) {
      const existing = await ctx.db
        .query("streams")
        .withIndex("by_channelId", (q) => q.eq("channelId", stream.channelId))
        .first();

      if (existing) {
        await ctx.db.patch(existing._id, stream);
      } else {
        await ctx.db.insert("streams", stream);
      }
    }
  },
});

export const updateSyncStatus = internalMutation({
  args: {
    status: v.string(),
    channelCount: v.optional(v.number()),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("syncStatus", {
      lastSyncAt: Date.now(),
      status: args.status,
      channelCount: args.channelCount,
      error: args.error,
    });
  },
});
```

**Step 2: Deploy and verify**

```bash
npx convex dev
```

**Step 3: Commit**

```bash
git add -A
git commit -m "feat: add data sync functions from iptv-org API"
```

---

### Task 3.2: Create Cron Schedule

**Files:**
- Create: `convex/crons.ts`

**Step 1: Create cron file**

Create `convex/crons.ts`:

```typescript
import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Run daily at 3:00 UTC
crons.daily(
  "sync iptv data",
  { hourUTC: 3, minuteUTC: 0 },
  internal.sync.syncAll
);

export default crons;
```

**Step 2: Create manual sync action for testing**

Create `convex/actions.ts`:

```typescript
import { action } from "./_generated/server";
import { internal } from "./_generated/api";

export const triggerSync = action({
  args: {},
  handler: async (ctx) => {
    await ctx.runAction(internal.sync.syncAll);
    return { success: true };
  },
});
```

**Step 3: Deploy**

```bash
npx convex dev
```

**Step 4: Commit**

```bash
git add -A
git commit -m "feat: add daily cron job and manual sync trigger"
```

---

### Task 3.3: Run Initial Data Sync

**Step 1: Start Convex dev server**

```bash
npx convex dev
```

**Step 2: In another terminal, trigger sync**

```bash
npx convex run actions:triggerSync
```

**Step 3: Verify data in Convex dashboard**

Go to Convex dashboard and check:
- channels table has ~30k records
- categories table has ~30 records
- countries table has ~200 records
- streams table has records

**Step 4: No commit needed (data sync only)**

---

## Phase 4: Core UI Components

### Task 4.1: Create Utility Helpers

**Files:**
- Create: `src/lib/utils.ts`

**Step 1: Create utils file**

Create `src/lib/utils.ts` (may already exist from shadcn, extend it):

```typescript
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function debounce<T extends (...args: any[]) => void>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}
```

**Step 2: Commit**

```bash
git add -A
git commit -m "feat: add utility helpers"
```

---

### Task 4.2: Create Search Input Component

**Files:**
- Create: `src/components/search-input.tsx`

**Step 1: Create search input**

Create `src/components/search-input.tsx`:

```typescript
"use client";

import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { useCallback, useState } from "react";
import { debounce } from "@/lib/utils";

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function SearchInput({
  value,
  onChange,
  placeholder = "Search channels...",
}: SearchInputProps) {
  const [localValue, setLocalValue] = useState(value);

  const debouncedOnChange = useCallback(
    debounce((val: string) => onChange(val), 300),
    [onChange]
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setLocalValue(newValue);
    debouncedOnChange(newValue);
  };

  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="text"
        placeholder={placeholder}
        value={localValue}
        onChange={handleChange}
        className="pl-9"
      />
    </div>
  );
}
```

**Step 2: Install lucide-react if needed**

```bash
npm install lucide-react
```

**Step 3: Commit**

```bash
git add -A
git commit -m "feat: add debounced search input component"
```

---

### Task 4.3: Create Channel Card Component

**Files:**
- Create: `src/components/channel-card.tsx`

**Step 1: Create channel card**

Create `src/components/channel-card.tsx`:

```typescript
"use client";

import { Badge } from "@/components/ui/badge";
import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";

interface Channel {
  _id: string;
  channelId: string;
  name: string;
  logo?: string;
  country: string;
  categories: string[];
}

interface ChannelCardProps {
  channel: Channel;
  countryFlag?: string;
  isPlaying?: boolean;
  isFavorite?: boolean;
  onPlay: (channelId: string) => void;
  onToggleFavorite: (channelId: string) => void;
}

export function ChannelCard({
  channel,
  countryFlag,
  isPlaying,
  isFavorite,
  onPlay,
  onToggleFavorite,
}: ChannelCardProps) {
  return (
    <div
      className={cn(
        "group relative flex flex-col rounded-lg border bg-card p-3 transition-all hover:shadow-lg hover:-translate-y-0.5 cursor-pointer",
        isPlaying && "ring-2 ring-primary"
      )}
      onClick={() => onPlay(channel.channelId)}
    >
      {/* Logo */}
      <div className="relative aspect-video w-full overflow-hidden rounded-md bg-muted mb-2">
        {channel.logo ? (
          <img
            src={channel.logo}
            alt={channel.name}
            className="h-full w-full object-contain"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-4xl">
            {countryFlag || "📺"}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-medium text-sm">{channel.name}</h3>
          <div className="flex items-center gap-1 mt-1">
            {countryFlag && <span className="text-sm">{countryFlag}</span>}
            {channel.categories[0] && (
              <Badge variant="secondary" className="text-xs">
                {channel.categories[0]}
              </Badge>
            )}
          </div>
        </div>

        {/* Favorite button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite(channel.channelId);
          }}
          className={cn(
            "p-1 rounded-full transition-colors",
            isFavorite
              ? "text-red-500 hover:text-red-600"
              : "text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100"
          )}
        >
          <Heart
            className="h-4 w-4"
            fill={isFavorite ? "currentColor" : "none"}
          />
        </button>
      </div>

      {/* Playing indicator */}
      {isPlaying && (
        <div className="absolute top-2 left-2 flex items-center gap-1 rounded bg-primary px-2 py-0.5 text-xs text-primary-foreground">
          <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
          LIVE
        </div>
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add -A
git commit -m "feat: add channel card component with favorite toggle"
```

---

### Task 4.4: Create Channel Grid Component

**Files:**
- Create: `src/components/channel-grid.tsx`

**Step 1: Create channel grid**

Create `src/components/channel-grid.tsx`:

```typescript
"use client";

import { ChannelCard } from "./channel-card";
import { Skeleton } from "@/components/ui/skeleton";
import { useEffect, useRef } from "react";

interface Channel {
  _id: string;
  channelId: string;
  name: string;
  logo?: string;
  country: string;
  categories: string[];
}

interface ChannelGridProps {
  channels: Channel[];
  countryFlags: Record<string, string>;
  playingChannelId?: string;
  favorites: string[];
  onPlay: (channelId: string) => void;
  onToggleFavorite: (channelId: string) => void;
  onLoadMore?: () => void;
  hasMore?: boolean;
  isLoading?: boolean;
}

export function ChannelGrid({
  channels,
  countryFlags,
  playingChannelId,
  favorites,
  onPlay,
  onToggleFavorite,
  onLoadMore,
  hasMore,
  isLoading,
}: ChannelGridProps) {
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Infinite scroll
  useEffect(() => {
    if (!onLoadMore || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          onLoadMore();
        }
      },
      { threshold: 0.1 }
    );

    if (sentinelRef.current) {
      observer.observe(sentinelRef.current);
    }

    return () => observer.disconnect();
  }, [onLoadMore, hasMore]);

  if (isLoading && channels.length === 0) {
    return (
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {Array.from({ length: 20 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-2">
            <Skeleton className="aspect-video w-full rounded-md" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {channels.map((channel) => (
          <ChannelCard
            key={channel._id}
            channel={channel}
            countryFlag={countryFlags[channel.country]}
            isPlaying={playingChannelId === channel.channelId}
            isFavorite={favorites.includes(channel.channelId)}
            onPlay={onPlay}
            onToggleFavorite={onToggleFavorite}
          />
        ))}
      </div>

      {/* Sentinel for infinite scroll */}
      {hasMore && (
        <div ref={sentinelRef} className="flex justify-center py-8">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      )}
    </>
  );
}
```

**Step 2: Commit**

```bash
git add -A
git commit -m "feat: add channel grid with infinite scroll"
```

---

### Task 4.5: Create Filter Section Component

**Files:**
- Create: `src/components/filter-section.tsx`

**Step 1: Create filter section**

Create `src/components/filter-section.tsx`:

```typescript
"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChevronDown, ChevronRight, Search } from "lucide-react";
import { useState } from "react";

interface FilterOption {
  id: string;
  label: string;
  count?: number;
  icon?: string;
}

interface FilterSectionProps {
  title: string;
  options: FilterOption[];
  selected: string[];
  onChange: (selected: string[]) => void;
  searchable?: boolean;
  defaultExpanded?: boolean;
}

export function FilterSection({
  title,
  options,
  selected,
  onChange,
  searchable = false,
  defaultExpanded = true,
}: FilterSectionProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [search, setSearch] = useState("");
  const [showAll, setShowAll] = useState(false);

  const filteredOptions = options.filter((opt) =>
    opt.label.toLowerCase().includes(search.toLowerCase())
  );

  const displayOptions = showAll
    ? filteredOptions
    : filteredOptions.slice(0, 10);
  const hasMore = filteredOptions.length > 10;

  const toggleOption = (id: string) => {
    if (selected.includes(id)) {
      onChange(selected.filter((s) => s !== id));
    } else {
      onChange([...selected, id]);
    }
  };

  return (
    <div className="border-b border-border pb-3">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between py-2 text-sm font-medium hover:text-foreground/80"
      >
        <span>{title}</span>
        {expanded ? (
          <ChevronDown className="h-4 w-4" />
        ) : (
          <ChevronRight className="h-4 w-4" />
        )}
      </button>

      {expanded && (
        <div className="mt-2 space-y-2">
          {searchable && (
            <div className="relative">
              <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="text"
                placeholder={`Search ${title.toLowerCase()}...`}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 pl-7 text-xs"
              />
            </div>
          )}

          <ScrollArea className="max-h-48">
            <div className="space-y-1 pr-4">
              {displayOptions.map((option) => (
                <label
                  key={option.id}
                  className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-accent"
                >
                  <Checkbox
                    checked={selected.includes(option.id)}
                    onCheckedChange={() => toggleOption(option.id)}
                  />
                  {option.icon && <span>{option.icon}</span>}
                  <span className="flex-1 truncate">{option.label}</span>
                  {option.count !== undefined && (
                    <span className="text-xs text-muted-foreground">
                      ({option.count})
                    </span>
                  )}
                </label>
              ))}
            </div>
          </ScrollArea>

          {hasMore && !showAll && (
            <button
              onClick={() => setShowAll(true)}
              className="w-full text-center text-xs text-muted-foreground hover:text-foreground"
            >
              Show {filteredOptions.length - 10} more...
            </button>
          )}
        </div>
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add -A
git commit -m "feat: add collapsible filter section with search"
```

---

### Task 4.6: Create Sidebar Component

**Files:**
- Create: `src/components/sidebar.tsx`

**Step 1: Create sidebar**

Create `src/components/sidebar.tsx`:

```typescript
"use client";

import { SearchInput } from "./search-input";
import { FilterSection } from "./filter-section";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Heart, History } from "lucide-react";
import { cn } from "@/lib/utils";

interface FilterOption {
  id: string;
  label: string;
  count?: number;
  icon?: string;
}

interface SidebarProps {
  search: string;
  onSearchChange: (value: string) => void;
  categories: FilterOption[];
  selectedCategories: string[];
  onCategoriesChange: (selected: string[]) => void;
  countries: FilterOption[];
  selectedCountries: string[];
  onCountriesChange: (selected: string[]) => void;
  languages: FilterOption[];
  selectedLanguages: string[];
  onLanguagesChange: (selected: string[]) => void;
  showFavorites: boolean;
  onShowFavoritesChange: (show: boolean) => void;
  showHistory: boolean;
  onShowHistoryChange: (show: boolean) => void;
  className?: string;
}

export function Sidebar({
  search,
  onSearchChange,
  categories,
  selectedCategories,
  onCategoriesChange,
  countries,
  selectedCountries,
  onCountriesChange,
  languages,
  selectedLanguages,
  onLanguagesChange,
  showFavorites,
  onShowFavoritesChange,
  showHistory,
  onShowHistoryChange,
  className,
}: SidebarProps) {
  return (
    <aside className={cn("flex flex-col", className)}>
      <div className="p-4">
        <SearchInput
          value={search}
          onChange={onSearchChange}
          placeholder="Search channels..."
        />
      </div>

      <ScrollArea className="flex-1 px-4">
        <FilterSection
          title="Categories"
          options={categories}
          selected={selectedCategories}
          onChange={onCategoriesChange}
          searchable
        />

        <FilterSection
          title="Countries"
          options={countries}
          selected={selectedCountries}
          onChange={onCountriesChange}
          searchable
        />

        <FilterSection
          title="Languages"
          options={languages}
          selected={selectedLanguages}
          onChange={onLanguagesChange}
          searchable
        />

        <div className="border-b border-border py-3">
          <div className="space-y-1">
            <button
              onClick={() => {
                onShowFavoritesChange(!showFavorites);
                if (!showFavorites) onShowHistoryChange(false);
              }}
              className={cn(
                "flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent",
                showFavorites && "bg-accent"
              )}
            >
              <Heart className="h-4 w-4" />
              Favorites
            </button>

            <button
              onClick={() => {
                onShowHistoryChange(!showHistory);
                if (!showHistory) onShowFavoritesChange(false);
              }}
              className={cn(
                "flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent",
                showHistory && "bg-accent"
              )}
            >
              <History className="h-4 w-4" />
              Watch History
            </button>
          </div>
        </div>
      </ScrollArea>
    </aside>
  );
}
```

**Step 2: Commit**

```bash
git add -A
git commit -m "feat: add sidebar with search and filter sections"
```

---

### Task 4.7: Create Video Player Component

**Files:**
- Create: `src/components/video-player.tsx`

**Step 1: Install Shaka Player**

```bash
npm install shaka-player
```

**Step 2: Create video player component**

Create `src/components/video-player.tsx`:

```typescript
"use client";

import { useEffect, useRef, useState } from "react";
import { X, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Stream {
  url: string;
  httpReferrer?: string;
  userAgent?: string;
}

interface VideoPlayerProps {
  channelName: string;
  stream: Stream | null;
  onClose: () => void;
}

export function VideoPlayer({ channelName, stream, onClose }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const initPlayer = async () => {
    if (!stream || !videoRef.current) return;

    setError(null);
    setLoading(true);

    try {
      const shaka = await import("shaka-player");

      // Install polyfills
      shaka.polyfill.installAll();

      if (!shaka.Player.isBrowserSupported()) {
        setError("Browser not supported for video playback");
        setLoading(false);
        return;
      }

      // Destroy existing player
      if (playerRef.current) {
        await playerRef.current.destroy();
      }

      const player = new shaka.Player();
      await player.attach(videoRef.current);
      playerRef.current = player;

      player.addEventListener("error", (event: any) => {
        console.error("Shaka error:", event.detail);
        setError("Stream unavailable");
        setLoading(false);
      });

      // Configure player
      player.configure({
        streaming: {
          bufferingGoal: 30,
          rebufferingGoal: 2,
          bufferBehind: 30,
        },
      });

      await player.load(stream.url);
      setLoading(false);
      videoRef.current.play();
    } catch (err) {
      console.error("Player error:", err);
      setError("Failed to load stream");
      setLoading(false);
    }
  };

  useEffect(() => {
    initPlayer();

    return () => {
      if (playerRef.current) {
        playerRef.current.destroy();
      }
    };
  }, [stream?.url]);

  return (
    <div className="relative w-full overflow-hidden rounded-lg bg-black">
      {/* Video container with 16:9 aspect ratio */}
      <div className="relative aspect-video">
        <video
          ref={videoRef}
          className="h-full w-full"
          controls
          autoPlay
          playsInline
        />

        {/* Loading overlay */}
        {loading && !error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-white border-t-transparent" />
          </div>
        )}

        {/* Error overlay */}
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 text-white">
            <p className="mb-4 text-lg">{error}</p>
            <Button variant="secondary" onClick={initPlayer}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Retry
            </Button>
          </div>
        )}
      </div>

      {/* Player bar */}
      <div className="flex items-center justify-between bg-card px-4 py-2">
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 text-xs text-red-500">
            <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
            LIVE
          </span>
          <span className="font-medium">{channelName}</span>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
```

**Step 3: Commit**

```bash
git add -A
git commit -m "feat: add Shaka video player with error handling"
```

---

### Task 4.8: Create Filter Chips Component

**Files:**
- Create: `src/components/filter-chips.tsx`

**Step 1: Create filter chips**

Create `src/components/filter-chips.tsx`:

```typescript
"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

interface FilterChip {
  type: "category" | "country" | "language";
  id: string;
  label: string;
  icon?: string;
}

interface FilterChipsProps {
  chips: FilterChip[];
  totalCount: number;
  onRemove: (type: FilterChip["type"], id: string) => void;
  onClearAll: () => void;
}

export function FilterChips({
  chips,
  totalCount,
  onRemove,
  onClearAll,
}: FilterChipsProps) {
  if (chips.length === 0) {
    return (
      <div className="text-sm text-muted-foreground">
        Showing {totalCount.toLocaleString()} channels
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-muted-foreground">
        Showing {totalCount.toLocaleString()} channels:
      </span>

      {chips.map((chip) => (
        <Badge
          key={`${chip.type}-${chip.id}`}
          variant="secondary"
          className="flex items-center gap-1 pr-1"
        >
          {chip.icon && <span>{chip.icon}</span>}
          {chip.label}
          <button
            onClick={() => onRemove(chip.type, chip.id)}
            className="ml-1 rounded-full p-0.5 hover:bg-muted"
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}

      <Button
        variant="ghost"
        size="sm"
        onClick={onClearAll}
        className="h-6 text-xs"
      >
        Clear all
      </Button>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add -A
git commit -m "feat: add filter chips component"
```

---

### Task 4.9: Create Mobile Filters Component

**Files:**
- Create: `src/components/mobile-filters.tsx`

**Step 1: Create mobile filters (bottom sheet)**

Create `src/components/mobile-filters.tsx`:

```typescript
"use client";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Filter } from "lucide-react";
import { SearchInput } from "./search-input";
import { FilterSection } from "./filter-section";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Heart, History } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface FilterOption {
  id: string;
  label: string;
  count?: number;
  icon?: string;
}

interface MobileFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  categories: FilterOption[];
  selectedCategories: string[];
  onCategoriesChange: (selected: string[]) => void;
  countries: FilterOption[];
  selectedCountries: string[];
  onCountriesChange: (selected: string[]) => void;
  languages: FilterOption[];
  selectedLanguages: string[];
  onLanguagesChange: (selected: string[]) => void;
  showFavorites: boolean;
  onShowFavoritesChange: (show: boolean) => void;
  showHistory: boolean;
  onShowHistoryChange: (show: boolean) => void;
  activeFilterCount: number;
}

export function MobileFilters({
  search,
  onSearchChange,
  categories,
  selectedCategories,
  onCategoriesChange,
  countries,
  selectedCountries,
  onCountriesChange,
  languages,
  selectedLanguages,
  onLanguagesChange,
  showFavorites,
  onShowFavoritesChange,
  showHistory,
  onShowHistoryChange,
  activeFilterCount,
}: MobileFiltersProps) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="relative">
          <Filter className="mr-2 h-4 w-4" />
          Filters
          {activeFilterCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
              {activeFilterCount}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="h-[80vh]">
        <SheetHeader>
          <SheetTitle>Filters</SheetTitle>
        </SheetHeader>

        <div className="mt-4">
          <SearchInput
            value={search}
            onChange={onSearchChange}
            placeholder="Search channels..."
          />
        </div>

        <ScrollArea className="mt-4 h-[calc(80vh-12rem)]">
          <FilterSection
            title="Categories"
            options={categories}
            selected={selectedCategories}
            onChange={onCategoriesChange}
            searchable
          />

          <FilterSection
            title="Countries"
            options={countries}
            selected={selectedCountries}
            onChange={onCountriesChange}
            searchable
          />

          <FilterSection
            title="Languages"
            options={languages}
            selected={selectedLanguages}
            onChange={onLanguagesChange}
            searchable
          />

          <div className="border-b border-border py-3">
            <div className="space-y-1">
              <button
                onClick={() => {
                  onShowFavoritesChange(!showFavorites);
                  if (!showFavorites) onShowHistoryChange(false);
                }}
                className={cn(
                  "flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent",
                  showFavorites && "bg-accent"
                )}
              >
                <Heart className="h-4 w-4" />
                Favorites
              </button>

              <button
                onClick={() => {
                  onShowHistoryChange(!showHistory);
                  if (!showHistory) onShowFavoritesChange(false);
                }}
                className={cn(
                  "flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent",
                  showHistory && "bg-accent"
                )}
              >
                <History className="h-4 w-4" />
                Watch History
              </button>
            </div>
          </div>
        </ScrollArea>

        <div className="absolute bottom-0 left-0 right-0 border-t bg-background p-4">
          <Button className="w-full" onClick={() => setOpen(false)}>
            Apply Filters
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
```

**Step 2: Commit**

```bash
git add -A
git commit -m "feat: add mobile filters bottom sheet"
```

---

## Phase 5: Hooks and State Management

### Task 5.1: Create Favorites Hook

**Files:**
- Create: `src/hooks/use-favorites.ts`

**Step 1: Create favorites hook**

Create `src/hooks/use-favorites.ts`:

```typescript
"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "iptv-favorites";

export function useFavorites() {
  const [favorites, setFavorites] = useState<string[]>([]);

  // Load from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setFavorites(JSON.parse(stored));
      } catch {
        setFavorites([]);
      }
    }
  }, []);

  // Save to localStorage when favorites change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites));
  }, [favorites]);

  const addFavorite = useCallback((channelId: string) => {
    setFavorites((prev) => {
      if (prev.includes(channelId)) return prev;
      return [...prev, channelId];
    });
  }, []);

  const removeFavorite = useCallback((channelId: string) => {
    setFavorites((prev) => prev.filter((id) => id !== channelId));
  }, []);

  const toggleFavorite = useCallback((channelId: string) => {
    setFavorites((prev) => {
      if (prev.includes(channelId)) {
        return prev.filter((id) => id !== channelId);
      }
      return [...prev, channelId];
    });
  }, []);

  const isFavorite = useCallback(
    (channelId: string) => favorites.includes(channelId),
    [favorites]
  );

  return {
    favorites,
    addFavorite,
    removeFavorite,
    toggleFavorite,
    isFavorite,
  };
}
```

**Step 2: Commit**

```bash
git add -A
git commit -m "feat: add favorites hook with localStorage persistence"
```

---

### Task 5.2: Create Watch History Hook

**Files:**
- Create: `src/hooks/use-history.ts`

**Step 1: Create history hook**

Create `src/hooks/use-history.ts`:

```typescript
"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "iptv-history";
const MAX_HISTORY = 50;

interface HistoryEntry {
  channelId: string;
  timestamp: number;
}

export function useHistory() {
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  // Load from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setHistory(JSON.parse(stored));
      } catch {
        setHistory([]);
      }
    }
  }, []);

  // Save to localStorage when history changes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  }, [history]);

  const addToHistory = useCallback((channelId: string) => {
    setHistory((prev) => {
      // Remove existing entry for this channel
      const filtered = prev.filter((entry) => entry.channelId !== channelId);

      // Add new entry at the beginning
      const newHistory = [
        { channelId, timestamp: Date.now() },
        ...filtered,
      ].slice(0, MAX_HISTORY);

      return newHistory;
    });
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
  }, []);

  const getHistoryChannelIds = useCallback(() => {
    return history.map((entry) => entry.channelId);
  }, [history]);

  return {
    history,
    addToHistory,
    clearHistory,
    getHistoryChannelIds,
  };
}
```

**Step 2: Commit**

```bash
git add -A
git commit -m "feat: add watch history hook with localStorage persistence"
```

---

### Task 5.3: Create URL Filters Hook

**Files:**
- Create: `src/hooks/use-filters.ts`

**Step 1: Create filters hook**

Create `src/hooks/use-filters.ts`:

```typescript
"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useCallback } from "react";

export interface Filters {
  search: string;
  countries: string[];
  categories: string[];
  languages: string[];
  playing: string | null;
}

export function useFilters() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const filters: Filters = {
    search: searchParams.get("q") || "",
    countries: searchParams.get("countries")?.split(",").filter(Boolean) || [],
    categories:
      searchParams.get("categories")?.split(",").filter(Boolean) || [],
    languages: searchParams.get("languages")?.split(",").filter(Boolean) || [],
    playing: searchParams.get("playing"),
  };

  const updateFilters = useCallback(
    (updates: Partial<Filters>) => {
      const params = new URLSearchParams(searchParams.toString());

      if (updates.search !== undefined) {
        if (updates.search) {
          params.set("q", updates.search);
        } else {
          params.delete("q");
        }
      }

      if (updates.countries !== undefined) {
        if (updates.countries.length) {
          params.set("countries", updates.countries.join(","));
        } else {
          params.delete("countries");
        }
      }

      if (updates.categories !== undefined) {
        if (updates.categories.length) {
          params.set("categories", updates.categories.join(","));
        } else {
          params.delete("categories");
        }
      }

      if (updates.languages !== undefined) {
        if (updates.languages.length) {
          params.set("languages", updates.languages.join(","));
        } else {
          params.delete("languages");
        }
      }

      if (updates.playing !== undefined) {
        if (updates.playing) {
          params.set("playing", updates.playing);
        } else {
          params.delete("playing");
        }
      }

      const newUrl = params.toString()
        ? `${pathname}?${params.toString()}`
        : pathname;

      router.push(newUrl, { scroll: false });
    },
    [searchParams, router, pathname]
  );

  const clearFilters = useCallback(() => {
    const params = new URLSearchParams();
    // Preserve playing state when clearing filters
    const playing = searchParams.get("playing");
    if (playing) {
      params.set("playing", playing);
    }
    const newUrl = params.toString()
      ? `${pathname}?${params.toString()}`
      : pathname;
    router.push(newUrl, { scroll: false });
  }, [searchParams, router, pathname]);

  return {
    filters,
    updateFilters,
    clearFilters,
  };
}
```

**Step 2: Commit**

```bash
git add -A
git commit -m "feat: add URL-based filters hook"
```

---

## Phase 6: Main Page Integration

### Task 6.1: Create Header Component

**Files:**
- Create: `src/components/header.tsx`

**Step 1: Create header**

Create `src/components/header.tsx`:

```typescript
"use client";

import { Github, Tv } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MobileFilters } from "./mobile-filters";

interface FilterOption {
  id: string;
  label: string;
  count?: number;
  icon?: string;
}

interface HeaderProps {
  // Mobile filter props (passed through)
  search: string;
  onSearchChange: (value: string) => void;
  categories: FilterOption[];
  selectedCategories: string[];
  onCategoriesChange: (selected: string[]) => void;
  countries: FilterOption[];
  selectedCountries: string[];
  onCountriesChange: (selected: string[]) => void;
  languages: FilterOption[];
  selectedLanguages: string[];
  onLanguagesChange: (selected: string[]) => void;
  showFavorites: boolean;
  onShowFavoritesChange: (show: boolean) => void;
  showHistory: boolean;
  onShowHistoryChange: (show: boolean) => void;
  activeFilterCount: number;
}

export function Header(props: HeaderProps) {
  return (
    <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <Tv className="h-6 w-6 text-primary" />
          <span className="text-lg font-semibold">IPTV Browser</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Mobile filters - only visible on mobile */}
          <div className="lg:hidden">
            <MobileFilters
              search={props.search}
              onSearchChange={props.onSearchChange}
              categories={props.categories}
              selectedCategories={props.selectedCategories}
              onCategoriesChange={props.onCategoriesChange}
              countries={props.countries}
              selectedCountries={props.selectedCountries}
              onCountriesChange={props.onCountriesChange}
              languages={props.languages}
              selectedLanguages={props.selectedLanguages}
              onLanguagesChange={props.onLanguagesChange}
              showFavorites={props.showFavorites}
              onShowFavoritesChange={props.onShowFavoritesChange}
              showHistory={props.showHistory}
              onShowHistoryChange={props.onShowHistoryChange}
              activeFilterCount={props.activeFilterCount}
            />
          </div>

          <Button variant="ghost" size="icon" asChild>
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Github className="h-5 w-5" />
            </a>
          </Button>
        </div>
      </div>
    </header>
  );
}
```

**Step 2: Commit**

```bash
git add -A
git commit -m "feat: add header with mobile filters integration"
```

---

### Task 6.2: Build Main Page

**Files:**
- Modify: `src/app/page.tsx`

**Step 1: Create the main page**

Replace `src/app/page.tsx` with:

```typescript
"use client";

import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Header } from "@/components/header";
import { Sidebar } from "@/components/sidebar";
import { ChannelGrid } from "@/components/channel-grid";
import { VideoPlayer } from "@/components/video-player";
import { FilterChips } from "@/components/filter-chips";
import { useFilters } from "@/hooks/use-filters";
import { useFavorites } from "@/hooks/use-favorites";
import { useHistory } from "@/hooks/use-history";
import { useMemo, useState, useCallback, Suspense } from "react";

function HomeContent() {
  const { filters, updateFilters, clearFilters } = useFilters();
  const { favorites, toggleFavorite } = useFavorites();
  const { addToHistory, getHistoryChannelIds } = useHistory();

  const [showFavorites, setShowFavorites] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  // Fetch reference data
  const categoriesData = useQuery(api.categories.list) ?? [];
  const countriesData = useQuery(api.countries.list) ?? [];
  const languagesData = useQuery(api.languages.list) ?? [];

  // Fetch channels
  const channelsResult = useQuery(api.channels.list, {
    search: filters.search || undefined,
    countries: filters.countries.length ? filters.countries : undefined,
    categories: filters.categories.length ? filters.categories : undefined,
    languages: filters.languages.length ? filters.languages : undefined,
  });

  // Fetch favorite channels if showing favorites
  const favoriteChannels = useQuery(
    api.channels.getByIds,
    showFavorites && favorites.length > 0
      ? { channelIds: favorites }
      : "skip"
  );

  // Fetch history channels if showing history
  const historyChannelIds = getHistoryChannelIds();
  const historyChannels = useQuery(
    api.channels.getByIds,
    showHistory && historyChannelIds.length > 0
      ? { channelIds: historyChannelIds }
      : "skip"
  );

  // Fetch current playing channel and stream
  const playingChannel = useQuery(
    api.channels.getById,
    filters.playing ? { channelId: filters.playing } : "skip"
  );
  const playingStream = useQuery(
    api.streams.getByChannelId,
    filters.playing ? { channelId: filters.playing } : "skip"
  );

  // Transform data for components
  const categoryOptions = useMemo(
    () =>
      categoriesData.map((c) => ({
        id: c.categoryId,
        label: c.name,
      })),
    [categoriesData]
  );

  const countryOptions = useMemo(
    () =>
      countriesData.map((c) => ({
        id: c.code,
        label: c.name,
        icon: c.flag,
      })),
    [countriesData]
  );

  const languageOptions = useMemo(
    () =>
      languagesData.map((l) => ({
        id: l.code,
        label: l.name,
      })),
    [languagesData]
  );

  const countryFlags = useMemo(
    () =>
      countriesData.reduce(
        (acc, c) => {
          acc[c.code] = c.flag;
          return acc;
        },
        {} as Record<string, string>
      ),
    [countriesData]
  );

  // Determine which channels to display
  const displayChannels = useMemo(() => {
    if (showFavorites && favoriteChannels) {
      return favoriteChannels;
    }
    if (showHistory && historyChannels) {
      return historyChannels;
    }
    return channelsResult?.channels ?? [];
  }, [showFavorites, favoriteChannels, showHistory, historyChannels, channelsResult]);

  const totalCount = useMemo(() => {
    if (showFavorites) return favorites.length;
    if (showHistory) return historyChannelIds.length;
    return channelsResult?.totalCount ?? 0;
  }, [showFavorites, favorites.length, showHistory, historyChannelIds.length, channelsResult]);

  // Build filter chips
  const filterChips = useMemo(() => {
    const chips: Array<{
      type: "category" | "country" | "language";
      id: string;
      label: string;
      icon?: string;
    }> = [];

    filters.categories.forEach((id) => {
      const cat = categoriesData.find((c) => c.categoryId === id);
      if (cat) chips.push({ type: "category", id, label: cat.name });
    });

    filters.countries.forEach((id) => {
      const country = countriesData.find((c) => c.code === id);
      if (country)
        chips.push({ type: "country", id, label: country.name, icon: country.flag });
    });

    filters.languages.forEach((id) => {
      const lang = languagesData.find((l) => l.code === id);
      if (lang) chips.push({ type: "language", id, label: lang.name });
    });

    return chips;
  }, [filters, categoriesData, countriesData, languagesData]);

  const activeFilterCount =
    filters.categories.length +
    filters.countries.length +
    filters.languages.length +
    (filters.search ? 1 : 0);

  // Handlers
  const handlePlay = useCallback(
    (channelId: string) => {
      updateFilters({ playing: channelId });
      addToHistory(channelId);
    },
    [updateFilters, addToHistory]
  );

  const handleClosePlayer = useCallback(() => {
    updateFilters({ playing: null });
  }, [updateFilters]);

  const handleRemoveChip = useCallback(
    (type: "category" | "country" | "language", id: string) => {
      if (type === "category") {
        updateFilters({
          categories: filters.categories.filter((c) => c !== id),
        });
      } else if (type === "country") {
        updateFilters({
          countries: filters.countries.filter((c) => c !== id),
        });
      } else {
        updateFilters({
          languages: filters.languages.filter((l) => l !== id),
        });
      }
    },
    [filters, updateFilters]
  );

  const handleShowFavorites = (show: boolean) => {
    setShowFavorites(show);
    if (show) setShowHistory(false);
  };

  const handleShowHistory = (show: boolean) => {
    setShowHistory(show);
    if (show) setShowFavorites(false);
  };

  const isLoading = channelsResult === undefined;

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
        languages={languageOptions}
        selectedLanguages={filters.languages}
        onLanguagesChange={(languages) => updateFilters({ languages })}
        showFavorites={showFavorites}
        onShowFavoritesChange={handleShowFavorites}
        showHistory={showHistory}
        onShowHistoryChange={handleShowHistory}
        activeFilterCount={activeFilterCount}
      />

      <div className="flex">
        {/* Desktop Sidebar */}
        <Sidebar
          className="hidden lg:flex w-72 shrink-0 border-r h-[calc(100vh-3.5rem)] sticky top-14"
          search={filters.search}
          onSearchChange={(search) => updateFilters({ search })}
          categories={categoryOptions}
          selectedCategories={filters.categories}
          onCategoriesChange={(categories) => updateFilters({ categories })}
          countries={countryOptions}
          selectedCountries={filters.countries}
          onCountriesChange={(countries) => updateFilters({ countries })}
          languages={languageOptions}
          selectedLanguages={filters.languages}
          onLanguagesChange={(languages) => updateFilters({ languages })}
          showFavorites={showFavorites}
          onShowFavoritesChange={handleShowFavorites}
          showHistory={showHistory}
          onShowHistoryChange={handleShowHistory}
        />

        {/* Main Content */}
        <main className="flex-1 p-4 lg:p-6">
          {/* Video Player */}
          {filters.playing && playingChannel && (
            <div className="mb-6">
              <VideoPlayer
                channelName={playingChannel.name}
                stream={playingStream?.[0] ?? null}
                onClose={handleClosePlayer}
              />
            </div>
          )}

          {/* Filter Chips */}
          <div className="mb-4">
            <FilterChips
              chips={filterChips}
              totalCount={totalCount}
              onRemove={handleRemoveChip}
              onClearAll={clearFilters}
            />
          </div>

          {/* Channel Grid */}
          <ChannelGrid
            channels={displayChannels}
            countryFlags={countryFlags}
            playingChannelId={filters.playing ?? undefined}
            favorites={favorites}
            onPlay={handlePlay}
            onToggleFavorite={toggleFavorite}
            isLoading={isLoading}
            hasMore={false}
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

**Step 2: Verify the app runs**

```bash
npm run dev
```

Expected: App loads, shows channels if synced, filters work.

**Step 3: Commit**

```bash
git add -A
git commit -m "feat: integrate all components in main page"
```

---

## Phase 7: Polish and Testing

### Task 7.1: Add Loading and Empty States

**Files:**
- Modify: `src/app/page.tsx`

**Step 1: Improve loading/empty states**

The current implementation already has loading states via the ChannelGrid skeleton. Add empty state handling:

In `src/components/channel-grid.tsx`, after the loading check, add:

```typescript
if (!isLoading && channels.length === 0) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <p className="text-lg text-muted-foreground">No channels found</p>
      <p className="text-sm text-muted-foreground mt-1">
        Try adjusting your filters or search query
      </p>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add -A
git commit -m "feat: add empty state to channel grid"
```

---

### Task 7.2: Test Core Functionality

**Step 1: Start dev server**

```bash
npm run dev
```

**Step 2: Manual test checklist**

- [ ] Channels load and display in grid
- [ ] Search filters channels by name
- [ ] Category filter works
- [ ] Country filter works (with flags)
- [ ] Language filter works
- [ ] Multiple filters combine correctly
- [ ] Filter chips appear and can be removed
- [ ] "Clear all" resets filters
- [ ] Clicking a channel opens player
- [ ] Player shows error and retry for bad streams
- [ ] Close button stops player
- [ ] Favorite toggle works (heart fills)
- [ ] Favorites view shows only favorited channels
- [ ] History tracks watched channels
- [ ] URL updates with filters (shareable)
- [ ] Mobile: filter button opens bottom sheet
- [ ] Mobile: 2-column grid layout

**Step 3: Fix any issues found, commit fixes individually**

---

### Task 7.3: Build and Deploy Check

**Step 1: Run production build**

```bash
npm run build
```

**Step 2: Fix any build errors**

**Step 3: Commit any fixes**

```bash
git add -A
git commit -m "fix: resolve production build issues"
```

---

## Phase 8: Final Touches

### Task 8.1: Add Footer

**Files:**
- Create: `src/components/footer.tsx`
- Modify: `src/app/page.tsx`

**Step 1: Create footer**

Create `src/components/footer.tsx`:

```typescript
export function Footer() {
  return (
    <footer className="border-t py-4 text-center text-sm text-muted-foreground">
      <p>
        Data provided by{" "}
        <a
          href="https://github.com/iptv-org/iptv"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-foreground"
        >
          iptv-org
        </a>
      </p>
    </footer>
  );
}
```

**Step 2: Add footer to page layout (after main content)**

**Step 3: Commit**

```bash
git add -A
git commit -m "feat: add footer with data attribution"
```

---

### Task 8.2: Final Commit and Summary

**Step 1: Ensure all changes committed**

```bash
git status
```

**Step 2: Create summary commit if needed**

```bash
git add -A
git commit -m "chore: finalize MVP implementation"
```

---

## Summary

### Completed Features

1. **Project Setup:** Next.js 15 + Convex + shadcn/ui + Tailwind
2. **Database:** Convex schema with channels, streams, categories, countries, languages
3. **Data Sync:** Daily cron job from iptv-org API, NSFW filtering
4. **UI Components:** Channel cards, grid, sidebar, filters, video player
5. **State Management:** URL params for filters, localStorage for favorites/history
6. **Responsive:** Desktop sidebar, mobile bottom sheet
7. **Video Playback:** Shaka Player with error handling and retry

### File Count

- **Convex functions:** 7 files (schema, queries, sync, crons)
- **React components:** 11 files
- **Hooks:** 3 files
- **Pages:** 1 file (main page)

### Next Steps (Post-MVP)

1. Add pagination/infinite scroll from Convex
2. Stream health indicators
3. EPG/TV guide integration
4. PWA support
5. User accounts for cross-device sync
