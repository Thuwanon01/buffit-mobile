import { v } from "convex/values";
import { mutation, query, internalQuery } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

async function requireAdmin(ctx: any) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Not authenticated");
  const user = await ctx.db.get(userId);
  if (!user?.isAdmin) throw new Error("Not authorized");
  return user;
}

// Full settings row (includes the LINE channel access token). For system
// callers only (cron / LINE actions) — NOT exposed to clients.
export const getSettingsInternal = internalQuery({
  args: {},
  handler: async (ctx) => ctx.db.query("adminSettings").first(),
});

// Public query is admin-gated: the row contains the LINE channel access token,
// so it must never be readable by unauthenticated or non-admin callers. Returns
// null (rather than throwing) for non-admins so the client stays in a normal
// loaded state.
export const getSettings = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const user = await ctx.db.get(userId);
    if (!user?.isAdmin) return null;
    return ctx.db.query("adminSettings").first();
  },
});

export const upsertSettings = mutation({
  args: {
    dailyProgressTime: v.optional(v.string()),
    lineChannelAccessToken: v.optional(v.string()),
    lineGroupId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const existing = await ctx.db.query("adminSettings").first();
    if (existing) {
      const patch: any = {};
      for (const [k, v] of Object.entries(args)) {
        if (v !== undefined) patch[k] = v;
      }
      await ctx.db.patch(existing._id, patch);
    } else {
      await ctx.db.insert("adminSettings", {
        dailyProgressTime: args.dailyProgressTime ?? "22:00",
        lineChannelAccessToken: args.lineChannelAccessToken,
        lineGroupId: args.lineGroupId,
      });
    }
  },
});

export const getLevelThresholds = query({
  args: {},
  handler: async (ctx) => {
    return ctx.db.query("levelThresholds").withIndex("by_level").collect();
  },
});

export const upsertLevelThreshold = mutation({
  args: {
    level: v.number(),
    minLifetimeCoins: v.float64(),
  },
  handler: async (ctx, { level, minLifetimeCoins }) => {
    await requireAdmin(ctx);
    const existing = await ctx.db
      .query("levelThresholds")
      .withIndex("by_level", (q) => q.eq("level", level))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, { minLifetimeCoins });
    } else {
      await ctx.db.insert("levelThresholds", { level, minLifetimeCoins });
    }
  },
});

export const deleteLevelThreshold = mutation({
  args: { id: v.id("levelThresholds") },
  handler: async (ctx, { id }) => {
    await requireAdmin(ctx);
    await ctx.db.delete(id);
  },
});
