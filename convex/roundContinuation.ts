import { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";

// Merges pending participants into the next round's participant list,
// deduplicating by ID so late joiners who were already added aren't doubled.
export function buildNextParticipants(
  currentParticipants: Id<"users">[],
  pendingParticipants: Id<"users">[]
): Id<"users">[] {
  const currentSet = new Set(currentParticipants.map(String));
  return [
    ...currentParticipants,
    ...pendingParticipants.filter((id) => !currentSet.has(String(id))),
  ];
}

// Continues a completed round by creating the next active round with inherited
// settings and merged participants, then scheduling LINE notifications.
// Called atomically from checkGroupTarget after the old round is patched to "completed".
export async function continueRound(
  ctx: any,
  completedRound: any
): Promise<Id<"rounds">> {
  const nextParticipants = buildNextParticipants(
    completedRound.participantIds,
    completedRound.pendingParticipantIds ?? []
  );

  const newRoundId = await ctx.db.insert("rounds", {
    name: completedRound.name,
    rewardDescription: completedRound.rewardDescription,
    participantIds: nextParticipants,
    pendingParticipantIds: [],
    targetWeightCoinsPerPerson: completedRound.targetWeightCoinsPerPerson,
    targetCardioCoinsPerPerson: completedRound.targetCardioCoinsPerPerson,
    status: "active",
    createdBy: completedRound.createdBy,
  });

  await ctx.scheduler.runAfter(0, internal.line.notifyGoalReached, {
    roundId: completedRound._id,
  });
  await ctx.scheduler.runAfter(1000, internal.line.notifyNewRound, {
    roundId: newRoundId,
  });

  return newRoundId;
}
