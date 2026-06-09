import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

export const getRecentNotifications = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit = 50 }) => {
    return ctx.db
      .query("notifications")
      .withIndex("by_sentAt")
      .order("desc")
      .take(limit);
  },
});

export const sendBroadcast = mutation({
  args: { message: v.string() },
  handler: async (ctx, { message }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const user = await ctx.db.get(userId);
    if (!user?.isAdmin) throw new Error("Not authorized");

    await ctx.db.insert("notifications", {
      type: "broadcast",
      message,
      sentAt: Date.now(),
      sentBy: user._id,
    });
  },
});
