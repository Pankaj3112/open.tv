import { query } from "./_generated/server";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { stream, mergedStream } from "convex-helpers/server/stream";
import schema from "./schema";

export const list = query({
  args: {
    countries: v.optional(v.array(v.string())),
    categories: v.optional(v.array(v.string())),
    nameSearch: v.optional(v.string()),
    search: v.optional(v.string()), // Alias for nameSearch for backwards compatibility
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const { countries, categories, paginationOpts } = args;
    const nameSearch = args.nameSearch || args.search;

    const hasCountryFilter = countries && countries.length > 0;
    const hasCategoryFilter = categories && categories.length > 0;

    // Text search path - use search index with post-filtering
    if (nameSearch) {
      const results = await ctx.db
        .query("channels")
        .withSearchIndex("search_name", (q) => q.search("name", nameSearch))
        .paginate(paginationOpts);

      return {
        ...results,
        page: results.page.filter((ch) => {
          const matchesCountry = !hasCountryFilter || countries.includes(ch.country);
          const matchesCategory = !hasCategoryFilter || categories.includes(ch.category);
          return matchesCountry && matchesCategory;
        }),
      };
    }

    // Single category + single country = compound index (fastest)
    if (categories?.length === 1 && countries?.length === 1) {
      return ctx.db
        .query("channels")
        .withIndex("by_category_country", (q) =>
          q.eq("category", categories[0]).eq("country", countries[0])
        )
        .paginate(paginationOpts);
    }

    // Single category + multiple countries = use category index with country filter
    if (categories?.length === 1 && hasCountryFilter) {
      const channelStream = stream(ctx.db, schema)
        .query("channels")
        .withIndex("by_category", (q) => q.eq("category", categories[0]))
        .filterWith(async (channel) => countries.includes(channel.country));

      return channelStream.paginate(paginationOpts);
    }

    // Single category, no country filter
    if (categories?.length === 1) {
      return stream(ctx.db, schema)
        .query("channels")
        .withIndex("by_category", (q) => q.eq("category", categories[0]))
        .paginate(paginationOpts);
    }

    // Country filter with multiple categories
    if (hasCountryFilter && hasCategoryFilter) {
      const countryStreams = countries.map((country) =>
        stream(ctx.db, schema)
          .query("channels")
          .withIndex("by_country", (q) => q.eq("country", country))
      );

      const channelStream =
        countryStreams.length === 1
          ? countryStreams[0]
          : mergedStream(countryStreams, ["_creationTime"]);

      return channelStream
        .filterWith(async (channel) => categories.includes(channel.category))
        .paginate(paginationOpts);
    }

    // Country filter only (no category filter)
    if (hasCountryFilter) {
      const countryStreams = countries.map((country) =>
        stream(ctx.db, schema)
          .query("channels")
          .withIndex("by_country", (q) => q.eq("country", country))
      );

      const channelStream =
        countryStreams.length === 1
          ? countryStreams[0]
          : mergedStream(countryStreams, ["_creationTime"]);

      return channelStream.paginate(paginationOpts);
    }

    // Multiple categories, no country filter
    // Use by_category index (orders by [category, _creationTime]) so mergedStream works
    if (hasCategoryFilter) {
      const categoryStreams = categories.map((category) =>
        stream(ctx.db, schema)
          .query("channels")
          .withIndex("by_category", (q) => q.eq("category", category))
      );

      const channelStream =
        categoryStreams.length === 1
          ? categoryStreams[0]
          : mergedStream(categoryStreams, ["_creationTime"]);

      return channelStream.paginate(paginationOpts);
    }

    // No filters - use standard pagination
    return ctx.db.query("channels").paginate(paginationOpts);
  },
});

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
