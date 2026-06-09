/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { buildNextParticipants } from "./roundContinuation";
import { Id } from "./_generated/dataModel";

const modules = import.meta.glob("./**/*.ts");

// ─── Pure function tests ──────────────────────────────────────────────────────

describe("buildNextParticipants", () => {
  // Using string cast to simulate Id<"users"> in a pure-function test
  const a = "a" as unknown as Id<"users">;
  const b = "b" as unknown as Id<"users">;
  const c = "c" as unknown as Id<"users">;

  test("appends pending participants not already in current list", () => {
    expect(buildNextParticipants([a, b], [c])).toEqual([a, b, c]);
  });

  test("deduplicates pending participants already in current list", () => {
    expect(buildNextParticipants([a, b], [b, c])).toEqual([a, b, c]);
  });

  test("returns current list unchanged when no pending", () => {
    expect(buildNextParticipants([a, b], [])).toEqual([a, b]);
  });

  test("handles empty current list with pending participants", () => {
    expect(buildNextParticipants([], [a, b])).toEqual([a, b]);
  });
});

// ─── Integration tests via checkGroupTarget ───────────────────────────────────

async function setupRoundWithParticipants(t: ReturnType<typeof convexTest>) {
  const adminId = await t.run(async (ctx) => {
    return ctx.db.insert("users", {
      userId: "admin-id",
      name: "Admin",
      email: "admin@test.com",
      level: 1,
      lifetimeWeightCoins: 0,
      lifetimeCardioCoins: 0,
      isAdmin: true,
      profileCompleted: true,
    });
  });

  const p1Id = await t.run(async (ctx) => {
    return ctx.db.insert("users", {
      userId: "p1-id",
      name: "P1",
      email: "p1@test.com",
      level: 1,
      lifetimeWeightCoins: 0,
      lifetimeCardioCoins: 0,
      isAdmin: false,
      profileCompleted: true,
    });
  });

  const p2Id = await t.run(async (ctx) => {
    return ctx.db.insert("users", {
      userId: "p2-id",
      name: "P2",
      email: "p2@test.com",
      level: 1,
      lifetimeWeightCoins: 0,
      lifetimeCardioCoins: 0,
      isAdmin: false,
      profileCompleted: true,
    });
  });

  const pendingId = await t.run(async (ctx) => {
    return ctx.db.insert("users", {
      userId: "pending-id",
      name: "Pending",
      email: "pending@test.com",
      level: 1,
      lifetimeWeightCoins: 0,
      lifetimeCardioCoins: 0,
      isAdmin: false,
      profileCompleted: true,
    });
  });

  const roundId = await t.run(async (ctx) => {
    return ctx.db.insert("rounds", {
      name: "Round 1",
      rewardDescription: "ชาบู MK",
      participantIds: [p1Id, p2Id],
      pendingParticipantIds: [pendingId],
      targetWeightCoinsPerPerson: 5,
      targetCardioCoinsPerPerson: 5,
      status: "active",
      createdBy: adminId,
    });
  });

  return { adminId, p1Id, p2Id, pendingId, roundId };
}

describe("checkGroupTarget → continueRound (integration)", () => {
  test("tracer bullet: creates next round when both weight and cardio goals are met", async () => {
    const t = convexTest(schema, modules);
    const { p1Id, p2Id, roundId } = await setupRoundWithParticipants(t);

    const activityId = await t.run(async (ctx) => {
      return ctx.db.insert("activityTypes", {
        name: "วิ่ง",
        category: "cardio",
        criteriaPerLevel: [{ level: 1, metric: "km", value: 3, unit: "km" }],
        weightMultiplier: 1.0,
        proposedBy: p1Id,
        status: "approved",
      });
    });

    // Seed logs that meet the group target: 5 weight + 5 cardio each × 2 participants
    await t.run(async (ctx) => {
      for (const userId of [p1Id, p2Id]) {
        await ctx.db.insert("workoutLogs", {
          userId,
          roundId,
          activityTypeId: activityId,
          date: Date.now(),
          metrics: { value: 15, unit: "km" },
          coinsEarned: 5,
          coinType: "weight",
          userLevelAtTime: 1,
          status: "auto_approved",
        });
        await ctx.db.insert("workoutLogs", {
          userId,
          roundId,
          activityTypeId: activityId,
          date: Date.now(),
          metrics: { value: 15, unit: "km" },
          coinsEarned: 5,
          coinType: "cardio",
          userLevelAtTime: 1,
          status: "auto_approved",
        });
      }
    });

    await t.mutation(internal.coins.checkGroupTarget, { roundId });

    // Old round should be completed
    const completedRound = await t.run((ctx) => ctx.db.get(roundId));
    expect(completedRound!.status).toBe("completed");
    expect(completedRound!.goalReachedAt).toBeDefined();

    // New active round should exist
    const allRounds = await t.run((ctx) => ctx.db.query("rounds").collect());
    const nextRound = allRounds.find((r) => r.status === "active");
    expect(nextRound).toBeDefined();
    expect(nextRound!.name).toBe("Round 1");
    expect(nextRound!.rewardDescription).toBe("ชาบู MK");
    expect(nextRound!.targetWeightCoinsPerPerson).toBe(5);
    expect(nextRound!.targetCardioCoinsPerPerson).toBe(5);
  });

  test("pending participants are carried forward into next round", async () => {
    const t = convexTest(schema, modules);
    const { p1Id, p2Id, pendingId, roundId } = await setupRoundWithParticipants(t);

    const activityId = await t.run(async (ctx) => {
      return ctx.db.insert("activityTypes", {
        name: "วิ่ง",
        category: "cardio",
        criteriaPerLevel: [{ level: 1, metric: "km", value: 3, unit: "km" }],
        weightMultiplier: 1.0,
        proposedBy: p1Id,
        status: "approved",
      });
    });

    await t.run(async (ctx) => {
      for (const userId of [p1Id, p2Id]) {
        for (const coinType of ["weight", "cardio"] as const) {
          await ctx.db.insert("workoutLogs", {
            userId,
            roundId,
            activityTypeId: activityId,
            date: Date.now(),
            metrics: { value: 15, unit: "km" },
            coinsEarned: 5,
            coinType,
            userLevelAtTime: 1,
            status: "auto_approved",
          });
        }
      }
    });

    await t.mutation(internal.coins.checkGroupTarget, { roundId });

    const allRounds = await t.run((ctx) => ctx.db.query("rounds").collect());
    const nextRound = allRounds.find((r) => r.status === "active")!;

    // pending participant should now be a full participant in the next round
    expect(nextRound.participantIds.map(String)).toContain(String(pendingId));
    expect(nextRound.pendingParticipantIds).toEqual([]);
  });

  test("does nothing when only weight goal is met (cardio short)", async () => {
    const t = convexTest(schema, modules);
    const { p1Id, p2Id, roundId } = await setupRoundWithParticipants(t);

    const activityId = await t.run(async (ctx) => {
      return ctx.db.insert("activityTypes", {
        name: "ดัมเบล",
        category: "weight",
        criteriaPerLevel: [{ level: 1, metric: "reps", value: 10, unit: "reps" }],
        weightMultiplier: 1.0,
        proposedBy: p1Id,
        status: "approved",
      });
    });

    // Only weight logs — cardio target not met
    await t.run(async (ctx) => {
      for (const userId of [p1Id, p2Id]) {
        await ctx.db.insert("workoutLogs", {
          userId,
          roundId,
          activityTypeId: activityId,
          date: Date.now(),
          metrics: { value: 50, unit: "reps" },
          coinsEarned: 5,
          coinType: "weight",
          userLevelAtTime: 1,
          status: "auto_approved",
        });
      }
    });

    await t.mutation(internal.coins.checkGroupTarget, { roundId });

    const round = await t.run((ctx) => ctx.db.get(roundId));
    expect(round!.status).toBe("active");
    expect(round!.goalReachedAt).toBeUndefined();

    const allRounds = await t.run((ctx) => ctx.db.query("rounds").collect());
    expect(allRounds).toHaveLength(1);
  });

  test("is idempotent — second call on completed round does nothing", async () => {
    const t = convexTest(schema, modules);
    const { p1Id, p2Id, roundId } = await setupRoundWithParticipants(t);

    const activityId = await t.run(async (ctx) => {
      return ctx.db.insert("activityTypes", {
        name: "วิ่ง",
        category: "cardio",
        criteriaPerLevel: [{ level: 1, metric: "km", value: 3, unit: "km" }],
        weightMultiplier: 1.0,
        proposedBy: p1Id,
        status: "approved",
      });
    });

    await t.run(async (ctx) => {
      for (const userId of [p1Id, p2Id]) {
        for (const coinType of ["weight", "cardio"] as const) {
          await ctx.db.insert("workoutLogs", {
            userId,
            roundId,
            activityTypeId: activityId,
            date: Date.now(),
            metrics: { value: 15, unit: "km" },
            coinsEarned: 5,
            coinType,
            userLevelAtTime: 1,
            status: "auto_approved",
          });
        }
      }
    });

    await t.mutation(internal.coins.checkGroupTarget, { roundId });
    // Second call — round is already completed, should be a no-op
    await t.mutation(internal.coins.checkGroupTarget, { roundId });

    const allRounds = await t.run((ctx) => ctx.db.query("rounds").collect());
    expect(allRounds).toHaveLength(2); // exactly 1 continuation, not 2
  });
});
