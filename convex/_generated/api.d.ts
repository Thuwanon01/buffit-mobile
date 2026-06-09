/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as activityTypes from "../activityTypes.js";
import type * as admin from "../admin.js";
import type * as adminSettings from "../adminSettings.js";
import type * as aiCoach from "../aiCoach.js";
import type * as auth from "../auth.js";
import type * as coins from "../coins.js";
import type * as cronHandlers from "../cronHandlers.js";
import type * as crons from "../crons.js";
import type * as dashboard from "../dashboard.js";
import type * as defaultActivities from "../defaultActivities.js";
import type * as http from "../http.js";
import type * as leaderboard from "../leaderboard.js";
import type * as line from "../line.js";
import type * as notifications from "../notifications.js";
import type * as roundContinuation from "../roundContinuation.js";
import type * as rounds from "../rounds.js";
import type * as scoring from "../scoring.js";
import type * as users from "../users.js";
import type * as workoutLogs from "../workoutLogs.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  activityTypes: typeof activityTypes;
  admin: typeof admin;
  adminSettings: typeof adminSettings;
  aiCoach: typeof aiCoach;
  auth: typeof auth;
  coins: typeof coins;
  cronHandlers: typeof cronHandlers;
  crons: typeof crons;
  dashboard: typeof dashboard;
  defaultActivities: typeof defaultActivities;
  http: typeof http;
  leaderboard: typeof leaderboard;
  line: typeof line;
  notifications: typeof notifications;
  roundContinuation: typeof roundContinuation;
  rounds: typeof rounds;
  scoring: typeof scoring;
  users: typeof users;
  workoutLogs: typeof workoutLogs;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
