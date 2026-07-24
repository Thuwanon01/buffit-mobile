import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import { MutationCtx, QueryCtx } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

async function requireAuth(ctx: QueryCtx | MutationCtx) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Not authenticated");
  const user = await ctx.db.get(userId);
  if (!user) throw new Error("User not found");
  return user;
}

async function requireGroupMember(
  ctx: QueryCtx | MutationCtx,
  groupId: Id<"groups">,
  userId: Id<"users">
) {
  const membership = await ctx.db
    .query("groupMembers")
    .withIndex("by_groupId_and_userId", (q) =>
      q.eq("groupId", groupId).eq("userId", userId)
    )
    .unique();
  if (!membership) throw new Error("Not a group member");
  return membership;
}

async function requireGroupOwner(
  ctx: QueryCtx | MutationCtx,
  groupId: Id<"groups">,
  userId: Id<"users">
) {
  const membership = await requireGroupMember(ctx, groupId, userId);
  if (membership.role !== "owner") throw new Error("Only the group owner can do this");
  return membership;
}

function generateCode(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

export const createGroup = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    const groupId = await ctx.db.insert("groups", {
      name: args.name,
      description: args.description,
      createdBy: user._id,
      createdAt: Date.now(),
    });
    await ctx.db.insert("groupMembers", {
      groupId,
      userId: user._id,
      role: "owner",
      joinedAt: Date.now(),
    });
    return groupId;
  },
});

export const getMyGroups = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireAuth(ctx);
    const memberships = await ctx.db
      .query("groupMembers")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect();
    const groups = await Promise.all(
      memberships.map(async (m) => {
        const group = await ctx.db.get(m.groupId);
        if (!group) return null;
        const memberCount = await ctx.db
          .query("groupMembers")
          .withIndex("by_groupId", (q) => q.eq("groupId", m.groupId))
          .collect();
        return { ...group, role: m.role, memberCount: memberCount.length };
      })
    );
    return groups.filter(Boolean);
  },
});

export const getGroupById = query({
  args: { groupId: v.id("groups") },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    await requireGroupMember(ctx, args.groupId, user._id);
    const group = await ctx.db.get(args.groupId);
    if (!group) return null;
    const memberships = await ctx.db
      .query("groupMembers")
      .withIndex("by_groupId", (q) => q.eq("groupId", args.groupId))
      .collect();
    const members = await Promise.all(
      memberships.map(async (m) => {
        const u = await ctx.db.get(m.userId);
        if (!u) return null;
        return { _id: u._id, name: u.name, avatarUrl: u.avatarUrl, role: m.role };
      })
    );
    return { ...group, members: members.filter(Boolean) };
  },
});

export const generateInviteCode = mutation({
  args: { groupId: v.id("groups") },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    await requireGroupMember(ctx, args.groupId, user._id);
    const code = generateCode();
    await ctx.db.insert("groupInvites", {
      groupId: args.groupId,
      type: "link",
      code,
      createdBy: user._id,
      createdAt: Date.now(),
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
      status: "pending",
    });
    return code;
  },
});

export const getInviteByCode = query({
  args: { code: v.string() },
  handler: async (ctx, args) => {
    const invite = await ctx.db
      .query("groupInvites")
      .withIndex("by_code", (q) => q.eq("code", args.code))
      .unique();
    if (!invite || invite.status !== "pending") return null;
    if (invite.expiresAt && invite.expiresAt < Date.now()) return null;
    const group = await ctx.db.get(invite.groupId);
    return group ? { inviteId: invite._id, groupId: invite.groupId, groupName: group.name } : null;
  },
});

export const joinByInviteCode = mutation({
  args: { code: v.string() },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    const invite = await ctx.db
      .query("groupInvites")
      .withIndex("by_code", (q) => q.eq("code", args.code))
      .unique();
    if (!invite || invite.status !== "pending") throw new Error("Invalid or expired invite");
    if (invite.expiresAt && invite.expiresAt < Date.now()) throw new Error("Invite has expired");

    const existing = await ctx.db
      .query("groupMembers")
      .withIndex("by_groupId_and_userId", (q) =>
        q.eq("groupId", invite.groupId).eq("userId", user._id)
      )
      .unique();
    if (existing) return invite.groupId; // already a member

    await ctx.db.insert("groupMembers", {
      groupId: invite.groupId,
      userId: user._id,
      role: "member",
      joinedAt: Date.now(),
    });
    return invite.groupId;
  },
});

export const searchUsersToInvite = query({
  args: { groupId: v.id("groups"), query: v.string() },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    await requireGroupMember(ctx, args.groupId, user._id);

    const currentMembers = await ctx.db
      .query("groupMembers")
      .withIndex("by_groupId", (q) => q.eq("groupId", args.groupId))
      .collect();
    const memberIds = new Set(currentMembers.map((m) => m.userId));

    const q = args.query.toLowerCase();
    const allUsers = await ctx.db.query("users").take(200);
    return allUsers
      .filter(
        (u) =>
          !memberIds.has(u._id) &&
          u._id !== user._id &&
          (u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
      )
      .slice(0, 10)
      // Do not leak email: any group member could otherwise enumerate every
      // user's email via substring search. Match on email but return only
      // non-sensitive fields.
      .map((u) => ({ _id: u._id, name: u.name, avatarUrl: u.avatarUrl }));
  },
});

export const sendDirectInvite = mutation({
  args: { groupId: v.id("groups"), targetUserId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    await requireGroupMember(ctx, args.groupId, user._id);

    const existing = await ctx.db
      .query("groupMembers")
      .withIndex("by_groupId_and_userId", (q) =>
        q.eq("groupId", args.groupId).eq("userId", args.targetUserId)
      )
      .unique();
    if (existing) throw new Error("User is already a member");

    const pendingInvite = await ctx.db
      .query("groupInvites")
      .withIndex("by_targetUserId", (q) => q.eq("targetUserId", args.targetUserId))
      .filter((q) =>
        q.and(q.eq(q.field("groupId"), args.groupId), q.eq(q.field("status"), "pending"))
      )
      .unique();
    if (pendingInvite) throw new Error("Invite already sent");

    await ctx.db.insert("groupInvites", {
      groupId: args.groupId,
      type: "direct",
      targetUserId: args.targetUserId,
      createdBy: user._id,
      createdAt: Date.now(),
      status: "pending",
    });
  },
});

export const getMyPendingInvites = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireAuth(ctx);
    const invites = await ctx.db
      .query("groupInvites")
      .withIndex("by_targetUserId", (q) => q.eq("targetUserId", user._id))
      .filter((q) => q.eq(q.field("status"), "pending"))
      .take(50);
    return Promise.all(
      invites.map(async (inv) => {
        const group = await ctx.db.get(inv.groupId);
        const inviter = await ctx.db.get(inv.createdBy);
        return {
          inviteId: inv._id,
          groupId: inv.groupId,
          groupName: group?.name ?? "Unknown Group",
          inviterName: inviter?.name ?? "Someone",
        };
      })
    );
  },
});

export const respondToInvite = mutation({
  args: { inviteId: v.id("groupInvites"), accept: v.boolean() },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    const invite = await ctx.db.get(args.inviteId);
    if (!invite || invite.targetUserId !== user._id) throw new Error("Invite not found");
    if (invite.status !== "pending") throw new Error("Invite already responded to");

    await ctx.db.patch(args.inviteId, {
      status: args.accept ? "accepted" : "declined",
    });

    if (args.accept) {
      await ctx.db.insert("groupMembers", {
        groupId: invite.groupId,
        userId: user._id,
        role: "member",
        joinedAt: Date.now(),
      });
    }
    return invite.groupId;
  },
});

export const leaveGroup = mutation({
  args: { groupId: v.id("groups") },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    const membership = await requireGroupMember(ctx, args.groupId, user._id);
    if (membership.role === "owner") {
      const otherMembers = await ctx.db
        .query("groupMembers")
        .withIndex("by_groupId", (q) => q.eq("groupId", args.groupId))
        .filter((q) => q.neq(q.field("userId"), user._id))
        .take(1);
      if (otherMembers.length > 0) throw new Error("Transfer ownership before leaving");
    }
    await ctx.db.delete(membership._id);
  },
});

export const removeMember = mutation({
  args: { groupId: v.id("groups"), memberId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    await requireGroupOwner(ctx, args.groupId, user._id);
    if (args.memberId === user._id) throw new Error("Cannot remove yourself");
    const membership = await ctx.db
      .query("groupMembers")
      .withIndex("by_groupId_and_userId", (q) =>
        q.eq("groupId", args.groupId).eq("userId", args.memberId)
      )
      .unique();
    if (!membership) throw new Error("Member not found");
    await ctx.db.delete(membership._id);
  },
});

// Migration: wrap all existing rounds in a "Legacy" group
export const migrateLegacyRounds = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Check if already migrated
    const already = await ctx.db
      .query("groups")
      .filter((q) => q.eq(q.field("name"), "Legacy Group"))
      .take(1);
    if (already.length > 0) return { skipped: true };

    // Find a user to be owner (first admin, fallback to first user)
    const admin = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("isAdmin"), true))
      .take(1);
    const allUsers = await ctx.db.query("users").take(200);
    if (allUsers.length === 0) return { skipped: true };

    const ownerId = admin.length > 0 ? admin[0]._id : allUsers[0]._id;

    const groupId = await ctx.db.insert("groups", {
      name: "Legacy Group",
      description: "กลุ่มเดิมก่อนระบบกรุ๊ป",
      createdBy: ownerId,
      createdAt: Date.now(),
    });

    // Add all existing users as members
    for (const u of allUsers) {
      await ctx.db.insert("groupMembers", {
        groupId,
        userId: u._id,
        role: u._id === ownerId ? "owner" : "member",
        joinedAt: Date.now(),
      });
    }

    // Assign all existing rounds to this group
    const rounds = await ctx.db.query("rounds").take(200);
    for (const round of rounds) {
      if (!round.groupId) {
        await ctx.db.patch(round._id, { groupId });
      }
    }

    return { groupId, membersAdded: allUsers.length, roundsMigrated: rounds.length };
  },
});
