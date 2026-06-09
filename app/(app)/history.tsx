import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import {
  ActivityIndicator,
  Dimensions,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { VictoryBar, VictoryChart, VictoryAxis, VictoryGroup } from "victory-native";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { Card, RoundPicker } from "../../src/components/ui";

const CHART_WIDTH = Dimensions.get("window").width - 32;

const C = {
  gold: "#D99B00",
  red: "#F03E55",
  bg: "#F4F5FA",
  dark: "#1A1A2E",
  muted: "#6A6A98",
  border: "#E0E1EF",
  white: "#FFFFFF",
} satisfies Record<string, string>;

type Tab = "feed" | "chart";

export default function HistoryScreen() {
  const [tab, setTab] = useState<Tab>("feed");
  const [selectedRoundId, setSelectedRoundId] = useState<Id<"rounds"> | null>(null);

  const feedData = useQuery(api.workoutLogs.getHistoryFeedData, {
    roundId: selectedRoundId ?? undefined,
  });
  const progressData = useQuery(api.workoutLogs.getProgressData);
  const me = useQuery(api.users.getCurrentUser);

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

  // Build chart data: current user's coins (weight + cardio) per round, sorted by creation time
  const myChartData = useMemo(() => {
    if (!progressData || !me) return [];
    const myId = String(me._id);
    const sorted = [...progressData.rounds].sort((a, b) => a._creationTime - b._creationTime);
    return sorted.map((round, i) => {
      const entry = progressData.entries.find((e) => e.userId === myId && e.roundId === String(round._id));
      return {
        x: i + 1,
        label: round.name.length > 8 ? round.name.slice(0, 7) + "…" : round.name,
        weight: entry?.weightCoins ?? 0,
        cardio: entry?.cardioCoins ?? 0,
      };
    });
  }, [progressData, me]);

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

        {/* Chart tab */}
        {tab === "chart" && (
          progressData === undefined ? (
            <View style={styles.chartPlaceholder}>
              <ActivityIndicator color={C.gold} />
            </View>
          ) : myChartData.length === 0 ? (
            <View style={styles.chartPlaceholder}>
              <Text style={styles.chartPlaceholderEmoji}>📊</Text>
              <Text style={styles.chartPlaceholderSub}>ยังไม่มีข้อมูลกราฟ</Text>
            </View>
          ) : (
            <View style={styles.chartWrap}>
              {/* Legend */}
              <View style={styles.legend}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: C.gold }]} />
                  <Text style={styles.legendLabel}>Weight 💪</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: C.red }]} />
                  <Text style={styles.legendLabel}>Cardio 🏃</Text>
                </View>
              </View>

              <VictoryChart
                width={CHART_WIDTH}
                height={240}
                domainPadding={{ x: 20 }}
                padding={{ top: 10, bottom: 50, left: 40, right: 16 }}
              >
                <VictoryAxis
                  tickValues={myChartData.map((d) => d.x)}
                  tickFormat={(x: number) => myChartData[x - 1]?.label ?? ""}
                  style={{
                    axis: { stroke: C.border },
                    tickLabels: { fontSize: 9, fill: C.muted, angle: -20, textAnchor: "end" },
                    grid: { stroke: "transparent" },
                  }}
                />
                <VictoryAxis
                  dependentAxis
                  style={{
                    axis: { stroke: "transparent" },
                    tickLabels: { fontSize: 9, fill: C.muted },
                    grid: { stroke: C.border, strokeDasharray: "3,3" },
                  }}
                />
                <VictoryGroup offset={10}>
                  <VictoryBar
                    data={myChartData.map((d) => ({ x: d.x, y: d.weight }))}
                    style={{ data: { fill: C.gold, borderRadius: 4 } }}
                    barWidth={9}
                    cornerRadius={{ top: 3 }}
                  />
                  <VictoryBar
                    data={myChartData.map((d) => ({ x: d.x, y: d.cardio }))}
                    style={{ data: { fill: C.red } }}
                    barWidth={9}
                    cornerRadius={{ top: 3 }}
                  />
                </VictoryGroup>
              </VictoryChart>

              {/* Round-by-round breakdown */}
              {myChartData.filter((d) => d.weight > 0 || d.cardio > 0).map((d, i) => (
                <View key={i} style={styles.roundRow}>
                  <Text style={styles.roundName} numberOfLines={1}>{d.label}</Text>
                  <Text style={[styles.roundStat, { color: C.gold }]}>💪 {d.weight.toFixed(1)}</Text>
                  <Text style={[styles.roundStat, { color: C.red }]}>🏃 {d.cardio.toFixed(1)}</Text>
                </View>
              ))}
            </View>
          )
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

  // Chart
  chartPlaceholder: {
    alignItems: "center", padding: 40,
    backgroundColor: C.white, borderRadius: 16,
    borderWidth: 1, borderColor: C.border,
  },
  chartPlaceholderEmoji: { fontSize: 44, marginBottom: 10 },
  chartPlaceholderSub: { fontSize: 13, color: C.muted, textAlign: "center" },

  chartWrap: {
    backgroundColor: C.white, borderRadius: 16, padding: 12,
    borderWidth: 1, borderColor: C.border, marginBottom: 8,
  },
  legend: { flexDirection: "row", gap: 16, marginBottom: 4, paddingHorizontal: 4 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  legendDot: { width: 9, height: 9, borderRadius: 99 },
  legendLabel: { fontSize: 11, color: C.muted, fontWeight: "600" },

  roundRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 5, borderTopWidth: 1, borderTopColor: "#F0F0F8" },
  roundName: { flex: 1, fontSize: 12, color: C.dark, fontWeight: "600" },
  roundStat: { fontSize: 12, fontWeight: "700", minWidth: 48, textAlign: "right" },

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
