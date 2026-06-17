import { useState } from "react";
import { useQuery } from "convex/react";
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { Avatar, Card, CoinProgressRow, RoundPicker, SectionLabel } from "../../src/components/ui";

const C = {
  gold: "#D99B00",
  red: "#F03E55",
  green: "#1E9A42",
  bg: "#F4F5FA",
  dark: "#1A1A2E",
  muted: "#6A6A98",
  border: "#E0E1EF",
  white: "#FFFFFF",
} satisfies Record<string, string>;

// Matt Pocock: as const on a fixed-length tuple keeps individual literal types
const MEDALS = ["🥇", "🥈", "🥉"] as const;

export default function LeaderboardScreen() {
  const [selectedRoundId, setSelectedRoundId] = useState<Id<"rounds"> | null>(null);

  const data = useQuery(api.leaderboard.getLeaderboardPage, {
    roundId: selectedRoundId ?? undefined,
  });

  if (data === undefined) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator color={C.gold} size="large" />
      </SafeAreaView>
    );
  }

  if (!data?.selectedRound) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.emptyEmoji}>🏆</Text>
        <Text style={styles.emptyText}>ยังไม่มี round ที่ active</Text>
      </SafeAreaView>
    );
  }

  const { currentUserId, myRounds, selectedRound, leaderboard } = data;
  const { entries = [], group } = leaderboard ?? {};

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        <Text style={styles.pageTitle}>🏆 Leaderboard</Text>
        <Text style={styles.pageSub}>
          {selectedRound.name} • {selectedRound.participantIds.length} คน
        </Text>

        <RoundPicker
          rounds={myRounds}
          selectedId={selectedRoundId ?? selectedRound._id}
          onSelect={setSelectedRoundId}
        />

        {/* Team progress */}
        {group && (
          <Card>
            <View style={styles.teamHeader}>
              <SectionLabel>Team Progress</SectionLabel>
              {group.goalReached && (
                <View style={styles.goalBadge}>
                  <Text style={styles.goalBadgeText}>✅ ครบแล้ว!</Text>
                </View>
              )}
            </View>
            <CoinProgressRow
              label="Group Weight"
              value={group.totalWeightCoins}
              max={group.groupWeightTarget}
              type="weight"
            />
            <View style={{ marginBottom: 0 }}>
              <CoinProgressRow
                label="Group Cardio"
                value={group.totalCardioCoins}
                max={group.groupCardioTarget}
                type="cardio"
              />
            </View>
          </Card>
        )}

        <Text style={styles.rankingsLabel}>INDIVIDUAL RANKINGS</Text>

        {entries.map((entry, i) => {
          const isMe = entry.userId === currentUserId;
          const weightPct = Math.min(
            100,
            entry.weightTarget > 0 ? (entry.weightCoins / entry.weightTarget) * 100 : 0
          );
          const cardioPct = Math.min(
            100,
            entry.cardioTarget > 0 ? (entry.cardioCoins / entry.cardioTarget) * 100 : 0
          );

          return (
            <View key={entry.userId} style={[styles.entryCard, isMe && styles.entryCardMe]}>
              <View style={styles.entryRow}>
                <View style={styles.rank}>
                  {i < MEDALS.length ? (
                    <Text style={styles.rankMedal}>{MEDALS[i]}</Text>
                  ) : (
                    <Text style={styles.rankNum}>{i + 1}</Text>
                  )}
                </View>

                <Avatar name={entry.name} size={36} />

                <View style={styles.entryInfo}>
                  <View style={styles.entryNameRow}>
                    <Text style={styles.entryName}>{entry.name}</Text>
                    <View style={styles.lvBadge}>
                      <Text style={styles.lvBadgeText}>Lv.{entry.level}</Text>
                    </View>
                    {isMe && <Text style={styles.meBadge}>(ฉัน)</Text>}
                  </View>
                </View>

                <View style={styles.totalCoins}>
                  <Text style={styles.totalCoinsValue}>{entry.totalCoins.toFixed(2)}</Text>
                  <Text style={styles.totalCoinsLabel}>coins</Text>
                </View>
              </View>

              <View style={styles.miniBars}>
                {([
                  { emoji: "💪", pct: weightPct, val: entry.weightCoins, max: entry.weightTarget, color: C.gold },
                  { emoji: "🏃", pct: cardioPct, val: entry.cardioCoins, max: entry.cardioTarget, color: C.red },
                ] satisfies { emoji: string; pct: number; val: number; max: number; color: string }[]).map((bar) => (
                  <View key={bar.emoji} style={styles.miniBarRow}>
                    <Text style={styles.miniBarEmoji}>{bar.emoji}</Text>
                    <View style={styles.miniTrack}>
                      <View style={[styles.miniFill, { width: `${bar.pct}%`, backgroundColor: bar.color }]} />
                    </View>
                    <Text style={[styles.miniValue, { color: bar.color }]}>
                      {bar.val.toFixed(2)}/{bar.max}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, backgroundColor: C.bg, alignItems: "center", justifyContent: "center" },
  scroll: { padding: 16, paddingBottom: 32 },

  pageTitle: { fontSize: 22, fontWeight: "800", color: C.dark },
  pageSub: { fontSize: 11, color: "#AAAACC", marginTop: 2, marginBottom: 16 },
  emptyEmoji: { fontSize: 48, marginBottom: 8 },
  emptyText: { fontSize: 14, color: C.muted },

  teamHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  goalBadge: {
    backgroundColor: "rgba(30,154,66,0.12)",
    borderRadius: 99, paddingHorizontal: 10, paddingVertical: 3, marginBottom: 13,
  },
  goalBadgeText: { color: C.green, fontSize: 10, fontWeight: "700", letterSpacing: 1 },

  rankingsLabel: {
    fontSize: 11, fontWeight: "700", color: "#AAAACC", letterSpacing: 1.5, marginBottom: 10,
  },

  entryCard: {
    backgroundColor: C.white, borderRadius: 15, padding: 13, marginBottom: 9,
    borderWidth: 1, borderColor: C.border,
  },
  entryCardMe: { borderColor: C.gold, backgroundColor: "rgba(255,248,230,1)" },

  entryRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  rank: { width: 26, alignItems: "center" },
  rankMedal: { fontSize: 20, lineHeight: 24 },
  rankNum: { fontSize: 13, fontWeight: "700", color: "#AAAACC" },

  entryInfo: { flex: 1, minWidth: 0 },
  entryNameRow: { flexDirection: "row", alignItems: "center", gap: 5, flexWrap: "wrap" },
  entryName: { fontSize: 14, fontWeight: "700", color: C.dark },
  lvBadge: { backgroundColor: "#E0E1EF", borderRadius: 99, paddingHorizontal: 8, paddingVertical: 2 },
  lvBadgeText: { fontSize: 11, fontWeight: "700", color: C.muted, letterSpacing: 0.5 },
  meBadge: { fontSize: 11, color: C.gold },

  totalCoins: { alignItems: "flex-end" },
  totalCoinsValue: { fontSize: 18, fontWeight: "800", color: C.dark },
  totalCoinsLabel: { fontSize: 10, color: "#AAAACC" },

  miniBars: { paddingLeft: 36, gap: 6 },
  miniBarRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  miniBarEmoji: { fontSize: 11, width: 14 },
  miniTrack: {
    flex: 1, height: 5, backgroundColor: "#E0E1EF", borderRadius: 99, overflow: "hidden",
  },
  miniFill: { height: "100%", borderRadius: 99 },
  miniValue: { fontSize: 11, fontWeight: "700", minWidth: 36, textAlign: "right" },
});
