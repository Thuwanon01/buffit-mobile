import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";
import { findCriteriaForLevel, calculateCoinsEarned, applyCoinDelta } from "./scoring";

export const logWorkout = mutation({
  args: {
    roundId: v.id("rounds"),
    activityTypeId: v.id("activityTypes"),
    date: v.number(),
    metrics: v.object({ value: v.float64(), unit: v.string() }),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const user = await ctx.db.get(userId);
    if (!user) throw new Error("User not found");

    const activity = await ctx.db.get(args.activityTypeId);
    if (!activity || activity.status !== "approved") throw new Error("Activity not approved");

    const round = await ctx.db.get(args.roundId);
    if (!round || round.status !== "active") throw new Error("Round not active");
    if (!round.participantIds.includes(user._id)) throw new Error("Not a participant");

    const criteria = findCriteriaForLevel(activity.criteriaPerLevel, user.level);
    const coinsEarned = calculateCoinsEarned(args.metrics.value, criteria.value, activity.weightMultiplier);

    const logId = await ctx.db.insert("workoutLogs", {
      userId: user._id,
      roundId: args.roundId,
      activityTypeId: args.activityTypeId,
      date: args.date,
      metrics: args.metrics,
      note: args.note,
      coinsEarned,
      coinType: activity.category,
      userLevelAtTime: user.level,
      status: "auto_approved",
    });

    // Update user lifetime coins
    const coinField = activity.category === "weight" ? "lifetimeWeightCoins" : "lifetimeCardioCoins";
    await ctx.db.patch(user._id, {
      [coinField]: (user[coinField] ?? 0) + coinsEarned,
    });

    // Update level
    await ctx.scheduler.runAfter(0, internal.users.updateLevel, { userId: user._id });

    // Check if group target reached
    await ctx.scheduler.runAfter(0, internal.coins.checkGroupTarget, { roundId: args.roundId });

    // Send LINE notification
    await ctx.scheduler.runAfter(0, internal.line.notifyCoinEarned, {
      userId: user._id,
      activityName: activity.name,
      coinsEarned,
      coinType: activity.category,
    });

    return logId;
  },
});

export const confirmAutoLog = mutation({
  args: {
    roundId: v.id("rounds"),
    entries: v.array(
      v.object({
        rawText: v.string(),
        value: v.float64(),
        unit: v.string(),
        activityRef: v.union(
          v.object({
            kind: v.literal("existing"),
            activityId: v.id("activityTypes"),
          }),
          v.object({
            kind: v.literal("new"),
            name: v.string(),
            nameEn: v.string(),
            category: v.string(),
            criteriaPerLevel: v.array(
              v.object({ level: v.number(), metric: v.string(), value: v.float64(), unit: v.string() })
            ),
            weightMultiplier: v.float64(),
            rationale: v.string(),
          })
        ),
      })
    ),
  },
  handler: async (ctx, { roundId, entries }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const user = await ctx.db.get(userId);
    if (!user) throw new Error("User not found");

    const round = await ctx.db.get(roundId);
    if (!round || round.status !== "active") throw new Error("Round not active");
    if (!round.participantIds.includes(user._id)) throw new Error("Not a participant");

    const approvedActivities = await ctx.db
      .query("activityTypes")
      .withIndex("by_status", (q) => q.eq("status", "approved"))
      .collect();
    const byId = new Map(approvedActivities.map((a) => [a._id as string, a]));
    const byName = new Map(approvedActivities.map((a) => [a.name, a]));

    const logged: { name: string; value: number; unit: string; coinsEarned: number; coinType: string }[] = [];
    const skipped: { name: string; value: number; unit: string; reason: string }[] = [];
    const createdActivities: string[] = [];
    let weightCoinDelta = 0;
    let cardioCoinDelta = 0;

    for (const entry of entries) {
      let activity = entry.activityRef.kind === "existing"
        ? byId.get(entry.activityRef.activityId as string)
        : byName.get(entry.activityRef.name);

      if (!activity && entry.activityRef.kind === "new") {
        const spec = entry.activityRef;
        const newId = await ctx.db.insert("activityTypes", {
          name: spec.name,
          nameEn: spec.nameEn,
          category: spec.category,
          criteriaPerLevel: spec.criteriaPerLevel,
          weightMultiplier: Math.max(0.5, Math.min(2.0, spec.weightMultiplier)),
          proposedBy: user._id,
          approvedBy: user._id,
          status: "approved",
        });
        activity = (await ctx.db.get(newId))!;
        byId.set(activity._id as string, activity);
        byName.set(activity.name, activity);
        createdActivities.push(activity.name);
      }

      if (!activity || activity.status !== "approved") {
        skipped.push({ name: entry.rawText, value: entry.value, unit: entry.unit, reason: "ไม่พบกิจกรรมนี้ในระบบ" });
        continue;
      }

      const criteria = findCriteriaForLevel(activity.criteriaPerLevel, user.level);
      const coinsEarned = calculateCoinsEarned(entry.value, criteria.value, activity.weightMultiplier);
      await ctx.db.insert("workoutLogs", {
        userId: user._id,
        roundId,
        activityTypeId: activity._id,
        date: Date.now(),
        metrics: { value: entry.value, unit: entry.unit },
        coinsEarned,
        coinType: activity.category,
        userLevelAtTime: user.level,
        status: "auto_approved",
      });

      if (activity.category === "weight") weightCoinDelta += coinsEarned;
      else cardioCoinDelta += coinsEarned;

      logged.push({ name: activity.name, value: entry.value, unit: entry.unit, coinsEarned, coinType: activity.category });

      await ctx.scheduler.runAfter(0, internal.line.notifyCoinEarned, {
        userId: user._id,
        activityName: activity.name,
        coinsEarned,
        coinType: activity.category,
      });
    }

    if (weightCoinDelta > 0 || cardioCoinDelta > 0) {
      await ctx.db.patch(user._id, {
        lifetimeWeightCoins: (user.lifetimeWeightCoins ?? 0) + weightCoinDelta,
        lifetimeCardioCoins: (user.lifetimeCardioCoins ?? 0) + cardioCoinDelta,
      });
      await ctx.scheduler.runAfter(0, internal.users.updateLevel, { userId: user._id });
      await ctx.scheduler.runAfter(0, internal.coins.checkGroupTarget, { roundId });
    }

    return { logged, skipped, createdActivities };
  },
});

export const revokeLog = mutation({
  args: { logId: v.id("workoutLogs"), reason: v.optional(v.string()) },
  handler: async (ctx, { logId, reason }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const admin = await ctx.db.get(userId);
    if (!admin?.isAdmin) throw new Error("Not authorized");

    const log = await ctx.db.get(logId);
    if (!log || log.status === "revoked") throw new Error("Already revoked");

    await ctx.db.patch(logId, {
      status: "revoked",
      revokedBy: admin._id,
      revokedAt: Date.now(),
      revokeReason: reason,
    });

    // Subtract coins from user
    const user = await ctx.db.get(log.userId);
    if (user) {
      const coinField = log.coinType === "weight" ? "lifetimeWeightCoins" : "lifetimeCardioCoins";
      await ctx.db.patch(user._id, {
        [coinField]: applyCoinDelta(user[coinField] ?? 0, -log.coinsEarned),
      });
      await ctx.scheduler.runAfter(0, internal.users.updateLevel, { userId: user._id });
    }
  },
});

export const getLogsForRound = query({
  args: { roundId: v.id("rounds") },
  handler: async (ctx, { roundId }) => {
    return ctx.db
      .query("workoutLogs")
      .withIndex("by_roundId", (q) => q.eq("roundId", roundId))
      .filter((q) => q.eq(q.field("status"), "auto_approved"))
      .order("desc")
      .collect();
  },
});

export const getMyLogsForRound = query({
  args: { roundId: v.id("rounds") },
  handler: async (ctx, { roundId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const user = await ctx.db.get(userId);
    if (!user) return [];
    return ctx.db
      .query("workoutLogs")
      .withIndex("by_userId_roundId", (q) =>
        q.eq("userId", user._id).eq("roundId", roundId)
      )
      .filter((q) => q.eq(q.field("status"), "auto_approved"))
      .order("desc")
      .collect();
  },
});

export const getAllLogsForAdmin = query({
  args: { roundId: v.id("rounds") },
  handler: async (ctx, { roundId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const user = await ctx.db.get(userId);
    if (!user?.isAdmin) return [];
    return ctx.db
      .query("workoutLogs")
      .withIndex("by_roundId", (q) => q.eq("roundId", roundId))
      .order("desc")
      .collect();
  },
});


export const getHistoryFeedData = query({
  args: { roundId: v.optional(v.id("rounds")) },
  handler: async (ctx, { roundId }) => {
    const [allRounds, activities, users] = await Promise.all([
      ctx.db.query("rounds").order("desc").collect(),
      ctx.db.query("activityTypes")
        .withIndex("by_status", (q) => q.eq("status", "approved"))
        .collect(),
      ctx.db.query("users").collect(),
    ]);

    const selectedRound =
      (roundId ? allRounds.find((r) => r._id === roundId) : null) ??
      allRounds.find((r) => r.status === "active") ??
      allRounds[0] ??
      null;

    if (!selectedRound) return { rounds: allRounds, selectedRound: null, logs: [], activities, users };

    const logs = await ctx.db
      .query("workoutLogs")
      .withIndex("by_roundId", (q) => q.eq("roundId", selectedRound._id))
      .filter((q) => q.eq(q.field("status"), "auto_approved"))
      .order("desc")
      .collect();

    return { rounds: allRounds, selectedRound, logs, activities, users };
  },
});

export const getProgressData = query({
  args: {},
  handler: async (ctx) => {
    const rounds = await ctx.db.query("rounds").order("asc").collect();
    const allLogs = await ctx.db
      .query("workoutLogs")
      .filter((q) => q.eq(q.field("status"), "auto_approved"))
      .collect();
    const users = await ctx.db.query("users").collect();

    const map = new Map<string, { userId: string; roundId: string; weightCoins: number; cardioCoins: number }>();
    for (const log of allLogs) {
      const key = `${log.userId}__${log.roundId}`;
      if (!map.has(key)) {
        map.set(key, { userId: String(log.userId), roundId: String(log.roundId), weightCoins: 0, cardioCoins: 0 });
      }
      const entry = map.get(key)!;
      if (log.coinType === "weight") entry.weightCoins += log.coinsEarned;
      else entry.cardioCoins += log.coinsEarned;
    }

    return {
      rounds: rounds.map((r) => ({
        _id: r._id,
        name: r.name,
        status: r.status,
        _creationTime: r._creationTime,
        goalReachedAt: r.goalReachedAt,
      })),
      users: users.map((u) => ({ _id: u._id, name: u.name })),
      entries: Array.from(map.values()),
    };
  },
});
