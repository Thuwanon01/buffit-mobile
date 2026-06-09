import { v } from "convex/values";
import { query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { computeLevelProgress } from "./users";

export const getDashboardPage = query({
  args: { roundId: v.optional(v.id("rounds")) },
  handler: async (ctx, { roundId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const [user, allActive] = await Promise.all([
      ctx.db.get(userId),
      ctx.db
        .query("rounds")
        .withIndex("by_status", (q) => q.eq("status", "active"))
        .collect(),
    ]);
    if (!user) return null;

    const levelProgress = await computeLevelProgress(ctx, user);
    const myRounds = allActive.filter((r) => r.participantIds.includes(userId));
    const hasAnyActiveRounds = allActive.length > 0;

    const round =
      (roundId ? myRounds.find((r) => r._id === roundId) : null) ??
      myRounds[0] ??
      null;

    if (!round) {
      return {
        user: { _id: user._id, name: user.name, level: user.level, avatarUrl: user.avatarUrl },
        levelProgress,
        myRounds,
        hasAnyActiveRounds,
        selectedRound: null,
        leaderboard: null,
        myEntry: null,
      };
    }

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

    const entries = round.participantIds
      .map((id) => {
        const u = participants.find((p) => p?._id === id);
        const coins = coinsByUser[id] ?? { weightCoins: 0, cardioCoins: 0 };
        return {
          userId: id,
          name: u?.name ?? "Unknown",
          avatarUrl: u?.avatarUrl,
          level: u?.level ?? 1,
          weightCoins: coins.weightCoins,
          cardioCoins: coins.cardioCoins,
          totalCoins: coins.weightCoins + coins.cardioCoins,
          weightTarget: round.targetWeightCoinsPerPerson,
          cardioTarget: round.targetCardioCoinsPerPerson,
        };
      })
      .sort((a, b) => b.totalCoins - a.totalCoins);

    const totalWeightCoins = entries.reduce((s, e) => s + e.weightCoins, 0);
    const totalCardioCoins = entries.reduce((s, e) => s + e.cardioCoins, 0);
    const groupWeightTarget = round.targetWeightCoinsPerPerson * round.participantIds.length;
    const groupCardioTarget = round.targetCardioCoinsPerPerson * round.participantIds.length;

    return {
      user: { _id: user._id, name: user.name, level: user.level, avatarUrl: user.avatarUrl },
      levelProgress,
      myRounds,
      hasAnyActiveRounds,
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
          goalReached:
            totalWeightCoins >= groupWeightTarget &&
            totalCardioCoins >= groupCardioTarget,
        },
      },
      myEntry: entries.find((e) => e.userId === userId) ?? null,
    };
  },
});
