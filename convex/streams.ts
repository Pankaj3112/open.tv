import { query } from "./_generated/server";
import { v } from "convex/values";

export const getByChannelId = query({
  args: { channelId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("streams")
      .withIndex("by_channelId", (q) => q.eq("channelId", args.channelId))
      .collect();
  },
});
