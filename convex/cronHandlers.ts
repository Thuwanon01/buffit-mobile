import { internalAction } from "./_generated/server";
import { internal, api } from "./_generated/api";

export const checkDailyProgressTime = internalAction({
  args: {},
  handler: async (ctx) => {
    const settings = await ctx.runQuery(api.adminSettings.getSettings);
    if (!settings?.dailyProgressTime) return;

    const [targetHour, targetMinute] = settings.dailyProgressTime.split(":").map(Number);
    const now = new Date();
    // Using UTC+7 (Bangkok time)
    const bangkokOffset = 7 * 60;
    const localMinutes = (now.getUTCHours() * 60 + now.getUTCMinutes() + bangkokOffset) % (24 * 60);
    const targetMinutes = targetHour * 60 + targetMinute;

    // Fire within a 60-minute window of target time (handles midnight wrap-around)
    const diff = Math.min(
      Math.abs(localMinutes - targetMinutes),
      1440 - Math.abs(localMinutes - targetMinutes)
    );
    if (diff < 60) {
      await ctx.runAction(internal.line.sendDailyProgress, {});
    }
  },
});
