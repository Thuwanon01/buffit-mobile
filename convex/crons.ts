import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Daily progress summary — actual send time controlled by admin settings (dailyProgressTime)
// We run a check every hour and let the action decide if it's time
crons.hourly("daily-progress-check", { minuteUTC: 0 }, internal.cronHandlers.checkDailyProgressTime);

export default crons;
