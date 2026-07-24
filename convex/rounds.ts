import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Id } from "./_generated/dataModel";
import { QueryCtx, MutationCtx } from "./_generated/server";

async function requireAdmin(ctx: QueryCtx | MutationCtx) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Not authenticated");
  const user = await ctx.db.get(userId);
  if (!user?.isAdmin) throw new Error("Not authorized");
  return user;
}

async function getMyGroupIds(ctx: QueryCtx | MutationCtx, userId: Id<"users">) {
  const memberships = await ctx.db
    .query("groupMembers")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .collect();
  return memberships.map((m) => m.groupId);
}

export const getActiveRounds = query({
  args: { groupId: v.optional(v.id("groups")) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const user = await ctx.db.get(userId);
    if (!user) return [];

    const myGroupIds = new Set<string>(await getMyGroupIds(ctx, user._id));

    // Explicit group view: only honored for members of that group, so a caller
    // cannot read another group's rounds (name, targets, participant ids) by
    // passing an arbitrary groupId.
    if (args.groupId) {
      if (!myGroupIds.has(args.groupId)) return [];
      return ctx.db
        .query("rounds")
        .withIndex("by_groupId", (q) => q.eq("groupId", args.groupId!))
        .filter((q) => q.eq(q.field("status"), "active"))
        .take(50);
    }

    // Default view: every active round the caller can see — rounds in their
    // groups, rounds they are a participant of (this is what the mobile app
    // relies on, since mobile users have no Convex group membership), or legacy
    // rounds with no group.
    const activeRounds = await ctx.db
      .query("rounds")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();

    return activeRounds.filter(
      (r) =>
        r.groupId === undefined ||
        (r.groupId !== undefined && myGroupIds.has(r.groupId)) ||
        r.participantIds.includes(user._id)
    );
  },
});

export const getAllRounds = query({
  args: { groupId: v.optional(v.id("groups")) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const user = await ctx.db.get(userId);
    if (!user) return [];

    if (user.isAdmin) {
      return ctx.db.query("rounds").order("desc").collect();
    }

    const myGroupIds = new Set<string>(await getMyGroupIds(ctx, user._id));

    // Explicit group view: members only (see getActiveRounds).
    if (args.groupId) {
      if (!myGroupIds.has(args.groupId)) return [];
      return ctx.db
        .query("rounds")
        .withIndex("by_groupId", (q) => q.eq("groupId", args.groupId!))
        .order("desc")
        .take(100);
    }

    // Default view: rounds in the caller's groups, rounds they participate in,
    // or legacy rounds with no group.
    const allRounds = await ctx.db.query("rounds").order("desc").collect();
    return allRounds.filter(
      (r) =>
        r.groupId === undefined ||
        (r.groupId !== undefined && myGroupIds.has(r.groupId)) ||
        r.participantIds.includes(user._id)
    );
  },
});

export const getRoundById = query({
  args: { id: v.id("rounds") },
  handler: async (ctx, { id }) => ctx.db.get(id),
});

export const createRound = mutation({
  args: {
    // Optional: the mobile admin screen has no group picker and creates
    // groupless (legacy) rounds. Global admins may omit it; everyone else must
    // supply a group they own.
    groupId: v.optional(v.id("groups")),
    name: v.string(),
    rewardDescription: v.string(),
    participantIds: v.array(v.id("users")),
    targetWeightCoinsPerPerson: v.float64(),
    targetCardioCoinsPerPerson: v.float64(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const user = await ctx.db.get(userId);
    if (!user) throw new Error("User not found");

    const { groupId, ...rest } = args;

    if (groupId === undefined) {
      // Groupless round — restricted to global admins.
      if (!user.isAdmin) throw new Error("Not authorized");
    } else {
      // Group owner OR admin can create a round
      const membership = await ctx.db
        .query("groupMembers")
        .withIndex("by_groupId_and_userId", (q) =>
          q.eq("groupId", groupId).eq("userId", user._id)
        )
        .unique();
      if (!membership && !user.isAdmin) throw new Error("Must be a group member to create a round");
      if (membership?.role !== "owner" && !user.isAdmin) throw new Error("Only the group owner can create rounds");
    }

    return ctx.db.insert("rounds", {
      ...rest,
      ...(groupId !== undefined ? { groupId } : {}),
      status: "active",
      createdBy: user._id,
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
    const patch: Record<string, unknown> = {};
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
    const patch: Record<string, unknown> = { status: "completed" };
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

export const createSoloRound = mutation({
  args: {
    targetWeightCoinsPerPerson: v.optional(v.float64()),
    targetCardioCoinsPerPerson: v.optional(v.float64()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const user = await ctx.db.get(userId);
    if (!user) throw new Error("User not found");

    // Idempotent: return existing active solo round if one exists
    const existing = await ctx.db
      .query("rounds")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .filter((q) =>
        q.and(q.eq(q.field("createdBy"), user._id), q.eq(q.field("groupId"), undefined))
      )
      .first();
    if (existing) return existing._id;

    const now = new Date();
    const monthTh = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
    const name = `Solo ${monthTh[now.getMonth()]} ${now.getFullYear() + 543}`;

    return ctx.db.insert("rounds", {
      name,
      rewardDescription: "เป้าหมายส่วนตัว",
      participantIds: [user._id],
      targetWeightCoinsPerPerson: args.targetWeightCoinsPerPerson ?? 50,
      targetCardioCoinsPerPerson: args.targetCardioCoinsPerPerson ?? 50,
      status: "active",
      createdBy: user._id,
    });
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

    // Group rounds may only be joined by members of that group — otherwise any
    // user could join any group's round (inflating its per-person target and
    // polluting the leaderboard). Legacy rounds with no group stay open.
    if (round.groupId !== undefined) {
      const membership = await ctx.db
        .query("groupMembers")
        .withIndex("by_groupId_and_userId", (q) =>
          q.eq("groupId", round.groupId!).eq("userId", userId)
        )
        .unique();
      if (!membership) throw new Error("Must be a group member to join this round");
    }

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
