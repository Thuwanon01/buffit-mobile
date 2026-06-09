import { v } from "convex/values";
import { internalAction, internalMutation, action } from "./_generated/server";
import { internal, api } from "./_generated/api";

async function sendLineMessage(groupId: string, accessToken: string, text: string) {
  const response = await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      to: groupId,
      messages: [{ type: "text", text }],
    }),
  });
  if (!response.ok) {
    const err = await response.text();
    console.error("LINE API error:", err);
  }
}

export const notifyCoinEarned = internalAction({
  args: {
    userId: v.id("users"),
    activityName: v.string(),
    coinsEarned: v.float64(),
    coinType: v.string(),
  },
  handler: async (ctx, { userId, activityName, coinsEarned, coinType }) => {
    const settings = await ctx.runQuery(api.adminSettings.getSettings);
    if (!settings?.lineChannelAccessToken || !settings?.lineGroupId) return;

    const user = await ctx.runQuery(api.users.getUserById, { id: userId });
    if (!user) return;

    const emoji = coinType === "weight" ? "💪" : "🏃";
    const coinLabel = coinType === "weight" ? "Weight Coin" : "Cardio Coin";
    const msg = `${emoji} ${user.name} ได้ ${coinsEarned.toFixed(1)} ${coinLabel} จากการทำ ${activityName}!`;

    await sendLineMessage(settings.lineGroupId, settings.lineChannelAccessToken, msg);
  },
});

export const notifyGoalReached = internalAction({
  args: { roundId: v.id("rounds") },
  handler: async (ctx, { roundId }) => {
    const settings = await ctx.runQuery(api.adminSettings.getSettings);
    if (!settings?.lineChannelAccessToken || !settings?.lineGroupId) return;

    const round = await ctx.runQuery(api.rounds.getRoundById, { id: roundId });
    if (!round) return;

    const msg = `🎉🎉🎉 ทีมถึงเป้าหมายแล้ว! Round "${round.name}" ครบแล้ว!\nพร้อมไป ${round.rewardDescription} กัน! 🍲`;
    await sendLineMessage(settings.lineGroupId, settings.lineChannelAccessToken, msg);
  },
});

export const notifyNewRound = internalAction({
  args: { roundId: v.id("rounds") },
  handler: async (ctx, { roundId }) => {
    const settings = await ctx.runQuery(api.adminSettings.getSettings);
    if (!settings?.lineChannelAccessToken || !settings?.lineGroupId) return;

    const round = await ctx.runQuery(api.rounds.getRoundById, { id: roundId });
    if (!round) return;

    const msg = `🚀 Round ใหม่เริ่มแล้ว! "${round.name}"\n🎯 เป้าหมาย: ${round.targetWeightCoinsPerPerson} Weight + ${round.targetCardioCoinsPerPerson} Cardio Coin ต่อคน\n🏆 รางวัล: ${round.rewardDescription}\n\nมาลุยกันเลย! 💪🏃`;
    await sendLineMessage(settings.lineGroupId, settings.lineChannelAccessToken, msg);
  },
});

export const broadcastMessage = action({
  args: { message: v.string() },
  handler: async (ctx, { message }) => {
    const settings = await ctx.runQuery(api.adminSettings.getSettings);
    if (!settings?.lineChannelAccessToken || !settings?.lineGroupId) {
      throw new Error("LINE not configured");
    }
    await sendLineMessage(settings.lineGroupId, settings.lineChannelAccessToken, message);
  },
});

export const sendDailyProgress = internalAction({
  args: {},
  handler: async (ctx) => {
    const settings = await ctx.runQuery(api.adminSettings.getSettings);
    if (!settings?.lineChannelAccessToken || !settings?.lineGroupId) return;

    const activeRounds = await ctx.runQuery(api.rounds.getActiveRounds);
    if (activeRounds.length === 0) return;

    // Pending buffet rights: completed rounds where buffetDate not yet passed
    const allRounds = await ctx.runQuery(api.rounds.getAllRounds);
    const pendingBuffets = allRounds.filter(
      (r) => r.status === "completed" && (!r.buffetDate || r.buffetDate > Date.now())
    );

    for (const activeRound of activeRounds) {
      const leaderboard = await ctx.runQuery(api.coins.getLeaderboard, {
        roundId: activeRound._id,
      });
      if (!leaderboard) continue;

      const { entries, group } = leaderboard;
      const lines = [
        `📊 Daily Progress — "${activeRound.name}"`,
        ``,
        ...entries.map(
          (e, i) =>
            `${i + 1}. ${e.name} (Lv.${e.level}) — 💪${e.weightCoins.toFixed(1)}/${e.weightTarget} | 🏃${e.cardioCoins.toFixed(1)}/${e.cardioTarget}`
        ),
        ``,
        `🏆 ทีม: 💪${group.totalWeightCoins.toFixed(1)}/${group.groupWeightTarget} | 🏃${group.totalCardioCoins.toFixed(1)}/${group.groupCardioTarget}`,
        group.goalReached ? `✅ ถึงเป้าหมายแล้ว!` : `⏳ ยังไม่ถึงเป้า มาลุยกัน!`,
      ];

      if (pendingBuffets.length > 0) {
        lines.push(``, `🍲 ทีมมีสิทธิ์บุฟเฟ่ต์ที่รอใช้ ${pendingBuffets.length} ครั้ง!`);
      }

      await sendLineMessage(settings.lineGroupId, settings.lineChannelAccessToken, lines.join("\n"));
    }
  },
});

export const notifyMilestone = internalAction({
  args: { userId: v.id("users"), newLevel: v.number() },
  handler: async (ctx, { userId, newLevel }) => {
    const settings = await ctx.runQuery(api.adminSettings.getSettings);
    if (!settings?.lineChannelAccessToken || !settings?.lineGroupId) return;

    const user = await ctx.runQuery(api.users.getUserById, { id: userId });
    if (!user) return;

    const msg = `🎉 ${user.name} ขึ้น Level ${newLevel}! 🏆 ยอดเยี่ยมมาก!`;
    await sendLineMessage(settings.lineGroupId, settings.lineChannelAccessToken, msg);
  },
});

