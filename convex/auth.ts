import { convexAuth } from "@convex-dev/auth/server";
import Google from "@auth/core/providers/google";
import { Password } from "@convex-dev/auth/providers/Password";
import { MutationCtx } from "./_generated/server";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [Google, Password],
  callbacks: {
    async redirect({ redirectTo }: { redirectTo: string }) {
      const siteUrl = (process.env.SITE_URL ?? "").replace(/\/$/, "");
      if (redirectTo.startsWith("?") || redirectTo.startsWith("/")) {
        return `${siteUrl}${redirectTo}`;
      }
      if (redirectTo.startsWith(siteUrl)) {
        return redirectTo;
      }
      // Allow React Native / Expo custom schemes
      if (redirectTo.startsWith("exp://") || redirectTo.startsWith("buffit://")) {
        return redirectTo;
      }
      throw new Error(
        `Invalid \`redirectTo\` ${redirectTo} for configured SITE_URL: ${siteUrl}`
      );
    },
    async createOrUpdateUser(ctx: MutationCtx, args) {
      const { existingUserId, profile } = args;
      if (existingUserId) {
        return existingUserId;
      }
      return ctx.db.insert("users", {
        userId: (profile.subject as string | undefined) ?? (profile.email as string | undefined) ?? "",
        name: (profile.name as string) ?? (profile.email as string) ?? "Unknown",
        email: (profile.email as string) ?? "",
        avatarUrl: profile.picture as string | undefined,
        level: 1,
        lifetimeWeightCoins: 0,
        lifetimeCardioCoins: 0,
        isAdmin: false,
        profileCompleted: false,
      });
    },
  },
});
