import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";
import { DEFAULT_ACTIVITIES } from "./defaultActivities";

async function requireAdmin(ctx: any) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Not authenticated");
  const user = await ctx.db.get(userId);
  if (!user?.isAdmin) throw new Error("Not authorized");
  return user;
}

export const getApprovedActivities = query({
  args: {},
  handler: async (ctx) => {
    return ctx.db
      .query("activityTypes")
      .withIndex("by_status", (q) => q.eq("status", "approved"))
      .collect();
  },
});

export const getAllActivities = query({
  args: {},
  handler: async (ctx) => {
    return ctx.db.query("activityTypes").collect();
  },
});

export const updateActivity = mutation({
  args: {
    id: v.id("activityTypes"),
    criteriaPerLevel: v.optional(
      v.array(
        v.object({
          level: v.number(),
          metric: v.string(),
          value: v.float64(),
          unit: v.string(),
        })
      )
    ),
    weightMultiplier: v.optional(v.float64()),
    category: v.optional(v.string()),
  },
  handler: async (ctx, { id, ...updates }) => {
    await requireAdmin(ctx);
    const patch: any = {};
    for (const [k, v] of Object.entries(updates)) {
      if (v !== undefined) patch[k] = v;
    }
    await ctx.db.patch(id, patch);
  },
});

export const createActivity = mutation({
  args: {
    name: v.string(),
    category: v.string(),
    criteriaPerLevel: v.array(
      v.object({
        level: v.number(),
        metric: v.string(),
        value: v.float64(),
        unit: v.string(),
      })
    ),
    weightMultiplier: v.float64(),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    await ctx.db.insert("activityTypes", {
      name: args.name,
      category: args.category,
      criteriaPerLevel: args.criteriaPerLevel,
      weightMultiplier: args.weightMultiplier,
      proposedBy: admin._id,
      status: "approved",
      approvedBy: admin._id,
    });
  },
});

export const deleteActivity = mutation({
  args: { id: v.id("activityTypes") },
  handler: async (ctx, { id }) => {
    await requireAdmin(ctx);
    await ctx.db.delete(id);
  },
});


export const getActivityById = query({
  args: { id: v.id("activityTypes") },
  handler: async (ctx, { id }) => ctx.db.get(id),
});

export const seedDefaultActivities = mutation({
  args: {},
  handler: async (ctx) => {
    const admin = await requireAdmin(ctx);

    const existing = await ctx.db.query("activityTypes").collect();
    const existingNames = new Set(existing.map((a) => a.name));

    let inserted = 0;
    for (const act of DEFAULT_ACTIVITIES) {
      if (existingNames.has(act.name)) continue;
      await ctx.db.insert("activityTypes", {
        name: act.name,
        nameEn: act.nameEn,
        category: act.category,
        criteriaPerLevel: act.criteria.map((c) => ({
          level: c.level,
          metric: act.metric,
          value: c.value,
          unit: act.unit,
        })),
        weightMultiplier: act.multiplier,
        proposedBy: admin._id,
        status: "approved",
        approvedBy: admin._id,
      });
      inserted++;
    }
    return { inserted, skipped: DEFAULT_ACTIVITIES.length - inserted };
  },
});

