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
      const filtered = filterChannels(results, args);
      return {
        channels: filtered,
        nextCursor: undefined,
        totalCount: filtered.length,
      };
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
