import { query } from "./_generated/server";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { stream, mergedStream } from "convex-helpers/server/stream";
import schema from "./schema";

export const list = query({
  args: {
    countries: v.optional(v.array(v.string())),
    categories: v.optional(v.array(v.string())),
    search: v.optional(v.string()),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const hasCountryFilter = args.countries && args.countries.length > 0;
    const hasCategoryFilter = args.categories && args.categories.length > 0;
    const hasSearch = args.search && args.search.trim();

    // If search is provided, use search index
    if (hasSearch) {
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

    // Country filter: use streams for proper pagination
    if (hasCountryFilter) {
      const countries = args.countries!;

      // Create a stream for each country using the index
      const countryStreams = countries.map((country) =>
        stream(ctx.db, schema)
          .query("channels")
          .withIndex("by_country", (q) => q.eq("country", country))
      );

      // Merge all country streams - ordered by _creationTime (default)
      let channelStream =
        countryStreams.length === 1
          ? countryStreams[0]
          : mergedStream(countryStreams, ["_creationTime"]);

      // Apply category filter if needed
      if (hasCategoryFilter) {
        channelStream = channelStream.filterWith(async (channel) =>
          channel.categories.some((c) => args.categories!.includes(c))
        );
      }

      // Paginate the merged stream
      return await channelStream.paginate(args.paginationOpts);
    }

    // Category filter only (no country filter)
    if (hasCategoryFilter) {
      const channelStream = stream(ctx.db, schema)
        .query("channels")
        .filterWith(async (channel) =>
          channel.categories.some((c) => args.categories!.includes(c))
        );

      return await channelStream.paginate(args.paginationOpts);
    }

    // No filters - use standard pagination
    return await ctx.db.query("channels").paginate(args.paginationOpts);
  },
});

function filterChannels(
  channels: any[],
  args: {
    countries?: string[];
    categories?: string[];
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

