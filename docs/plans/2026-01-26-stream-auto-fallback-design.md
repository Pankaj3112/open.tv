# Stream Auto-Fallback Design

## Overview

When a stream fails to load or errors during playback, automatically try the next available stream for that channel. If all streams fail, show an error with retry option.

## Behavior

- Try streams in order (first → last) when one fails
- Switch silently - no user-visible interruption
- On all streams failing: show "No working streams available. Try again later." with retry button
- Retry restarts from first stream
- Always start fresh on each channel play (no persistence of working stream)

## Implementation

### VideoPlayer Component (`src/components/video-player.tsx`)

**Props change:**

```tsx
// Before
interface VideoPlayerProps {
  stream: Stream;
  channel: Channel;
  onClose: () => void;
}

// After
interface VideoPlayerProps {
  streams: Stream[];
  channel: Channel;
  onClose: () => void;
}
```

**New state:**

```tsx
const [currentStreamIndex, setCurrentStreamIndex] = useState(0);
const currentStream = streams[currentStreamIndex];
```

**Error handling:**

When Shaka Player fires an error or `player.load()` throws:

1. Check if more streams exist: `currentStreamIndex < streams.length - 1`
2. If yes: increment `currentStreamIndex` (triggers re-render, loads next stream)
3. If no: set error state, show error UI

**Reset on channel change:**

```tsx
useEffect(() => {
  setCurrentStreamIndex(0);
  setError(null);
}, [streams]);
```

**Retry handler:**

```tsx
const handleRetry = () => {
  setCurrentStreamIndex(0);
  setError(null);
};
```

**Edge case - empty streams array:**

Show error immediately: "No streams available for this channel."

### Parent Component (`src/app/page.tsx`)

```tsx
// Before
<VideoPlayer
  stream={playingStreams[0]}
  channel={playingChannel}
  onClose={handleClose}
/>

// After
<VideoPlayer
  streams={playingStreams}
  channel={playingChannel}
  onClose={handleClose}
/>
```

## Files Changed

| File | Changes |
|------|---------|
| `src/components/video-player.tsx` | Add stream index state, fallback logic, retry handler |
| `src/app/page.tsx` | Pass full streams array instead of first stream |

## No Changes Required

- API routes (already return all streams)
- Database schema
- Hooks (useStreams already fetches full array)
- Other components
