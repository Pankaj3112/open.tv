# Stabilize Hook Responses to Prevent Channel Reload on Filter Change

## Problem

When a channel is playing and the user changes a filter (category or country), the video player reloads the channel even though the playing channel hasn't changed.

**Root cause:** The VideoPlayer component has a `useEffect` that resets playback whenever the `streams` prop changes (video-player.tsx:43-47). When filters change, the URL updates and triggers re-renders. Even though the `useStreams` and `useChannel` hooks don't re-fetch (since channelId hasn't changed), React's reference comparison can cause the returned arrays/objects to appear "changed" to downstream components.

## Solution

Stabilize the `useChannel` and `useStreams` hooks by caching fetched data in refs and only returning new references when the channelId actually changes.

## Implementation

### use-streams.ts

```typescript
import { useState, useEffect, useRef } from 'react';

interface Stream {
  channel_id: string;
  url: string;
  quality: string | null;
  http_referrer: string | null;
  user_agent: string | null;
}

interface CachedStreams {
  channelId: string | null;
  streams: Stream[];
}

export function useStreams(channelId: string | null) {
  const [isLoading, setIsLoading] = useState(false);
  const cachedRef = useRef<CachedStreams>({ channelId: null, streams: [] });

  useEffect(() => {
    // Skip fetch if channelId hasn't changed and we have cached data
    if (!channelId) {
      return;
    }

    if (cachedRef.current.channelId === channelId) {
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    fetch(`/api/streams/${channelId}`)
      .then((res) => res.json())
      .then((result) => {
        if (!cancelled) {
          cachedRef.current = { channelId, streams: result };
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          cachedRef.current = { channelId, streams: [] };
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [channelId]);

  // Return stable reference from cache
  const streams = channelId && cachedRef.current.channelId === channelId
    ? cachedRef.current.streams
    : [];

  return { streams, isLoading };
}
```

### use-channel.ts

```typescript
import { useState, useEffect, useRef } from 'react';

interface Channel {
  channel_id: string;
  name: string;
  logo: string | null;
  country: string;
  category: string;
  network: string | null;
}

interface CachedChannel {
  channelId: string | null;
  channel: Channel | null;
}

export function useChannel(channelId: string | null) {
  const [isLoading, setIsLoading] = useState(false);
  const cachedRef = useRef<CachedChannel>({ channelId: null, channel: null });

  useEffect(() => {
    if (!channelId) {
      return;
    }

    if (cachedRef.current.channelId === channelId) {
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    fetch(`/api/channels/${channelId}`)
      .then((res) => res.json())
      .then((result) => {
        if (!cancelled) {
          cachedRef.current = {
            channelId,
            channel: result.error ? null : result,
          };
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          cachedRef.current = { channelId, channel: null };
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [channelId]);

  // Return stable reference from cache
  const channel = channelId && cachedRef.current.channelId === channelId
    ? cachedRef.current.channel
    : null;

  return { channel, isLoading };
}
```

## Key Changes

1. **Remove useMemo** - No longer needed since we're using refs for stability
2. **Add cache ref** - Stores both the channelId and fetched data together
3. **Skip redundant fetches** - Check if channelId matches cached value before fetching
4. **Stable returns** - Return cached data directly, ensuring same reference across re-renders

## Files to Modify

- `src/hooks/use-streams.ts`
- `src/hooks/use-channel.ts`

## Testing

1. Play a channel
2. Change the country filter - channel should continue playing without reload
3. Change the category filter - channel should continue playing without reload
4. Select a different channel - should load the new channel correctly
5. Close the player and reopen the same channel - should fetch fresh data
