import { v } from "convex/values";
import { mutation, query, internalMutation, QueryCtx } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";
import { Doc } from "./_generated/dataModel";

export async function computeLevelProgress(ctx: QueryCtx, user: Doc<"users">) {
  const total = user.lifetimeWeightCoins + user.lifetimeCardioCoins;

  const personal = await ctx.db
    .query("userLevelThresholds")
    .withIndex("by_userId", (q) => q.eq("userId", user._id))
    .collect();
  const thresholds = (
    personal.length > 0
      ? personal
      : await ctx.db.query("levelThresholds").withIndex("by_level").collect()
  ).sort((a, b) => a.level - b.level);

  const byLevel = new Map(thresholds.map((t) => [t.level, t.minLifetimeCoins]));
  const currentLevelMin = byLevel.get(user.level) ?? 0;
  const nextLevel = thresholds.find((t) => t.level > user.level)?.level ?? null;
  const nextLevelMin = nextLevel != null ? byLevel.get(nextLevel)! : null;
  const span = nextLevelMin != null ? nextLevelMin - currentLevelMin : 0;

  return {
    level: user.level,
    total,
    isPersonalized: personal.length > 0,
    thresholds,
    currentLevelMin,
    nextLevel,
    nextLevelMin,
    coinsToNext: nextLevelMin != null ? Math.max(0, nextLevelMin - total) : null,
    progress: nextLevelMin != null && span > 0
      ? Math.min(1, Math.max(0, (total - currentLevelMin) / span))
      : 1,
  };
}

export const getMyLevelProgress = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const user = await ctx.db.get(userId);
    if (!user) return null;
    return computeLevelProgress(ctx, user);
  },
});

export const getAllLevelProgress = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const caller = await ctx.db.get(userId);
    if (!caller?.isAdmin) return [];

    const users = await ctx.db.query("users").collect();
    const result = [];
    for (const u of users) {
      result.push({ userId: u._id, name: u.name, ...(await computeLevelProgress(ctx, u)) });
    }
    return result;
  },
});

export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    return ctx.db.get(userId);
  },
});

export const getUserById = query({
  args: { id: v.id("users") },
  handler: async (ctx, { id }) => ctx.db.get(id),
});

export const getAllUsers = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return ctx.db.query("users").collect();
  },
});

export const createOrUpdateProfile = mutation({
  args: {
    name: v.string(),
    email: v.string(),
    avatarUrl: v.optional(v.string()),
    age: v.optional(v.number()),
    gender: v.optional(v.string()),
    weightKg: v.optional(v.number()),
    heightCm: v.optional(v.number()),
    fitnessLevel: v.optional(v.string()),
    weeklyFrequency: v.optional(v.number()),
    goals: v.optional(v.array(v.string())),
    medicalConditions: v.optional(v.string()),
    physicalLimitations: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const existing = await ctx.db.get(userId);

    if (existing) {
      await ctx.db.patch(existing._id, { ...args, profileCompleted: true });
      await ctx.scheduler.runAfter(0, internal.aiCoach.generateLevelThresholds, { userId: existing._id });
      return existing._id;
    }

    return userId;
  },
});

export const setLineUserId = mutation({
  args: { lineUserId: v.string() },
  handler: async (ctx, { lineUserId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const user = await ctx.db.get(userId);
    if (!user) throw new Error("User not found");
    await ctx.db.patch(user._id, { lineUserId });
  },
});

export const markTutorialSeen = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const user = await ctx.db.get(userId);
    if (!user) throw new Error("User not found");
    await ctx.db.patch(user._id, { hasSeenTutorial: true });
  },
});

export const promoteToAdmin = mutation({
  args: { targetUserId: v.id("users") },
  handler: async (ctx, { targetUserId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const caller = await ctx.db.get(userId);
    if (!caller?.isAdmin) throw new Error("Not authorized");
    await ctx.db.patch(targetUserId, { isAdmin: true });
  },
});

export const updateLevel = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const user = await ctx.db.get(userId);
    if (!user) return;
    const total = user.lifetimeWeightCoins + user.lifetimeCardioCoins;

    const personal = await ctx.db
      .query("userLevelThresholds")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();

    const source = personal.length > 0
      ? personal
      : await ctx.db.query("levelThresholds").withIndex("by_level").collect();

    const sorted = source.sort((a, b) => b.level - a.level);
    const newLevel = sorted.find((t) => total >= t.minLifetimeCoins)?.level ?? 1;
    if (newLevel !== user.level) {
      await ctx.db.patch(userId, { level: newLevel });
      if (newLevel > user.level) {
        await ctx.db.insert("notifications", {
          type: "milestone",
          message: `${user.name} ขึ้น Level ${newLevel}!`,
          sentAt: Date.now(),
          relatedUserId: userId,
        });
        await ctx.scheduler.runAfter(0, internal.line.notifyMilestone, { userId, newLevel });
      }
    }
  },
});
