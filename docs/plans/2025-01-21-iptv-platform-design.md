# IPTV Frontend Platform - Design Document

**Date:** 2025-01-21
**Project Type:** Portfolio + Real User Potential
**Goal:** Modern, searchable IPTV channel browser with video playback
**Data Source:** [iptv-org/api](https://github.com/iptv-org/api) (JSON endpoints)

---

## Tech Stack

- **Frontend:** Next.js 15 (App Router)
- **Backend/DB:** Convex
- **Styling:** Tailwind CSS + shadcn/ui (dark mode only)
- **Video Player:** Shaka Player
- **Hosting:** Vercel + Convex free tiers

---

## Architecture Overview

### Data Flow

```
iptv-org API (GitHub Pages)
        ↓
   Daily Convex cron job
        ↓
   Convex Database
   ├── channels (filtered, no NSFW)
   ├── categories
   ├── countries
   ├── languages
   └── streams (URLs + headers)
        ↓
   Next.js App (Convex React hooks)
        ↓
   User's Browser
   └── localStorage (favorites, history)
```

### API Endpoints (Source)

- `https://iptv-org.github.io/api/channels.json`
- `https://iptv-org.github.io/api/streams.json`
- `https://iptv-org.github.io/api/categories.json`
- `https://iptv-org.github.io/api/countries.json`
- `https://iptv-org.github.io/api/languages.json`

---

## Convex Schema

```typescript
// convex/schema.ts
export default defineSchema({
  channels: defineTable({
    channelId: v.string(),      // iptv-org ID (e.g., "BBCNews.uk")
    name: v.string(),
    logo: v.optional(v.string()),
    country: v.string(),         // country code
    categories: v.array(v.string()),
    languages: v.array(v.string()),
    network: v.optional(v.string()),
  })
    .index("by_channelId", ["channelId"])
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
  }),

  countries: defineTable({
    code: v.string(),
    name: v.string(),
    flag: v.string(),
    languages: v.array(v.string()),
  }).index("by_code", ["code"]),

  languages: defineTable({
    code: v.string(),
    name: v.string(),
  }),
})
```

### Sync Strategy

- Convex scheduled function runs daily at 3:00 UTC
- Fetches all JSON endpoints from iptv-org API
- Filters out `is_nsfw: true` channels
- Upserts into Convex tables (insert new, update existing)
- Logs sync status for monitoring

---

## UI Layout

### Desktop (≥1024px)

```
┌─────────────────────────────────────────────────────────────┐
│  Logo/Brand                                    [GitHub]     │
├─────────────────┬───────────────────────────────────────────┤
│                 │  ┌─────────────────────────────────────┐  │
│  [Search...]    │  │         VIDEO PLAYER                │  │
│                 │  │         (when channel selected)     │  │
│  ▼ Categories   │  └─────────────────────────────────────┘  │
│  ☑ News         │                                           │
│  ☑ Sports       │  [Selected filters as removable chips]    │
│  ☐ Movies       │                                           │
│                 │  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐        │
│  ▼ Countries    │  │ CH1 │ │ CH2 │ │ CH3 │ │ CH4 │        │
│  [Search...]    │  └─────┘ └─────┘ └─────┘ └─────┘        │
│  ☐ 🇺🇸 USA      │  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐        │
│  ☐ 🇬🇧 UK       │  │ CH5 │ │ CH6 │ │ CH7 │ │ CH8 │        │
│                 │  └─────┘ └─────┘ └─────┘ └─────┘        │
│  ▼ Languages    │                                           │
│  [Search...]    │         [Infinite scroll]                 │
│                 │                                           │
│  ───────────    │                                           │
│  ♡ Favorites    │                                           │
│  ⏱ History      │                                           │
└─────────────────┴───────────────────────────────────────────┘
```

### Mobile (<1024px)

- Sticky header with logo and filter button
- Player at top when active
- 2-column channel grid
- Bottom sheet for filters (triggered by filter button)

---

## Components

### Channel Card

```
┌─────────────────────┐
│  ┌───────────────┐  │
│  │     LOGO      │  │  ← Channel logo (fallback: country flag)
│  └───────────────┘  │
│  BBC News      🇬🇧   │  ← Name + country flag
│  [News]             │  ← Primary category badge
│                 ♡   │  ← Favorite toggle
└─────────────────────┘
```

- Click → starts playback, shows "now playing" indicator
- Favorite icon toggles on click (localStorage)
- Hover: subtle lift/shadow effect

### Video Player Section

```
┌────────────────────────────────────────────────────┐
│               SHAKA PLAYER                         │
│          (16:9 aspect ratio container)             │
├────────────────────────────────────────────────────┤
│ 🔴 LIVE   BBC News                    [✕ Close]   │
└────────────────────────────────────────────────────┘
```

- Appears at top of main content when channel selected
- Close button stops playback and hides player
- Error state: "Stream unavailable. [Retry]"

### Filter Section

```
▼ Categories
  [Search categories...]
  ☑ News (2,341)
  ☑ Sports (1,892)
  ☐ Movies (956)
  ... Show more
```

- Collapsible sections (default: expanded)
- Search within each section
- Channel counts per option

### Active Filter Chips

```
Showing 234 channels:  [News ✕] [Sports ✕] [🇬🇧 UK ✕]  [Clear all]
```

---

## State Management

### URL Parameters (Shareable)

```
/?q=bbc                              → Search results
/?countries=US,GB                    → Filtered by countries
/?categories=news&languages=en       → Combined filters
/?playing=BBCNews.uk                 → Auto-plays channel on load
```

### localStorage

- `iptv-favorites`: Array of channel IDs
- `iptv-history`: Array of {id, timestamp}, last 50 entries

### Convex Queries

```typescript
channels.list({ countries?, categories?, languages?, search?, cursor? })
channels.getById({ id })
streams.getByChannelId({ channelId })
categories.list()
countries.list()
languages.list()
```

---

## Project Structure

```
iptv/
├── convex/
│   ├── schema.ts              # Database schema
│   ├── channels.ts            # Channel queries
│   ├── streams.ts             # Stream queries
│   ├── categories.ts          # Category queries
│   ├── countries.ts           # Country queries
│   ├── languages.ts           # Language queries
│   ├── sync.ts                # Sync logic
│   └── crons.ts               # Daily sync schedule
│
├── src/
│   ├── app/
│   │   ├── layout.tsx         # Root layout
│   │   ├── page.tsx           # Home page
│   │   └── globals.css        # Styles
│   │
│   ├── components/
│   │   ├── ui/                # shadcn/ui components
│   │   ├── sidebar.tsx        # Filter sidebar
│   │   ├── filter-section.tsx # Collapsible checkbox list
│   │   ├── channel-grid.tsx   # Responsive grid
│   │   ├── channel-card.tsx   # Individual channel card
│   │   ├── video-player.tsx   # Shaka player wrapper
│   │   ├── player-bar.tsx     # Player header
│   │   ├── filter-chips.tsx   # Active filter display
│   │   ├── mobile-filters.tsx # Bottom sheet
│   │   └── search-input.tsx   # Debounced search
│   │
│   ├── hooks/
│   │   ├── use-filters.ts     # URL param sync
│   │   ├── use-favorites.ts   # localStorage favorites
│   │   ├── use-history.ts     # localStorage history
│   │   └── use-player.ts      # Player state
│   │
│   └── lib/
│       ├── shaka.ts           # Shaka player config
│       └── utils.ts           # Helpers
│
├── package.json
├── tailwind.config.ts
└── convex.json
```

---

## MVP Scope

### Included

| Feature | Details |
|---------|---------|
| Channel browsing | Grid with infinite scroll, ~30k+ channels |
| Filtering | Multi-select by country, category, language |
| Search | Full-text search on channel names |
| Video playback | Shaka Player with basic controls |
| Error handling | "Stream unavailable" + retry button |
| Favorites | localStorage, toggle on cards, filter view |
| Watch history | localStorage, last 50 channels |
| Shareable URLs | Filters + playing channel encoded in URL |
| Dark mode | Dark only |
| Responsive | Desktop sidebar, mobile bottom sheet |
| Daily sync | Convex cron job from iptv-org API |

### Excluded (Future)

| Feature | Reason |
|---------|--------|
| User accounts | localStorage sufficient for MVP |
| Stream health checking | Requires background infrastructure |
| Auto-fallback streams | Retry button sufficient |
| EPG/TV guide | Significant extra work |
| PWA/offline | Not core functionality |

---

## Success Criteria

1. User can find and play a channel within 10 seconds
2. Filters respond instantly (no loading spinners)
3. Works smoothly on mobile
4. Streams play reliably when source is valid
5. Portfolio-worthy: clean code, good UX, demonstrates full-stack skills
