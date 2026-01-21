import { internalAction, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

const API_BASE = "https://iptv-org.github.io/api";
const LOGOS_URL = "https://raw.githubusercontent.com/iptv-org/database/master/data/logos.csv";

// API response types
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
  languages?: string[];
}

interface ApiLanguage {
  code: string;
  name: string;
}

// Parse a CSV line handling quoted fields
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

// Calculate score for logo selection (higher = better)
function calculateLogoScore(
  feed: string,
  tags: string,
  width: string,
  height: string,
  format: string
): number {
  let score = 0;

  // Prefer no feed (main logo)
  if (!feed) score += 1000;

  // Prefer larger images
  const size = (parseInt(width) || 0) * (parseInt(height) || 0);
  score += Math.min(size / 1000, 500);

  // Prefer color over picons
  if (tags?.includes("color")) score += 100;
  if (tags?.includes("picons")) score -= 50;

  // Prefer PNG > JPEG > SVG
  if (format === "PNG") score += 50;
  else if (format === "JPEG") score += 30;
  else if (format === "SVG") score += 20;

  return score;
}

// Parse logos CSV and return map of channelId -> best logo URL
function parseLogosCSV(csv: string): Map<string, string> {
  const lines = csv.split("\n");
  const logoMap = new Map<string, { url: string; score: number }>();

  // Skip header row
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

  // Convert to simple channelId -> url map
  return new Map([...logoMap].map(([k, v]) => [k, v.url]));
}

export const syncAll = internalAction({
  args: {},
  handler: async (ctx) => {
    console.log("Starting IPTV data sync...");

    try {
      // Fetch all data in parallel (including logos CSV)
      const [channelsRes, streamsRes, categoriesRes, countriesRes, languagesRes, logosRes] =
        await Promise.all([
          fetch(`${API_BASE}/channels.json`),
          fetch(`${API_BASE}/streams.json`),
          fetch(`${API_BASE}/categories.json`),
          fetch(`${API_BASE}/countries.json`),
          fetch(`${API_BASE}/languages.json`),
          fetch(LOGOS_URL),
        ]);

      const [channels, streams, categories, countries, languages, logosCSV] =
        await Promise.all([
          channelsRes.json(),
          streamsRes.json(),
          categoriesRes.json(),
          countriesRes.json(),
          languagesRes.json(),
          logosRes.text(),
        ]);

      // Parse logos CSV into a map
      const logoMap = parseLogosCSV(logosCSV);
      console.log(`Parsed ${logoMap.size} channel logos`);

      // Filter out NSFW and closed channels
      const safeChannels = (channels as ApiChannel[]).filter(
        (c) => !c.is_nsfw && !c.closed && c.id && c.country
      );

      // Filter out streams with no channel reference
      const validStreams = (streams as ApiStream[]).filter(
        (s) => s.channel && s.url
      );

      console.log(`Fetched ${safeChannels.length} safe channels, ${validStreams.length} valid streams`);

      // Sync each data type in batches to avoid read limits
      const BATCH_SIZE = 100;

      // Categories (usually ~30, so one batch is fine)
      await ctx.runMutation(internal.sync.upsertCategories, {
        categories: (categories as ApiCategory[]).map((c) => ({
          categoryId: c.id,
          name: c.name,
        })),
      });

      // Countries in batches
      const typedCountries = countries as ApiCountry[];
      for (let i = 0; i < typedCountries.length; i += BATCH_SIZE) {
        const batch = typedCountries.slice(i, i + BATCH_SIZE);
        await ctx.runMutation(internal.sync.upsertCountriesBatch, {
          countries: batch.map((c) => ({
            code: c.code,
            name: c.name,
            flag: c.flag || "",
            languages: c.languages || [],
          })),
        });
      }

      // Languages in batches
      const typedLanguages = languages as ApiLanguage[];
      for (let i = 0; i < typedLanguages.length; i += BATCH_SIZE) {
        const batch = typedLanguages.slice(i, i + BATCH_SIZE);
        await ctx.runMutation(internal.sync.upsertLanguagesBatch, {
          languages: batch.map((l) => ({
            code: l.code,
            name: l.name,
          })),
        });
      }

      // Sync channels in batches
      for (let i = 0; i < safeChannels.length; i += BATCH_SIZE) {
        const batch = safeChannels.slice(i, i + BATCH_SIZE);
        await ctx.runMutation(internal.sync.upsertChannelsBatch, {
          channels: batch.map((c) => ({
            channelId: c.id,
            name: c.name,
            logo: logoMap.get(c.id) || undefined,
            country: c.country,
            category: c.categories?.[0] || "general",
            languages: [],
            network: c.network || undefined,
          })),
        });
      }

      // Sync streams in batches
      for (let i = 0; i < validStreams.length; i += BATCH_SIZE) {
        const batch = validStreams.slice(i, i + BATCH_SIZE);
        await ctx.runMutation(internal.sync.upsertStreamsBatch, {
          streams: batch.map((s) => ({
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

export const upsertCountriesBatch = internalMutation({
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

export const upsertLanguagesBatch = internalMutation({
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
        category: v.string(),
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
