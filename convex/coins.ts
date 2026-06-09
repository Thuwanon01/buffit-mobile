import { v } from "convex/values";
import { query, internalMutation } from "./_generated/server";
import { continueRound } from "./roundContinuation";

export const getLeaderboard = query({
  args: { roundId: v.id("rounds") },
  handler: async (ctx, { roundId }) => {
    const round = await ctx.db.get(roundId);
    if (!round) return null;

    const logs = await ctx.db
      .query("workoutLogs")
      .withIndex("by_roundId", (q) => q.eq("roundId", roundId))
      .filter((q) => q.eq(q.field("status"), "auto_approved"))
      .collect();

    const coinsByUser: Record<
      string,
      { weightCoins: number; cardioCoins: number; userId: string }
    > = {};

    for (const log of logs) {
      const uid = log.userId;
      if (!coinsByUser[uid]) {
        coinsByUser[uid] = { weightCoins: 0, cardioCoins: 0, userId: uid };
      }
      if (log.coinType === "weight") {
        coinsByUser[uid].weightCoins += log.coinsEarned;
      } else {
        coinsByUser[uid].cardioCoins += log.coinsEarned;
      }
    }

    const participants = await Promise.all(
      round.participantIds.map((id) => ctx.db.get(id))
    );

    const entries = round.participantIds.map((id) => {
      const user = participants.find((u) => u?._id === id);
      const coins = coinsByUser[id] ?? { weightCoins: 0, cardioCoins: 0 };
      return {
        userId: id,
        name: user?.name ?? "Unknown",
        avatarUrl: user?.avatarUrl,
        level: user?.level ?? 1,
        weightCoins: coins.weightCoins,
        cardioCoins: coins.cardioCoins,
        totalCoins: coins.weightCoins + coins.cardioCoins,
        weightTarget: round.targetWeightCoinsPerPerson,
        cardioTarget: round.targetCardioCoinsPerPerson,
      };
    });

    entries.sort((a, b) => b.totalCoins - a.totalCoins);

    const totalWeightCoins = entries.reduce((s, e) => s + e.weightCoins, 0);
    const totalCardioCoins = entries.reduce((s, e) => s + e.cardioCoins, 0);
    const groupWeightTarget =
      round.targetWeightCoinsPerPerson * round.participantIds.length;
    const groupCardioTarget =
      round.targetCardioCoinsPerPerson * round.participantIds.length;

    return {
      entries,
      group: {
        totalWeightCoins,
        totalCardioCoins,
        groupWeightTarget,
        groupCardioTarget,
        weightProgress: Math.min(1, totalWeightCoins / groupWeightTarget),
        cardioProgress: Math.min(1, totalCardioCoins / groupCardioTarget),
        goalReached:
          totalWeightCoins >= groupWeightTarget &&
          totalCardioCoins >= groupCardioTarget,
      },
    };
  },
});

export const checkGroupTarget = internalMutation({
  args: { roundId: v.id("rounds") },
  handler: async (ctx, { roundId }) => {
    const round = await ctx.db.get(roundId);
    if (!round || round.status !== "active" || round.goalReachedAt) return;

    const logs = await ctx.db
      .query("workoutLogs")
      .withIndex("by_roundId", (q) => q.eq("roundId", roundId))
      .filter((q) => q.eq(q.field("status"), "auto_approved"))
      .collect();

    const participantSet = new Set(round.participantIds.map(String));
    let totalWeight = 0;
    let totalCardio = 0;
    for (const log of logs) {
      if (!participantSet.has(String(log.userId))) continue;
      if (log.coinType === "weight") totalWeight += log.coinsEarned;
      else totalCardio += log.coinsEarned;
    }

    const groupWeightTarget =
      round.targetWeightCoinsPerPerson * round.participantIds.length;
    const groupCardioTarget =
      round.targetCardioCoinsPerPerson * round.participantIds.length;

    if (totalWeight >= groupWeightTarget && totalCardio >= groupCardioTarget) {
      await ctx.db.patch(roundId, { goalReachedAt: Date.now(), status: "completed" });
      await continueRound(ctx, round);
    }
  },
});

export const getAdminSettings = query({
  args: {},
  handler: async (ctx) => {
    return ctx.db.query("adminSettings").first();
  },
});
