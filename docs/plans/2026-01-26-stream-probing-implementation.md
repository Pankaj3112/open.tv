# Stream Probing Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Filter out channels with non-working streams by probing them in the background using Shaka Player.

**Architecture:** Probe service uses Shaka Player to test stream URLs. Probe cache stores results in localStorage with TTL. Channel probing hook orchestrates probing for visible channels and filters the channel list.

**Tech Stack:** Shaka Player (already installed), React hooks, localStorage, Intersection Observer

---

## Task 1: Create Probe Cache Module

**Files:**
- Create: `src/lib/probe-cache.ts`

**Step 1: Create the probe cache module**

```typescript
const CACHE_KEY = 'stream-probe-cache';
const WORKING_TTL = 24 * 60 * 60 * 1000; // 24 hours
const FAILED_TTL = 6 * 60 * 60 * 1000;   // 6 hours
const MAX_ENTRIES = 1000;
const SYNC_HOUR_UTC = 3;

export interface ProbeCacheEntry {
  status: 'working' | 'failed';
  workingStreamUrls: string[];
  timestamp: number;
}

type ProbeCache = Record<string, ProbeCacheEntry>;

function getLastSyncTime(): number {
  const now = new Date();
  const lastSync = new Date(now);
  lastSync.setUTCHours(SYNC_HOUR_UTC, 0, 0, 0);
  if (now < lastSync) {
    lastSync.setUTCDate(lastSync.getUTCDate() - 1);
  }
  return lastSync.getTime();
}

function loadCache(): ProbeCache {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveCache(cache: ProbeCache): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // localStorage full - ignore
  }
}

export function getProbeCache(channelId: string): ProbeCacheEntry | null {
  const cache = loadCache();
  const entry = cache[channelId];
  if (!entry) return null;

  const now = Date.now();
  const lastSync = getLastSyncTime();
  const ttl = entry.status === 'working' ? WORKING_TTL : FAILED_TTL;

  // Stale if older than TTL or older than last sync
  if (entry.timestamp < lastSync || now - entry.timestamp > ttl) {
    return null;
  }

  return entry;
}

export function setProbeCache(channelId: string, entry: ProbeCacheEntry): void {
  const cache = loadCache();
  cache[channelId] = entry;

  // LRU eviction if over limit
  const entries = Object.entries(cache);
  if (entries.length > MAX_ENTRIES) {
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
    const toRemove = entries.slice(0, entries.length - MAX_ENTRIES);
    toRemove.forEach(([key]) => delete cache[key]);
  }

  saveCache(cache);
}

export function clearExpiredCache(): void {
  const cache = loadCache();
  const now = Date.now();
  const lastSync = getLastSyncTime();

  Object.entries(cache).forEach(([channelId, entry]) => {
    const ttl = entry.status === 'working' ? WORKING_TTL : FAILED_TTL;
    if (entry.timestamp < lastSync || now - entry.timestamp > ttl) {
      delete cache[channelId];
    }
  });

  saveCache(cache);
}
```

**Step 2: Verify no TypeScript errors**

Run: `cd /Users/pankajbeniwal/Code/open-tv/.worktrees/stream-probing && npx tsc --noEmit`
Expected: No errors related to probe-cache.ts

**Step 3: Commit**

```bash
git add src/lib/probe-cache.ts
git commit -m "feat: add probe cache module for stream probing results"
```

---

## Task 2: Create Stream Probe Service

**Files:**
- Create: `src/lib/stream-probe.ts`

**Step 1: Create the stream probe service**

```typescript
export interface ProbeStream {
  url: string;
  quality?: string;
  httpReferrer?: string;
  userAgent?: string;
}

export interface ProbeResult {
  hasWorking: boolean;
  workingStreamUrls: string[];
}

const PROBE_TIMEOUT = 5000; // 5 seconds

export async function probeStream(url: string, timeout = PROBE_TIMEOUT): Promise<boolean> {
  // Must run on client
  if (typeof window === 'undefined') return false;

  return new Promise(async (resolve) => {
    const timeoutId = setTimeout(() => {
      cleanup();
      resolve(false);
    }, timeout);

    let player: { destroy: () => Promise<void> } | null = null;
    const video = document.createElement('video');
    video.muted = true;
    video.preload = 'metadata';

    const cleanup = async () => {
      clearTimeout(timeoutId);
      if (player) {
        try {
          await player.destroy();
        } catch {
          // ignore cleanup errors
        }
      }
      video.src = '';
      video.load();
    };

    try {
      const shakaModule = await import('shaka-player');
      const shaka = shakaModule.default;

      shaka.polyfill.installAll();

      if (!shaka.Player.isBrowserSupported()) {
        cleanup();
        resolve(false);
        return;
      }

      player = new shaka.Player();
      await (player as unknown as { attach: (el: HTMLVideoElement) => Promise<void> }).attach(video);

      // Listen for errors
      (player as unknown as { addEventListener: (event: string, cb: () => void) => void }).addEventListener('error', () => {
        cleanup();
        resolve(false);
      });

      // Try to load - success means stream is working
      await (player as unknown as { load: (url: string) => Promise<void> }).load(url);
      cleanup();
      resolve(true);
    } catch {
      cleanup();
      resolve(false);
    }
  });
}

export async function probeChannelStreams(streams: ProbeStream[]): Promise<ProbeResult> {
  const workingStreamUrls: string[] = [];

  // Probe sequentially, stop on first success for efficiency
  for (const stream of streams) {
    const isWorking = await probeStream(stream.url);
    if (isWorking) {
      workingStreamUrls.push(stream.url);
      // Found one working stream - that's enough to show the channel
      return { hasWorking: true, workingStreamUrls };
    }
  }

  return { hasWorking: false, workingStreamUrls: [] };
}
```

**Step 2: Verify no TypeScript errors**

Run: `cd /Users/pankajbeniwal/Code/open-tv/.worktrees/stream-probing && npx tsc --noEmit`
Expected: No errors related to stream-probe.ts

**Step 3: Commit**

```bash
git add src/lib/stream-probe.ts
git commit -m "feat: add stream probe service using Shaka Player"
```

---

## Task 3: Create Channel Probing Hook

**Files:**
- Create: `src/hooks/use-channel-probing.ts`

**Step 1: Create the channel probing hook**

```typescript
import { useState, useEffect, useRef, useCallback } from 'react';
import { probeChannelStreams, ProbeStream } from '@/lib/stream-probe';
import { getProbeCache, setProbeCache, clearExpiredCache } from '@/lib/probe-cache';

interface Channel {
  channelId: string;
  name: string;
  logo?: string;
  country: string;
  category: string;
}

type ProbeStatus = 'pending' | 'probing' | 'working' | 'failed';

const MAX_CONCURRENT_PROBES = 3;

export function useChannelProbing(
  channels: Channel[],
  fetchStreamsForChannel: (channelId: string) => Promise<ProbeStream[]>
) {
  const [probingStatus, setProbingStatus] = useState<Map<string, ProbeStatus>>(new Map());
  const [visibleChannelIds, setVisibleChannelIds] = useState<Set<string>>(new Set());
  const probeQueueRef = useRef<string[]>([]);
  const activeProbesRef = useRef<number>(0);
  const mountedRef = useRef(true);

  // Clear expired cache on mount
  useEffect(() => {
    clearExpiredCache();
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Initialize status from cache
  useEffect(() => {
    const newStatus = new Map<string, ProbeStatus>();

    channels.forEach((channel) => {
      const cached = getProbeCache(channel.channelId);
      if (cached) {
        newStatus.set(channel.channelId, cached.status);
      } else {
        newStatus.set(channel.channelId, 'pending');
      }
    });

    setProbingStatus(newStatus);
  }, [channels]);

  // Process probe queue
  const processQueue = useCallback(async () => {
    if (!mountedRef.current) return;
    if (activeProbesRef.current >= MAX_CONCURRENT_PROBES) return;
    if (probeQueueRef.current.length === 0) return;

    // Prioritize visible channels
    const visibleInQueue = probeQueueRef.current.filter((id) => visibleChannelIds.has(id));
    const nextChannelId = visibleInQueue[0] || probeQueueRef.current[0];

    if (!nextChannelId) return;

    // Remove from queue
    probeQueueRef.current = probeQueueRef.current.filter((id) => id !== nextChannelId);
    activeProbesRef.current++;

    // Update status to probing
    setProbingStatus((prev) => new Map(prev).set(nextChannelId, 'probing'));

    try {
      // Fetch streams for channel
      const streams = await fetchStreamsForChannel(nextChannelId);

      if (!mountedRef.current) return;

      if (streams.length === 0) {
        // No streams available - mark as failed
        setProbingStatus((prev) => new Map(prev).set(nextChannelId, 'failed'));
        setProbeCache(nextChannelId, {
          status: 'failed',
          workingStreamUrls: [],
          timestamp: Date.now(),
        });
      } else {
        // Probe the streams
        const result = await probeChannelStreams(streams);

        if (!mountedRef.current) return;

        const status = result.hasWorking ? 'working' : 'failed';
        setProbingStatus((prev) => new Map(prev).set(nextChannelId, status));
        setProbeCache(nextChannelId, {
          status,
          workingStreamUrls: result.workingStreamUrls,
          timestamp: Date.now(),
        });
      }
    } catch {
      if (mountedRef.current) {
        // On error, mark as failed
        setProbingStatus((prev) => new Map(prev).set(nextChannelId, 'failed'));
      }
    } finally {
      activeProbesRef.current--;
      // Continue processing queue
      processQueue();
    }
  }, [fetchStreamsForChannel, visibleChannelIds]);

  // Queue pending channels for probing
  useEffect(() => {
    const pendingChannels = channels.filter((ch) => {
      const status = probingStatus.get(ch.channelId);
      return status === 'pending';
    });

    pendingChannels.forEach((ch) => {
      if (!probeQueueRef.current.includes(ch.channelId)) {
        probeQueueRef.current.push(ch.channelId);
      }
    });

    // Start processing
    processQueue();
  }, [channels, probingStatus, processQueue]);

  // Register visibility callback for channels
  const registerVisibility = useCallback((channelId: string, isVisible: boolean) => {
    setVisibleChannelIds((prev) => {
      const next = new Set(prev);
      if (isVisible) {
        next.add(channelId);
      } else {
        next.delete(channelId);
      }
      return next;
    });
  }, []);

  // Filter out failed channels
  const filteredChannels = channels.filter((ch) => {
    const status = probingStatus.get(ch.channelId);
    return status !== 'failed';
  });

  const isProbing = Array.from(probingStatus.values()).some(
    (status) => status === 'pending' || status === 'probing'
  );

  return {
    filteredChannels,
    probingStatus,
    isProbing,
    registerVisibility,
  };
}
```

**Step 2: Verify no TypeScript errors**

Run: `cd /Users/pankajbeniwal/Code/open-tv/.worktrees/stream-probing && npx tsc --noEmit`
Expected: No errors related to use-channel-probing.ts

**Step 3: Commit**

```bash
git add src/hooks/use-channel-probing.ts
git commit -m "feat: add channel probing hook with visibility prioritization"
```

---

## Task 4: Update Channel Card for Probing Status

**Files:**
- Modify: `src/components/channel-card.tsx`

**Step 1: Add probing status prop and opacity styling**

Update the interface and component to accept `probingStatus`:

```typescript
// Add to interface (after line 22)
  probingStatus?: 'pending' | 'probing' | 'working' | 'failed';
```

Update the component props destructuring (after line 31):

```typescript
  probingStatus,
```

Update the outer div className (line 37-40) to include opacity:

```typescript
      className={cn(
        "group relative flex flex-col rounded-lg border bg-card p-3 transition-all hover:shadow-lg hover:-translate-y-0.5 cursor-pointer",
        isPlaying && "ring-2 ring-primary",
        (probingStatus === 'pending' || probingStatus === 'probing') && "opacity-70"
      )}
```

**Step 2: Run lint**

Run: `cd /Users/pankajbeniwal/Code/open-tv/.worktrees/stream-probing && npm run lint`
Expected: No new errors (existing warning about img is expected)

**Step 3: Commit**

```bash
git add src/components/channel-card.tsx
git commit -m "feat: add probing status opacity to channel card"
```

---

## Task 5: Update Channel Grid to Pass Probing Status

**Files:**
- Modify: `src/components/channel-grid.tsx`

**Step 1: Add probingStatus prop to interface**

After line 26, add:

```typescript
  probingStatus?: Map<string, 'pending' | 'probing' | 'working' | 'failed'>;
```

**Step 2: Add to props destructuring**

After line 39, add:

```typescript
  probingStatus,
```

**Step 3: Pass probingStatus to ChannelCard**

Update the ChannelCard (around line 91-99) to include probingStatus:

```typescript
          <ChannelCard
            key={channel.channelId}
            channel={channel}
            countryFlag={countryFlags[channel.country]}
            isPlaying={playingChannelId === channel.channelId}
            isFavorite={favorites.includes(channel.channelId)}
            onPlay={onPlay}
            onToggleFavorite={onToggleFavorite}
            probingStatus={probingStatus?.get(channel.channelId)}
          />
```

**Step 4: Run lint**

Run: `cd /Users/pankajbeniwal/Code/open-tv/.worktrees/stream-probing && npm run lint`
Expected: No new errors

**Step 5: Commit**

```bash
git add src/components/channel-grid.tsx
git commit -m "feat: pass probing status through channel grid to cards"
```

---

## Task 6: Integrate Probing Hook in Main Page

**Files:**
- Modify: `src/app/page.tsx`

**Step 1: Import the probing hook**

After line 15, add:

```typescript
import { useChannelProbing } from "@/hooks/use-channel-probing";
import { ProbeStream } from "@/lib/stream-probe";
```

**Step 2: Create fetchStreamsForChannel function**

After line 56 (after useChannels), add:

```typescript
  // Fetch streams for a channel (used by probing)
  const fetchStreamsForChannel = useCallback(async (channelId: string): Promise<ProbeStream[]> => {
    try {
      const res = await fetch(`/api/streams/${channelId}`);
      const streams = await res.json();
      return streams.map((s: { url: string; quality?: string; http_referrer?: string; user_agent?: string }) => ({
        url: s.url,
        quality: s.quality ?? undefined,
        httpReferrer: s.http_referrer ?? undefined,
        userAgent: s.user_agent ?? undefined,
      }));
    } catch {
      return [];
    }
  }, []);
```

**Step 3: Use the probing hook**

After the fetchStreamsForChannel function, add:

```typescript
  // Probe channels for working streams
  const { filteredChannels: probedChannels, probingStatus } = useChannelProbing(
    channels,
    fetchStreamsForChannel
  );
```

**Step 4: Update displayChannels to use probedChannels**

In the displayChannels useMemo (around line 192), change:

```typescript
    return channels;
```

to:

```typescript
    return probedChannels;
```

And update the dependencies array to include `probedChannels` instead of `channels`:

```typescript
  }, [
    showFavorites,
    favoriteChannels,
    showHistory,
    historyChannels,
    probedChannels,  // Changed from channels
    favoritesSort,
    favorites,
    history,
    historyTimeFilter,
  ]);
```

**Step 5: Pass probingStatus to ChannelGrid**

Update the ChannelGrid component (around line 377-388) to include probingStatus:

```typescript
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
            probingStatus={probingStatus}
          />
```

**Step 6: Run lint**

Run: `cd /Users/pankajbeniwal/Code/open-tv/.worktrees/stream-probing && npm run lint`
Expected: No new errors

**Step 7: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: integrate channel probing in main page"
```

---

## Task 7: Manual Testing

**Step 1: Start dev server**

Run: `cd /Users/pankajbeniwal/Code/open-tv/.worktrees/stream-probing && npm run dev`

**Step 2: Test in browser**

Open http://localhost:3000 and verify:
1. Channels appear immediately with slight opacity (probing indicator)
2. Channels with working streams become fully opaque
3. Channels with all failed streams disappear from the list
4. Scrolling loads more channels and they get probed
5. Clicking a channel while probing still works (plays normally)

**Step 3: Test cache**

1. Note which channels are visible and working
2. Refresh the page
3. Verify cached channels appear immediately without opacity (already probed)

**Step 4: Stop dev server**

Press Ctrl+C to stop the server

---

## Task 8: Final Lint and Build Check

**Step 1: Run lint**

Run: `cd /Users/pankajbeniwal/Code/open-tv/.worktrees/stream-probing && npm run lint`
Expected: Only pre-existing warning about img element

**Step 2: Run build**

Run: `cd /Users/pankajbeniwal/Code/open-tv/.worktrees/stream-probing && npm run build`
Expected: Build succeeds

**Step 3: Final commit if any fixes needed**

If any fixes were needed, commit them with appropriate message.

---

## Summary

Files created:
- `src/lib/probe-cache.ts` - localStorage cache for probe results
- `src/lib/stream-probe.ts` - Shaka Player probe service
- `src/hooks/use-channel-probing.ts` - Probing orchestration hook

Files modified:
- `src/components/channel-card.tsx` - Added probing status opacity
- `src/components/channel-grid.tsx` - Pass probing status to cards
- `src/app/page.tsx` - Integrated probing hook
