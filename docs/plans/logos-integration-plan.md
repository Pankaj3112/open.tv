# Logos Integration Plan

## Current State
- Schema has `logo: v.optional(v.string())` field on channels
- Sync currently sets `logo: undefined` (line 86 in sync.ts)
- Channel cards show placeholder when no logo

## Data Source
**URL**: `https://raw.githubusercontent.com/iptv-org/database/master/data/logos.csv`

**CSV Structure**:
| Column | Description | Example |
|--------|-------------|---------|
| channel | Channel ID (matches channels.json) | `BBCOne.uk` |
| feed | Feed variant (often empty) | `London` |
| tags | Style tags | `picons`, `color`, `transparent` |
| width | Image width in pixels | `512` |
| height | Image height in pixels | `512` |
| format | Image format | `PNG`, `SVG`, `JPEG` |
| url | Direct image URL | `https://i.imgur.com/xxx.png` |

**Key Insight**: The `channel` column matches our `channelId` exactly (e.g., `BBCOne.uk`)

## Logo Selection Strategy

Multiple logos may exist per channel (different feeds, sizes, styles). Selection priority:

1. **Prefer no feed** (empty feed = main/default logo)
2. **Prefer larger size** (width × height)
3. **Prefer PNG** over JPEG over SVG (for consistency)
4. **Prefer "color"** tag over "picons" (color is more visually appealing)

## Implementation Plan

### Phase 1: Update Sync to Fetch Logos

**File**: `convex/sync.ts`

1. Add logos fetch to the parallel API calls:
```typescript
const logosRes = await fetch(
  "https://raw.githubusercontent.com/iptv-org/database/master/data/logos.csv"
);
const logosText = await logosRes.text();
```

2. Parse CSV (simple parser, no library needed):
```typescript
function parseLogosCSV(csv: string): Map<string, string> {
  const lines = csv.split('\n');
  const headers = lines[0].split(',');

  // Map: channelId -> best logo URL
  const logoMap = new Map<string, { url: string; score: number }>();

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length < 7) continue;

    const [channel, feed, tags, width, height, format, url] = values;
    if (!channel || !url) continue;

    // Calculate score for logo selection
    const score = calculateLogoScore(feed, tags, width, height, format);

    const existing = logoMap.get(channel);
    if (!existing || score > existing.score) {
      logoMap.set(channel, { url, score });
    }
  }

  return new Map([...logoMap].map(([k, v]) => [k, v.url]));
}

function calculateLogoScore(feed, tags, width, height, format): number {
  let score = 0;

  // Prefer no feed (main logo)
  if (!feed) score += 1000;

  // Prefer larger images
  const size = (parseInt(width) || 0) * (parseInt(height) || 0);
  score += Math.min(size / 1000, 500); // Cap at 500 points

  // Prefer color over picons
  if (tags?.includes('color')) score += 100;
  if (tags?.includes('picons')) score -= 50;

  // Prefer PNG
  if (format === 'PNG') score += 50;
  else if (format === 'JPEG') score += 30;
  else if (format === 'SVG') score += 20;

  return score;
}
```

3. Update channel batch sync to include logos:
```typescript
channels: batch.map((c: any) => ({
  channelId: c.id,
  name: c.name,
  logo: logoMap.get(c.id) || undefined,
  country: c.country,
  categories: c.categories || [],
  languages: [],
  network: c.network || undefined,
})),
```

### Phase 2: Update Channel Card UI

**File**: `src/components/channel-card.tsx`

Current placeholder → Show actual logo with fallback:

```tsx
{channel.logo ? (
  <img
    src={channel.logo}
    alt={channel.name}
    className="h-12 w-12 object-contain"
    onError={(e) => {
      // Fallback to placeholder on error
      e.currentTarget.style.display = 'none';
      e.currentTarget.nextElementSibling?.classList.remove('hidden');
    }}
  />
  <div className="hidden h-12 w-12 rounded bg-muted flex items-center justify-center">
    <Tv className="h-6 w-6 text-muted-foreground" />
  </div>
) : (
  <div className="h-12 w-12 rounded bg-muted flex items-center justify-center">
    <Tv className="h-6 w-6 text-muted-foreground" />
  </div>
)}
```

### Phase 3: Image Optimization (Optional)

Consider using Next.js Image component with remote patterns:

**File**: `next.config.js`
```js
images: {
  remotePatterns: [
    { protocol: 'https', hostname: 'i.imgur.com' },
    { protocol: 'https', hostname: 'i.postimg.cc' },
    { protocol: 'https', hostname: 'i.ibb.co' },
    // Add other common hosts from logos.csv
  ],
},
```

## CSV Parsing Considerations

The CSV has potential edge cases:
- URLs may contain commas (need proper CSV parsing)
- Some fields may be quoted
- Empty values between commas

Simple parser for quoted CSV:
```typescript
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());

  return result;
}
```

## Execution Order

1. **Update sync.ts** - Add logo fetching and parsing
2. **Run sync** - `npx convex run sync:syncAll` to populate logos
3. **Update channel-card.tsx** - Display logos with fallback
4. **Test** - Verify logos display correctly
5. **(Optional)** Configure Next.js Image optimization

## Estimated Impact

- **~70% coverage**: Not all channels have logos in the database
- **Sync time**: +2-3 seconds (CSV is ~1MB)
- **Visual improvement**: Significant - logos make channels recognizable

## Rollback Plan

If logos cause issues:
1. Set `logo: undefined` in sync again
2. Re-run sync
3. Channel cards already have placeholder fallback

## Testing Checklist

- [ ] CSV parses correctly (including edge cases)
- [ ] Best logo selected when multiple exist
- [ ] Logos display in channel cards
- [ ] Fallback shows for channels without logos
- [ ] Broken image URLs handled gracefully
- [ ] Sync completes without errors
- [ ] No performance regression in channel grid
