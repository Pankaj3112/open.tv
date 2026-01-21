import { action } from "./_generated/server";
import { internal } from "./_generated/api";

export const triggerSync = action({
  args: {},
  handler: async (ctx) => {
    await ctx.runAction(internal.sync.syncAll);
    return { success: true };
  },
});
