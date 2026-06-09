import { v } from "convex/values";
import { query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { computeLevelProgress } from "./users";

export const getAdminUsersPage = query({
  args: { roundId: v.optional(v.id("rounds")) },
  handler: async (ctx, { roundId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const caller = await ctx.db.get(userId);
    if (!caller?.isAdmin) return null;

    const [users, allActive, activities] = await Promise.all([
      ctx.db.query("users").collect(),
      ctx.db
        .query("rounds")
        .withIndex("by_status", (q) => q.eq("status", "active"))
        .collect(),
      ctx.db
        .query("activityTypes")
        .withIndex("by_status", (q) => q.eq("status", "approved"))
        .collect(),
    ]);

    const levelProgress = await Promise.all(
      users.map(async (u) => ({ userId: u._id, ...(await computeLevelProgress(ctx, u)) }))
    );

    const round =
      (roundId ? allActive.find((r) => r._id === roundId) : null) ??
      allActive[0] ??
      null;

    const logs = round
      ? await ctx.db
          .query("workoutLogs")
          .withIndex("by_roundId", (q) => q.eq("roundId", round._id))
          .order("desc")
          .collect()
      : [];

    return {
      users,
      levelProgress,
      activeRounds: allActive,
      selectedRound: round,
      logs,
      activities,
    };
  },
});
