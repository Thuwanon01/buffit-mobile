import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";

export const checkDailyProgressTime = internalAction({
  args: {},
  handler: async (ctx) => {
    const settings = await ctx.runQuery(internal.adminSettings.getSettingsInternal);
    if (!settings?.dailyProgressTime) return;

    const [targetHour, targetMinute] = settings.dailyProgressTime.split(":").map(Number);
    if (!Number.isFinite(targetHour) || !Number.isFinite(targetMinute)) return;
    const now = new Date();
    // Using UTC+7 (Bangkok time)
    const bangkokOffset = 7 * 60;
    const localMinutes = (now.getUTCHours() * 60 + now.getUTCMinutes() + bangkokOffset) % (24 * 60);
    const targetMinutes = targetHour * 60 + targetMinute;

    // The cron fires hourly on the hour, so localMinutes is always a multiple of
    // 60. Fire exactly once per day: in the single hour-block that contains the
    // target time. (The old `diff < 60` window matched TWO consecutive hourly
    // checks for any non-:00 target, sending the report twice.)
    if (targetMinutes >= localMinutes && targetMinutes < localMinutes + 60) {
      await ctx.runAction(internal.line.sendDailyProgress, {});
    }
  },
});
