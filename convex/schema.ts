import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

export default defineSchema({
  ...authTables,

  users: defineTable({
    // Auth linkage
    userId: v.string(), // Convex Auth user id

    // Profile
    name: v.string(),
    email: v.string(),
    avatarUrl: v.optional(v.string()),

    // Fitness profile (for AI personalization)
    age: v.optional(v.number()),
    gender: v.optional(v.string()),
    weightKg: v.optional(v.number()),
    heightCm: v.optional(v.number()),
    fitnessLevel: v.optional(v.string()), // beginner | intermediate | advanced
    weeklyFrequency: v.optional(v.number()), // days/week
    goals: v.optional(v.array(v.string())), // weight_loss | muscle_gain | health
    medicalConditions: v.optional(v.string()),
    physicalLimitations: v.optional(v.string()),

    // Level system
    level: v.number(), // 1, 2, 3, ...
    lifetimeWeightCoins: v.float64(),
    lifetimeCardioCoins: v.float64(),

    // Admin
    isAdmin: v.boolean(),

    // LINE
    lineUserId: v.optional(v.string()),

    profileCompleted: v.boolean(),
    hasSeenTutorial: v.optional(v.boolean()),
  })
    .index("by_userId", ["userId"])
    .index("email", ["email"]),

  rounds: defineTable({
    name: v.string(),
    rewardDescription: v.string(), // e.g. "ชาบู MK สาขา ลาดพร้าว"
    participantIds: v.array(v.id("users")),
    pendingParticipantIds: v.optional(v.array(v.id("users"))),
    targetWeightCoinsPerPerson: v.float64(),
    targetCardioCoinsPerPerson: v.float64(),
    status: v.string(), // active | completed
    buffetDate: v.optional(v.number()), // timestamp
    createdBy: v.id("users"),
    goalReachedAt: v.optional(v.number()), // timestamp when group target was first hit
  }).index("by_status", ["status"]),

  activityTypes: defineTable({
    name: v.string(),
    nameEn: v.optional(v.string()), // English name, used for cross-language matching in auto-log
    category: v.string(), // weight | cardio
    // criteria per level: [{level: 1, metric: "reps", value: 50, unit: "reps"}, ...]
    criteriaPerLevel: v.array(
      v.object({
        level: v.number(),
        metric: v.string(), // reps | km | minutes | steps
        value: v.float64(),
        unit: v.string(),
      })
    ),
    weightMultiplier: v.float64(), // approved multiplier (default 1.0)
    proposedBy: v.id("users"),
    approvedBy: v.optional(v.id("users")),
    status: v.string(), // pending | approved | rejected
  })
    .index("by_status", ["status"])
    .index("by_category", ["category"]),

  workoutLogs: defineTable({
    userId: v.id("users"),
    roundId: v.id("rounds"),
    activityTypeId: v.id("activityTypes"),
    date: v.number(), // timestamp
    metrics: v.object({
      value: v.float64(),
      unit: v.string(),
    }),
    note: v.optional(v.string()),
    coinsEarned: v.float64(), // after multiplier applied
    coinType: v.string(), // weight | cardio
    userLevelAtTime: v.number(),
    status: v.string(), // auto_approved | revoked
    revokedBy: v.optional(v.id("users")),
    revokedAt: v.optional(v.number()),
    revokeReason: v.optional(v.string()),
  })
    .index("by_userId", ["userId"])
    .index("by_roundId", ["roundId"])
    .index("by_userId_roundId", ["userId", "roundId"])
    .index("by_date", ["date"]),

  adminSettings: defineTable({
    dailyProgressTime: v.string(), // "20:00"
    lineChannelAccessToken: v.optional(v.string()),
    lineGroupId: v.optional(v.string()),
  }),

  levelThresholds: defineTable({
    level: v.number(),
    minLifetimeCoins: v.float64(), // global default; used until AI generates personal thresholds
  }).index("by_level", ["level"]),

  userLevelThresholds: defineTable({
    userId: v.id("users"),
    level: v.number(),
    minLifetimeCoins: v.float64(), // AI-generated, personalized per user
  }).index("by_userId", ["userId"]),

  notifications: defineTable({
    type: v.union(
      v.literal("daily_summary"),
      v.literal("goal_reached"),
      v.literal("reminder"),
      v.literal("broadcast"),
      v.literal("milestone")
    ),
    message: v.string(),
    sentAt: v.number(),
    sentBy: v.optional(v.id("users")),       // broadcast: admin who sent it
    relatedUserId: v.optional(v.id("users")), // milestone: user who leveled up
    relatedRoundId: v.optional(v.id("rounds")), // goal_reached: the completed round
  }).index("by_sentAt", ["sentAt"]),
});
