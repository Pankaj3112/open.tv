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

      // Filter out NSFW and closed channels
      const safeChannels = channels.filter(
        (c: any) => !c.is_nsfw && !c.closed && c.id && c.country
      );

      // Filter out streams with no channel reference
      const validStreams = streams.filter(
        (s: any) => s.channel && s.url
      );

      console.log(`Fetched ${safeChannels.length} safe channels, ${validStreams.length} valid streams`);

      // Sync each data type in batches to avoid read limits
      const BATCH_SIZE = 100;

      // Categories (usually ~30, so one batch is fine)
      await ctx.runMutation(internal.sync.upsertCategories, {
        categories: categories.map((c: any) => ({
          categoryId: c.id,
          name: c.name,
        })),
      });

      // Countries in batches
      for (let i = 0; i < countries.length; i += BATCH_SIZE) {
        const batch = countries.slice(i, i + BATCH_SIZE);
        await ctx.runMutation(internal.sync.upsertCountriesBatch, {
          countries: batch.map((c: any) => ({
            code: c.code,
            name: c.name,
            flag: c.flag || "",
            languages: c.languages || [],
          })),
        });
      }

      // Languages in batches
      for (let i = 0; i < languages.length; i += BATCH_SIZE) {
        const batch = languages.slice(i, i + BATCH_SIZE);
        await ctx.runMutation(internal.sync.upsertLanguagesBatch, {
          languages: batch.map((l: any) => ({
            code: l.code,
            name: l.name,
          })),
        });
      }

      // Sync channels in batches
      for (let i = 0; i < safeChannels.length; i += BATCH_SIZE) {
        const batch = safeChannels.slice(i, i + BATCH_SIZE);
        await ctx.runMutation(internal.sync.upsertChannelsBatch, {
          channels: batch.map((c: any) => ({
            channelId: c.id,
            name: c.name,
            logo: undefined, // Logo is in separate logos.json, not included in MVP
            country: c.country,
            categories: c.categories || [],
            languages: [], // Languages not in channels.json
            network: c.network || undefined,
          })),
        });
      }

      // Sync streams in batches
      for (let i = 0; i < validStreams.length; i += BATCH_SIZE) {
        const batch = validStreams.slice(i, i + BATCH_SIZE);
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
