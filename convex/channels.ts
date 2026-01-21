import { query } from "./_generated/server";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";

export const list = query({
  args: {
    countries: v.optional(v.array(v.string())),
    categories: v.optional(v.array(v.string())),
    languages: v.optional(v.array(v.string())),
    search: v.optional(v.string()),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    // If search is provided, use search index
    if (args.search && args.search.trim()) {
      const results = await ctx.db
        .query("channels")
        .withSearchIndex("search_name", (q) => q.search("name", args.search!))
        .take(args.paginationOpts.numItems);

      // Apply filters to search results
      const filtered = filterChannels(results, args);
      return {
        page: filtered,
        isDone: true,
        continueCursor: "",
      };
    }

    // If filtering by a single country, use the country index for efficiency
    if (args.countries?.length === 1 && !args.categories?.length && !args.languages?.length) {
      const result = await ctx.db
        .query("channels")
        .withIndex("by_country", (q) => q.eq("country", args.countries![0]))
        .paginate(args.paginationOpts);

      return result;
    }

    // For no filters or complex filters, use pagination
    // When filters are applied, we fetch more and filter client-side
    const hasFilters = args.countries?.length || args.categories?.length || args.languages?.length;

    if (hasFilters) {
      // Fetch more items to account for filtering
      const fetchLimit = args.paginationOpts.numItems * 5;
      const results = await ctx.db
        .query("channels")
        .take(fetchLimit);

      const filtered = filterChannels(results, args);
      const page = filtered.slice(0, args.paginationOpts.numItems);

      return {
        page,
        isDone: filtered.length <= args.paginationOpts.numItems,
        continueCursor: "",
      };
    }

    // No filters - use standard pagination
    const result = await ctx.db
      .query("channels")
      .paginate(args.paginationOpts);

    return result;
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
