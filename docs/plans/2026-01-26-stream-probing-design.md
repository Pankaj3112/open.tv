# Stream Probing Design

Filter out non-working streams by probing them in the background, so users only see channels that actually work.

## Problem

Users click channels, wait for loading, then see "No working streams available" with a retry button. This is a poor experience - users should never see broken channels.

## Solution

Probe streams in the background using Shaka Player. Hide channels where all streams fail. Users only see working channels.

## Flow

```
Page loads
    ↓
Fetch channels from API (existing behavior)
    ↓
Show channels immediately (with subtle loading indicator)
    ↓
Background: Fetch streams for visible channels
    ↓
Background: Probe each stream using Shaka Player
    ↓
Update UI: Hide channels where all streams failed
    ↓
User clicks channel → plays immediately (already verified)
```

## Components

### 1. Probe Service (`src/lib/stream-probe.ts`)

Core probing logic using Shaka Player.

```typescript
probeStream(url: string, timeout?: number): Promise<boolean>
```

- Creates hidden `<video>` element (not attached to DOM)
- Initializes Shaka Player
- Attempts `player.load(url)` with 5s timeout
- Returns `true` on success, `false` on error/timeout
- Cleans up player instance after each probe

```typescript
probeChannelStreams(streams: Stream[]): Promise<{
  hasWorking: boolean;
  workingStreams: Stream[];
}>
```

- Probes streams sequentially (stops on first success)
- Returns which streams are working

Constraints:
- Max 3 concurrent channel probes
- 5 second timeout per stream

### 2. Probe Cache (`src/lib/probe-cache.ts`)

localStorage cache for probe results.

Key: `stream-probe-cache`

```typescript
{
  [channelId: string]: {
    status: 'working' | 'failed';
    workingStreamUrls: string[];
    timestamp: number;
  }
}
```

Expiry:
- Working channels: 24 hours
- Failed channels: 6 hours
- Entries older than last sync (3:00 UTC) are stale

Size: Max 1000 channels (~100KB)

### 3. Channel Probing Hook (`src/hooks/use-channel-probing.ts`)

Orchestrates probing and filtering.

```typescript
useChannelProbing(channels: Channel[]) → {
  filteredChannels: Channel[];
  probingStatus: Map<string, 'pending' | 'probing' | 'working' | 'failed'>;
  isProbing: boolean;
}
```

- Uses Intersection Observer for visibility-based prioritization
- Visible channels probed first
- Failed channels removed from UI as results come in

### 4. Integration in `page.tsx`

```typescript
const { channels } = useChannels(filters);
const { filteredChannels, probingStatus } = useChannelProbing(channels);
// Render filteredChannels instead of channels
```

## UX

- Channels appear immediately (no blocking)
- Subtle opacity reduction (0.7) while probing
- Channel fades out when probe fails
- Clicking a probing channel works normally (background enhancement, not a gate)
- Empty state: "No working channels found. Try a different category or country."

## Edge Cases

| Case | Handling |
|------|----------|
| Slow connection | 5s timeout; if it times out, stream won't play well anyway |
| Probe fails but player works | Rare; channel hidden but accessible via favorites/history |
| Probe works but playback fails | Existing video player fallback handles this |
| Tab in background | Pause probing, resume when visible |
| localStorage full | Catch error, continue without caching |

## Files to Create/Modify

New files:
- `src/lib/stream-probe.ts` - Probe service
- `src/lib/probe-cache.ts` - Cache utilities
- `src/hooks/use-channel-probing.ts` - Probing orchestration hook

Modified files:
- `src/app/page.tsx` - Integrate probing hook
- `src/components/channel-card.tsx` - Add probing status indicator (opacity)

## Future Optimization

If full Shaka probing is too slow, switch to hybrid approach:
- Fetch .m3u8 playlist directly for HLS streams (lighter)
- Use Shaka only for non-HLS streams
