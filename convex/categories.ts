import { query } from "./_generated/server";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const categories = await ctx.db.query("categories").collect();
    // Filter out XXX category
    return categories.filter((c) => c.categoryId !== "xxx");
  },
});
