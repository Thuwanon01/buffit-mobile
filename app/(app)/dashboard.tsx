import { useRef, useState } from "react";
import { useQuery } from "convex/react";
import { useRouter } from "expo-router";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import ViewShot from "react-native-view-shot";
import * as Sharing from "expo-sharing";
import Toast from "react-native-toast-message";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { Card, CoinProgressRow, ProgressBar, RoundPicker, SectionLabel } from "../../src/components/ui";

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

export default function DashboardScreen() {
  const router = useRouter();
  const [selectedRoundId, setSelectedRoundId] = useState<Id<"rounds"> | null>(null);
  const shareRef = useRef<ViewShot>(null);

  async function handleShare() {
    try {
      const uri = await (shareRef.current as any)?.capture?.();
      if (!uri) return;
      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) {
        Toast.show({ type: "info", text1: "แชร์ไม่ได้", text2: "อุปกรณ์นี้ไม่รองรับการแชร์" });
        return;
      }
      await Sharing.shareAsync(uri, { mimeType: "image/png", dialogTitle: "แชร์ progress ของคุณ" });
    } catch {
      Toast.show({ type: "error", text1: "เกิดข้อผิดพลาด", text2: "ไม่สามารถแชร์ได้ กรุณาลองใหม่" });
    }
  }

  const data = useQuery(api.dashboard.getDashboardPage, {
    roundId: selectedRoundId ?? undefined,
  });

  if (data === undefined) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator color={C.gold} size="large" />
      </SafeAreaView>
    );
  }

  if (data === null) return null; // auth guard in (app)/_layout handles redirect

  const {
    user,
    levelProgress,
    myRounds = [],
    hasAnyActiveRounds,
    selectedRound: activeRound,
    leaderboard,
    myEntry,
  } = data;

  const daysUntilBuffet = activeRound?.buffetDate
    ? Math.max(0, Math.ceil((activeRound.buffetDate - Date.now()) / 86_400_000))
    : null;

  const firstName = user.name.split(" ")[0];

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Greeting ───────────────────────────────────────────── */}
        <View style={styles.greeting}>
          <View style={styles.greetingRow}>
            <Text style={styles.greetingName}>สวัสดี {firstName} 👋</Text>
            {levelProgress && (
              <View style={styles.levelBadge}>
                <Text style={styles.levelBadgeText}>Lv.{levelProgress.level}</Text>
              </View>
            )}
          </View>
          <Text style={styles.greetingSub}>พร้อมออกกำลังกายแล้วหรือยัง?</Text>

          {levelProgress && (
            <View style={styles.xpRow}>
              <View style={styles.xpBarWrap}>
                <ProgressBar value={levelProgress.progress} max={1} color={C.gold} />
              </View>
              <Text style={styles.xpLabel}>
                {levelProgress.nextLevel != null
                  ? `${levelProgress.total.toFixed(1)} 🪙 • อีก ${levelProgress.coinsToNext?.toFixed(1)} ถึง Lv.${levelProgress.nextLevel}`
                  : `${levelProgress.total.toFixed(1)} 🪙 • เลเวลสูงสุด 🏆`}
              </Text>
            </View>
          )}
        </View>

        {/* ── Round picker (multi-round) ──────────────────────────── */}
        <RoundPicker
          rounds={myRounds}
          selectedId={selectedRoundId ?? activeRound?._id ?? null}
          onSelect={setSelectedRoundId}
        />

        {/* ── Empty state ─────────────────────────────────────────── */}
        {!activeRound && (
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyEmoji}>😴</Text>
            <Text style={styles.emptyText}>
              {hasAnyActiveRounds
                ? "คุณยังไม่ได้เข้าร่วม round ไหนเลย"
                : "ยังไม่มี round ที่ active อยู่"}
            </Text>
            {hasAnyActiveRounds && (
              <Pressable onPress={() => router.navigate("/(app)/log")}>
                <Text style={styles.emptyLink}>ไปเข้าร่วม round ที่เปิดอยู่ →</Text>
              </Pressable>
            )}
            {!hasAnyActiveRounds && (
              <Text style={styles.emptyHint}>รอ admin เปิด round ใหม่</Text>
            )}
          </Card>
        )}

        {/* ── Active round hero card ───────────────────────────────── */}
        {activeRound && (
          <>
            {/* Share button */}
            <Pressable
              onPress={handleShare}
              style={({ pressed }) => [styles.shareBtn, pressed && { opacity: 0.7 }]}
            >
              <Text style={styles.shareBtnText}>📤 แชร์ Progress</Text>
            </Pressable>

            <ViewShot ref={shareRef} options={{ format: "png", quality: 0.95 }} style={styles.shareCapture}>
            <View style={styles.heroCard}>
              <Text style={styles.heroBg}>🍲</Text>

              <View style={styles.heroHeader}>
                <Text style={styles.heroName}>{activeRound.name}</Text>
                <View style={styles.activeBadge}>
                  <Text style={styles.activeBadgeText}>● ACTIVE</Text>
                </View>
              </View>

              <View style={styles.rewardRow}>
                <Text style={styles.rewardEmoji}>🎯</Text>
                <View>
                  <Text style={styles.rewardHint}>รางวัลรอบนี้</Text>
                  <Text style={styles.rewardText}>{activeRound.rewardDescription}</Text>
                </View>
              </View>

              {/* Goal status */}
              {activeRound.goalReachedAt ? (
                <View style={styles.goalReached}>
                  <Text style={styles.goalReachedText}>✅ ถึงเป้าหมายแล้ว! 🎉</Text>
                  {daysUntilBuffet !== null && daysUntilBuffet > 0 && (
                    <Text style={styles.goalReachedSub}>🍲 อีก {daysUntilBuffet} วันถึงจะไปกิน!</Text>
                  )}
                  {daysUntilBuffet === 0 && (
                    <Text style={styles.goalReachedSub}>🍲 วันนี้ไปกินเลย!</Text>
                  )}
                </View>
              ) : leaderboard?.group ? (
                <View style={styles.shortfall}>
                  <Text style={styles.shortfallText}>⚡ ทีมขาดอีก{" "}
                    <Text style={{ color: C.gold, fontWeight: "700" }}>
                      {Math.max(0, leaderboard.group.groupWeightTarget - leaderboard.group.totalWeightCoins).toFixed(1)}W
                    </Text>
                    {" + "}
                    <Text style={{ color: C.red, fontWeight: "700" }}>
                      {Math.max(0, leaderboard.group.groupCardioTarget - leaderboard.group.totalCardioCoins).toFixed(1)}C
                    </Text>
                    {" ก็ได้ไปกิน!"}
                  </Text>
                </View>
              ) : null}
            </View>

            {/* ── My Progress ─────────────────────────────────────── */}
            {myEntry && (
              <Card>
                <SectionLabel>My Progress</SectionLabel>
                <CoinProgressRow label="Weight Coin" value={myEntry.weightCoins} max={myEntry.weightTarget} type="weight" />
                <View style={{ marginBottom: 0 }}>
                  <CoinProgressRow label="Cardio Coin" value={myEntry.cardioCoins} max={myEntry.cardioTarget} type="cardio" />
                </View>
              </Card>
            )}

            {/* ── Team Progress ────────────────────────────────────── */}
            {leaderboard?.group && (
              <Card>
                <SectionLabel>Team Progress</SectionLabel>
                <CoinProgressRow label="Group Weight" value={leaderboard.group.totalWeightCoins} max={leaderboard.group.groupWeightTarget} type="weight" />
                <CoinProgressRow label="Group Cardio" value={leaderboard.group.totalCardioCoins} max={leaderboard.group.groupCardioTarget} type="cardio" />
                <View style={styles.statRow}>
                  {([
                    { v: `${Math.round(leaderboard.group.weightProgress * 100)}%`, label: "Weight", color: C.gold, bg: "rgba(217,155,0,0.12)" },
                    { v: `${Math.round(leaderboard.group.cardioProgress * 100)}%`, label: "Cardio", color: C.red, bg: "rgba(240,62,85,0.12)" },
                    { v: `${activeRound.participantIds.length} คน`, label: "ผู้เข้าร่วม", color: C.dark, bg: "#ECEDF7" },
                  ] satisfies { v: string; label: string; color: string; bg: string }[]).map((s) => (
                    <View key={s.label} style={[styles.statBadge, { backgroundColor: s.bg }]}>
                      <Text style={[styles.statBadgeValue, { color: s.color }]}>{s.v}</Text>
                      <Text style={styles.statBadgeLabel}>{s.label}</Text>
                    </View>
                  ))}
                </View>
              </Card>
            )}
            </ViewShot>

            {/* ── CTA ─────────────────────────────────────────────── */}
            <Pressable
              onPress={() => router.navigate("/(app)/log")}
              style={({ pressed }) => [styles.ctaBtn, pressed && { opacity: 0.8 }]}
            >
              <Text style={styles.ctaText}>➕ บันทึกการออกกำลังกาย</Text>
            </Pressable>
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

  // Greeting
  greeting: { marginBottom: 18 },
  greetingRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  greetingName: { fontSize: 26, fontWeight: "800", color: C.dark, lineHeight: 32 },
  greetingSub: { fontSize: 13, color: C.muted, marginTop: 4 },
  levelBadge: { backgroundColor: "rgba(217,155,0,0.12)", borderRadius: 99, paddingHorizontal: 10, paddingVertical: 3 },
  levelBadgeText: { color: C.gold, fontSize: 12, fontWeight: "800", letterSpacing: 0.5 },
  xpRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 9 },
  xpBarWrap: { width: 160 },
  xpLabel: { flex: 1, fontSize: 11, color: C.muted },

  // Empty state
  emptyCard: { alignItems: "center", paddingVertical: 40 },
  emptyEmoji: { fontSize: 44, marginBottom: 8 },
  emptyText: { fontSize: 14, color: C.muted, textAlign: "center" },
  emptyLink: { color: C.gold, fontSize: 13, marginTop: 8, fontWeight: "700" },
  emptyHint: { color: "#AAAACC", fontSize: 13, marginTop: 6 },

  // Hero card
  heroCard: {
    backgroundColor: C.white,
    borderRadius: 18,
    padding: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(217,155,0,0.28)",
    overflow: "hidden",
    position: "relative",
  },
  heroBg: { position: "absolute", top: -18, right: -10, fontSize: 76, opacity: 0.05 },
  heroHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  heroName: { fontSize: 20, fontWeight: "800", color: C.dark, flex: 1, marginRight: 8 },
  activeBadge: { backgroundColor: "rgba(30,154,66,0.12)", borderRadius: 99, paddingHorizontal: 9, paddingVertical: 3 },
  activeBadgeText: { color: C.green, fontSize: 10, fontWeight: "700", letterSpacing: 1 },
  rewardRow: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginBottom: 13 },
  rewardEmoji: { fontSize: 22 },
  rewardHint: { fontSize: 10, color: "#AAAACC" },
  rewardText: { fontWeight: "700", color: C.dark, fontSize: 15 },
  goalReached: {
    backgroundColor: "rgba(30,154,66,0.10)",
    borderWidth: 1,
    borderColor: "rgba(30,154,66,0.25)",
    borderRadius: 10,
    padding: 10,
  },
  goalReachedText: { color: C.green, fontWeight: "700", fontSize: 13 },
  goalReachedSub: { color: C.green, fontSize: 12, marginTop: 3 },
  shortfall: { backgroundColor: "rgba(217,155,0,0.08)", borderRadius: 10, padding: 10 },
  shortfallText: { fontSize: 12, color: C.muted },

  // Team stats
  statRow: { flexDirection: "row", gap: 7, marginTop: 4 },
  statBadge: { flex: 1, borderRadius: 9, padding: 8, alignItems: "center" },
  statBadgeValue: { fontSize: 17, fontWeight: "800" },
  statBadgeLabel: { fontSize: 10, color: "#AAAACC", marginTop: 1 },

  // Share
  shareCapture: { backgroundColor: C.bg },
  shareBtn: {
    flexDirection: "row", justifyContent: "flex-end", marginBottom: 8,
  },
  shareBtnText: { fontSize: 13, fontWeight: "700", color: C.muted },

  // CTA
  ctaBtn: {
    backgroundColor: C.gold,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 4,
  },
  ctaText: { fontSize: 16, fontWeight: "800", color: C.dark },
});
