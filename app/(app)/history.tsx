import { useState } from "react";
import { useQuery } from "convex/react";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { Card, RoundPicker } from "../../src/components/ui";

const C = {
  gold: "#D99B00",
  red: "#F03E55",
  bg: "#F4F5FA",
  dark: "#1A1A2E",
  muted: "#6A6A98",
  border: "#E0E1EF",
  white: "#FFFFFF",
} satisfies Record<string, string>;

// Matt Pocock: narrow tab type instead of plain string
type Tab = "feed" | "chart";

export default function HistoryScreen() {
  const [tab, setTab] = useState<Tab>("feed");
  const [selectedRoundId, setSelectedRoundId] = useState<Id<"rounds"> | null>(null);

  const feedData = useQuery(api.workoutLogs.getHistoryFeedData, {
    roundId: selectedRoundId ?? undefined,
  });

  if (feedData === undefined) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator color={C.gold} size="large" />
      </SafeAreaView>
    );
  }

  const activityMap = new Map(feedData?.activities.map((a) => [a._id, a]) ?? []);
  const userMap = new Map(feedData?.users.map((u) => [u._id, u]) ?? []);
  const logs = feedData?.logs ?? [];
  const rounds = feedData?.rounds ?? [];
  const selectedRound = feedData?.selectedRound ?? null;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        <Text style={styles.pageTitle}>📈 History</Text>

        {/* Tabs */}
        <View style={styles.tabs}>
          {(["feed", "chart"] satisfies Tab[]).map((t) => (
            <Pressable key={t} onPress={() => setTab(t)} style={[styles.tab, tab === t && styles.tabActive]}>
              <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
                {t === "feed" ? "Feed" : "กราฟ"}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Chart tab — Phase 5 placeholder */}
        {tab === "chart" && (
          <View style={styles.chartPlaceholder}>
            <Text style={styles.chartPlaceholderEmoji}>📊</Text>
            <Text style={styles.chartPlaceholderTitle}>กราฟ Progress</Text>
            <Text style={styles.chartPlaceholderSub}>
              กราฟสะสม coin รายรอบจะพร้อมใน Phase 5{"\n"}
              (ต้องติดตั้ง victory-native แทน Recharts)
            </Text>
          </View>
        )}

        {/* Feed tab */}
        {tab === "feed" && (
          <>
            <RoundPicker
              rounds={rounds}
              selectedId={selectedRoundId ?? selectedRound?._id ?? null}
              onSelect={setSelectedRoundId}
            />

            {logs.length === 0 ? (
              <View style={styles.emptyFeed}>
                <Text style={styles.emptyEmoji}>🏋️</Text>
                <Text style={styles.emptyText}>ยังไม่มีประวัติการออกกำลังกาย</Text>
              </View>
            ) : (
              logs.map((log) => {
                const activity = activityMap.get(log.activityTypeId);
                const user = userMap.get(log.userId);
                const isWeight = activity?.category === "weight";
                const coinColor = isWeight ? C.gold : C.red;
                const date = new Date(log.date);
                const dateStr = date.toLocaleDateString("th-TH", {
                  day: "numeric",
                  month: "short",
                });

                return (
                  <Card key={log._id} style={styles.logCard}>
                    <View style={styles.logRow}>
                      <View style={[styles.logIconWrap, { backgroundColor: isWeight ? "rgba(217,155,0,0.12)" : "rgba(240,62,85,0.12)" }]}>
                        <Text style={styles.logIcon}>{isWeight ? "💪" : "🏃"}</Text>
                      </View>

                      <View style={styles.logInfo}>
                        <Text style={styles.logActivity}>{activity?.name ?? "กิจกรรม"}</Text>
                        <Text style={styles.logMeta}>
                          {user?.name ?? "ผู้ใช้"} • {log.metrics.value} {log.metrics.unit}
                        </Text>
                        {log.note ? (
                          <Text style={styles.logNote} numberOfLines={1}>{log.note}</Text>
                        ) : null}
                      </View>

                      <View style={styles.logRight}>
                        <Text style={[styles.logCoins, { color: coinColor }]}>
                          +{log.coinsEarned.toFixed(1)}
                        </Text>
                        <Text style={styles.logDate}>{dateStr}</Text>
                      </View>
                    </View>
                  </Card>
                );
              })
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, backgroundColor: C.bg, alignItems: "center", justifyContent: "center" },
  scroll: { padding: 16, paddingBottom: 32 },

  pageTitle: { fontSize: 22, fontWeight: "800", color: C.dark, marginBottom: 14 },

  // Tabs
  tabs: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: C.border, marginBottom: 16 },
  tab: { flex: 1, paddingVertical: 10, alignItems: "center", borderBottomWidth: 2, borderBottomColor: "transparent" },
  tabActive: { borderBottomColor: C.gold },
  tabText: { fontSize: 13, fontWeight: "800", color: "#AAAACC", letterSpacing: 0.5 },
  tabTextActive: { color: C.gold },

  // Chart placeholder
  chartPlaceholder: {
    alignItems: "center", padding: 40,
    backgroundColor: C.white, borderRadius: 16,
    borderWidth: 1, borderColor: C.border, borderStyle: "dashed",
  },
  chartPlaceholderEmoji: { fontSize: 44, marginBottom: 10 },
  chartPlaceholderTitle: { fontSize: 16, fontWeight: "700", color: C.dark, marginBottom: 6 },
  chartPlaceholderSub: { fontSize: 13, color: C.muted, textAlign: "center", lineHeight: 20 },

  // Feed empty state
  emptyFeed: { alignItems: "center", paddingVertical: 48 },
  emptyEmoji: { fontSize: 44, marginBottom: 10 },
  emptyText: { fontSize: 14, color: C.muted },

  // Log card
  logCard: { marginBottom: 8, padding: 12 },
  logRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  logIconWrap: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  logIcon: { fontSize: 18 },
  logInfo: { flex: 1, minWidth: 0 },
  logActivity: { fontSize: 14, fontWeight: "700", color: C.dark },
  logMeta: { fontSize: 12, color: C.muted, marginTop: 2 },
  logNote: { fontSize: 11, color: "#AAAACC", marginTop: 2, fontStyle: "italic" },
  logRight: { alignItems: "flex-end" },
  logCoins: { fontSize: 15, fontWeight: "800" },
  logDate: { fontSize: 11, color: "#AAAACC", marginTop: 2 },
});
