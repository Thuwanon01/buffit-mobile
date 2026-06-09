import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

async function requireAdmin(ctx: any) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Not authenticated");
  const user = await ctx.db.get(userId);
  if (!user?.isAdmin) throw new Error("Not authorized");
  return user;
}

export const getActiveRounds = query({
  args: {},
  handler: async (ctx) => {
    return ctx.db
      .query("rounds")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();
  },
});

export const getAllRounds = query({
  args: {},
  handler: async (ctx) => {
    return ctx.db.query("rounds").order("desc").collect();
  },
});

export const getRoundById = query({
  args: { id: v.id("rounds") },
  handler: async (ctx, { id }) => ctx.db.get(id),
});

export const createRound = mutation({
  args: {
    name: v.string(),
    rewardDescription: v.string(),
    participantIds: v.array(v.id("users")),
    targetWeightCoinsPerPerson: v.float64(),
    targetCardioCoinsPerPerson: v.float64(),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    return ctx.db.insert("rounds", {
      ...args,
      status: "active",
      createdBy: admin._id,
    });
  },
});

export const updateRound = mutation({
  args: {
    id: v.id("rounds"),
    name: v.optional(v.string()),
    rewardDescription: v.optional(v.string()),
    participantIds: v.optional(v.array(v.id("users"))),
    targetWeightCoinsPerPerson: v.optional(v.float64()),
    targetCardioCoinsPerPerson: v.optional(v.float64()),
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

export const closeRound = mutation({
  args: { id: v.id("rounds"), buffetDate: v.optional(v.number()) },
  handler: async (ctx, { id, buffetDate }) => {
    await requireAdmin(ctx);
    const patch: any = { status: "completed" };
    if (buffetDate !== undefined) patch.buffetDate = buffetDate;
    await ctx.db.patch(id, patch);
  },
});

export const setBuffetDate = mutation({
  args: { id: v.id("rounds"), buffetDate: v.number() },
  handler: async (ctx, { id, buffetDate }) => {
    await requireAdmin(ctx);
    await ctx.db.patch(id, { buffetDate });
  },
});

export const joinRound = mutation({
  args: { roundId: v.id("rounds") },
  handler: async (ctx, { roundId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const round = await ctx.db.get(roundId);
    if (!round || round.status !== "active") throw new Error("Round not active");
    if (round.participantIds.includes(userId)) throw new Error("Already a participant");

    await ctx.db.patch(roundId, { participantIds: [...round.participantIds, userId] });
  },
});

export const removeParticipant = mutation({
  args: { roundId: v.id("rounds"), userId: v.id("users") },
  handler: async (ctx, { roundId, userId }) => {
    await requireAdmin(ctx);

    const round = await ctx.db.get(roundId);
    if (!round) throw new Error("Round not found");
    if (!round.participantIds.includes(userId)) throw new Error("Not a participant");

    await ctx.db.patch(roundId, {
      participantIds: round.participantIds.filter((id) => id !== userId),
    });
  },
});
