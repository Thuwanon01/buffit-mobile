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

const GOLD = "#D99B00";
const BG = "#F4F5FA";
const DARK = "#1A1A2E";

export function DashboardScreen() {
  const data = useQuery(api.dashboard.getDashboardPage, {});

  if (data === undefined) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator color={GOLD} size="large" />
        <Text style={styles.caption}>กำลังเชื่อมต่อ Convex…</Text>
      </SafeAreaView>
    );
  }

  if (data === null) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.logo}>BUFFIT 💪</Text>
        <Text style={styles.caption}>✅ Convex connected</Text>
        <Text style={[styles.caption, { color: "#888" }]}>
          Phase 2: auth required to show data
        </Text>
      </SafeAreaView>
    );
  }

  const { user, levelProgress, myEntry, leaderboard } = data;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.logo}>BUFFIT 💪</Text>

        {/* User card */}
        <View style={styles.card}>
          <Text style={styles.name}>{user.name}</Text>
          <Text style={styles.level}>Level {user.level}</Text>
          {levelProgress && (
            <View style={styles.barBg}>
              <View
                style={[
                  styles.barFill,
                  { width: `${Math.round(levelProgress.progressPercent * 100)}%` as any },
                ]}
              />
            </View>
          )}
        </View>

        {/* My coins */}
        {myEntry && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>เหรียญของฉัน</Text>
            <Text style={styles.coins}>🏋️ {myEntry.weightCoins} / {myEntry.weightTarget}</Text>
            <Text style={styles.coins}>🏃 {myEntry.cardioCoins} / {myEntry.cardioTarget}</Text>
          </View>
        )}

        {/* Leaderboard */}
        {leaderboard && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Leaderboard</Text>
            {leaderboard.entries.map((entry, i) => (
              <View key={entry.userId} style={styles.row}>
                <Text style={styles.rank}>#{i + 1}</Text>
                <Text style={styles.entryName}>{entry.name}</Text>
                <Text style={styles.entryCoins}>{entry.totalCoins} 🪙</Text>
              </View>
            ))}
          </View>
        )}

        {!data.selectedRound && (
          <View style={styles.card}>
            <Text style={[styles.caption, { textAlign: "center" }]}>
              {data.hasAnyActiveRounds ? "ยังไม่ได้เข้าร่วม round ใด" : "ยังไม่มี round ที่เปิดอยู่"}
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  center: { flex: 1, backgroundColor: BG, alignItems: "center", justifyContent: "center" },
  scroll: { padding: 16, gap: 12 },
  logo: { fontSize: 28, fontWeight: "800", color: GOLD, textAlign: "center", marginBottom: 8 },
  card: { backgroundColor: "#fff", borderRadius: 12, padding: 16, gap: 8 },
  name: { fontSize: 20, fontWeight: "700", color: DARK },
  level: { fontSize: 14, color: "#888" },
  barBg: { height: 6, backgroundColor: "#eee", borderRadius: 3, overflow: "hidden" },
  barFill: { height: 6, backgroundColor: GOLD, borderRadius: 3 },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: DARK, marginBottom: 4 },
  coins: { fontSize: 15, color: DARK },
  row: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 4 },
  rank: { width: 28, fontSize: 14, color: "#888" },
  entryName: { flex: 1, fontSize: 15, color: DARK },
  entryCoins: { fontSize: 15, fontWeight: "600", color: GOLD },
  caption: { fontSize: 14, color: "#666", marginTop: 8 },
});
