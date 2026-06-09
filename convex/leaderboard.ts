import { v } from "convex/values";
import { query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

export const getLeaderboardPage = query({
  args: { roundId: v.optional(v.id("rounds")) },
  handler: async (ctx, { roundId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const allActive = await ctx.db
      .query("rounds")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();

    const myRounds = allActive.filter((r) => r.participantIds.includes(userId));
    const round =
      (roundId ? myRounds.find((r) => r._id === roundId) : null) ??
      myRounds[0] ??
      null;

    if (!round) return { currentUserId: userId, myRounds, selectedRound: null, leaderboard: null };

    const logs = await ctx.db
      .query("workoutLogs")
      .withIndex("by_roundId", (q) => q.eq("roundId", round._id))
      .filter((q) => q.eq(q.field("status"), "auto_approved"))
      .collect();

    const coinsByUser: Record<string, { weightCoins: number; cardioCoins: number }> = {};
    for (const log of logs) {
      const uid = log.userId;
      if (!coinsByUser[uid]) coinsByUser[uid] = { weightCoins: 0, cardioCoins: 0 };
      if (log.coinType === "weight") coinsByUser[uid].weightCoins += log.coinsEarned;
      else coinsByUser[uid].cardioCoins += log.coinsEarned;
    }

    const participants = await Promise.all(round.participantIds.map((id) => ctx.db.get(id)));

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
    const groupWeightTarget = round.targetWeightCoinsPerPerson * round.participantIds.length;
    const groupCardioTarget = round.targetCardioCoinsPerPerson * round.participantIds.length;

    return {
      currentUserId: userId,
      myRounds,
      selectedRound: round,
      leaderboard: {
        entries,
        group: {
          totalWeightCoins,
          totalCardioCoins,
          groupWeightTarget,
          groupCardioTarget,
          weightProgress: Math.min(1, totalWeightCoins / groupWeightTarget),
          cardioProgress: Math.min(1, totalCardioCoins / groupCardioTarget),
          goalReached: totalWeightCoins >= groupWeightTarget && totalCardioCoins >= groupCardioTarget,
        },
      },
    };
  },
});
