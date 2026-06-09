import { useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { useRouter } from "expo-router";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Toast from "react-native-toast-message";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { Card, RoundPicker, SectionLabel } from "../../src/components/ui";

// ─── Domain types (mirrors web app's log/types.ts) ────────────────────────────

type NewActivitySpec = {
  name: string;
  nameEn: string;
  category: string;
  criteriaPerLevel: { level: number; metric: string; value: number; unit: string }[];
  weightMultiplier: number;
  rationale: string;
};

type ParsedOption =
  | { label: string; value: number; unit: string; match: "existing"; activityId: Id<"activityTypes"> }
  | { label: string; value: number; unit: string; match: "new"; newActivity: NewActivitySpec };

type DraftEntry = {
  rawText: string;
  options: ParsedOption[];
  selectedIndex: number | null;
  removed: boolean;
};

type AutoLogResult = {
  logged: { name: string; value: number; unit: string; coinsEarned: number; coinType: string }[];
  skipped: { name: string; value: number; unit: string; reason: string }[];
  createdActivities: string[];
};

// Matt Pocock: discriminated union drives screen state — no boolean flag soup
type LogStage =
  | { stage: "form" }
  | { stage: "ai_review"; draftEntries: DraftEntry[] }
  | { stage: "success"; isWeight: boolean; coinAmt: string }
  | { stage: "ai_result"; result: AutoLogResult };

// ─── Colors ───────────────────────────────────────────────────────────────────

const C = {
  gold: "#D99B00",
  red: "#F03E55",
  bg: "#F4F5FA",
  dark: "#1A1A2E",
  muted: "#6A6A98",
  border: "#E0E1EF",
  inputBg: "#ECEDF7",
  white: "#FFFFFF",
} satisfies Record<string, string>;

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function LogScreen() {
  const router = useRouter();

  const user = useQuery(api.users.getCurrentUser);
  const activeRounds = useQuery(api.rounds.getActiveRounds);
  const activities = useQuery(api.activityTypes.getApprovedActivities);

  const logWorkout = useMutation(api.workoutLogs.logWorkout);
  const joinRound = useMutation(api.rounds.joinRound);
  const confirmAutoLog = useMutation(api.workoutLogs.confirmAutoLog);
  const parseFreeTextLog = useAction(api.aiCoach.parseFreeTextLog);

  const [logStage, setLogStage] = useState<LogStage>({ stage: "form" });
  const [selectedRoundId, setSelectedRoundId] = useState<Id<"rounds"> | null>(null);
  const [selectedActivity, setSelectedActivity] = useState<Id<"activityTypes"> | null>(null);
  const [metricValue, setMetricValue] = useState("");
  const [note, setNote] = useState("");
  const [freeText, setFreeText] = useState("");
  const [loading, setLoading] = useState(false);
  const [joiningId, setJoiningId] = useState<Id<"rounds"> | null>(null);

  if (user === undefined || activities === undefined || activeRounds === undefined) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator color={C.gold} size="large" />
      </SafeAreaView>
    );
  }

  const myRounds = user
    ? (activeRounds?.filter((r) => r.participantIds.includes(user._id)) ?? [])
    : [];
  const joinableRounds = user
    ? (activeRounds?.filter((r) => !r.participantIds.includes(user._id)) ?? [])
    : [];
  const activeRound =
    myRounds.find((r) => r._id === selectedRoundId) ?? myRounds[0] ?? null;

  const weightActivities = activities.filter((a) => a.category === "weight");
  const cardioActivities = activities.filter((a) => a.category === "cardio");
  const selectedActivityData = activities.find((a) => a._id === selectedActivity);
  const criteria =
    selectedActivityData?.criteriaPerLevel.find(
      (c) => c.level === (user?.level ?? 1)
    ) ?? selectedActivityData?.criteriaPerLevel[0];

  const numericValue = metricValue === "" ? null : Number(metricValue);
  const belowMin =
    !!criteria &&
    numericValue !== null &&
    !Number.isNaN(numericValue) &&
    numericValue < criteria.value;
  const isWeightAct = selectedActivityData?.category === "weight";
  const accentColor = isWeightAct ? C.gold : C.red;

  // ── Handlers ────────────────────────────────────────────────────────────────

  async function handleSubmit() {
    if (!activeRound || !selectedActivity || !metricValue || belowMin) return;
    setLoading(true);
    try {
      await logWorkout({
        roundId: activeRound._id,
        activityTypeId: selectedActivity,
        date: Date.now(),
        metrics: { value: Number(metricValue), unit: criteria?.unit ?? "reps" },
        note: note || undefined,
      });
      setLogStage({
        stage: "success",
        isWeight: !!isWeightAct,
        coinAmt: selectedActivityData?.weightMultiplier.toFixed(1) ?? "1.0",
      });
    } catch (err) {
      Toast.show({ type: "error", text1: "เกิดข้อผิดพลาด", text2: err instanceof Error ? err.message : "ลองใหม่อีกครั้ง" });
    } finally {
      setLoading(false);
    }
  }

  async function handleJoin(roundId: Id<"rounds">) {
    setJoiningId(roundId);
    try {
      await joinRound({ roundId });
      Toast.show({ type: "success", text1: "สำเร็จ", text2: "เข้าร่วม round แล้ว! 🎉" });
    } catch (err) {
      Toast.show({ type: "error", text1: "เกิดข้อผิดพลาด", text2: err instanceof Error ? err.message : "ลองใหม่อีกครั้ง" });
    } finally {
      setJoiningId(null);
    }
  }

  async function handleParse() {
    if (!freeText.trim() || loading) return;
    setLoading(true);
    try {
      const { entries } = await parseFreeTextLog({ text: freeText });
      if (entries.length === 0) {
        Toast.show({ type: "info", text1: "AI ไม่พบกิจกรรม", text2: "ลองพิมพ์ใหม่อีกครั้ง" });
        return;
      }
      setLogStage({
        stage: "ai_review",
        draftEntries: entries.map((e) => ({
          rawText: e.rawText,
          options: e.options,
          selectedIndex: e.options.length === 1 ? 0 : null,
          removed: false,
        })),
      });
    } catch (err) {
      Toast.show({ type: "error", text1: "เกิดข้อผิดพลาด", text2: err instanceof Error ? err.message : "ลองใหม่อีกครั้ง" });
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirmAutoLog(draftEntries: DraftEntry[]) {
    if (!activeRound || loading) return;
    const finalEntries = draftEntries
      .filter((e) => !e.removed && e.selectedIndex !== null)
      .map((e) => {
        const opt = e.options[e.selectedIndex!];
        return {
          rawText: e.rawText,
          value: opt.value,
          unit: opt.unit,
          activityRef:
            opt.match === "existing"
              ? { kind: "existing" as const, activityId: opt.activityId }
              : { kind: "new" as const, ...opt.newActivity },
        };
      });
    if (finalEntries.length === 0) return;
    setLoading(true);
    try {
      const result = await confirmAutoLog({ roundId: activeRound._id, entries: finalEntries });
      setLogStage({ stage: "ai_result", result });
    } catch (err) {
      Toast.show({ type: "error", text1: "เกิดข้อผิดพลาด", text2: err instanceof Error ? err.message : "ลองใหม่อีกครั้ง" });
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setLogStage({ stage: "form" });
    setSelectedActivity(null);
    setMetricValue("");
    setNote("");
    setFreeText("");
  }

  // ── Stage: Success ────────────────────────────────────────────────────────────

  if (logStage.stage === "success") {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.successEmoji}>{logStage.isWeight ? "💪" : "🏃"}</Text>
        <Text style={styles.successTitle}>บันทึกสำเร็จ!</Text>
        <Text style={styles.successSub}>+{logStage.coinAmt} {logStage.isWeight ? "Weight" : "Cardio"} Coin</Text>
        <View style={styles.successBtns}>
          <Pressable
            onPress={resetForm}
            style={[styles.btn, { backgroundColor: "#ECEDF7", flex: 1 }]}
          >
            <Text style={[styles.btnText, { color: C.dark }]}>บันทึกอีกครั้ง</Text>
          </Pressable>
          <Pressable
            onPress={() => router.navigate("/(app)/dashboard")}
            style={[styles.btn, { backgroundColor: logStage.isWeight ? C.gold : C.red, flex: 1 }]}
          >
            <Text style={styles.btnText}>กลับหน้าหลัก</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // ── Stage: AI Review ──────────────────────────────────────────────────────────

  if (logStage.stage === "ai_review") {
    const { draftEntries } = logStage;
    return (
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.pageTitle}>🤖 AI ตรวจพบกิจกรรม</Text>
          <Text style={styles.pageSub}>ตรวจสอบและยืนยันก่อนบันทึก</Text>

          {draftEntries.map((entry, ei) => {
            if (entry.removed) return null;
            return (
              <Card key={ei}>
                <Text style={styles.draftRaw}>"{entry.rawText}"</Text>
                {entry.options.map((opt, oi) => (
                  <Pressable
                    key={oi}
                    onPress={() =>
                      setLogStage({
                        stage: "ai_review",
                        draftEntries: draftEntries.map((e, i) =>
                          i === ei ? { ...e, selectedIndex: oi } : e
                        ),
                      })
                    }
                    style={[
                      styles.draftOption,
                      entry.selectedIndex === oi && styles.draftOptionActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.draftOptionText,
                        entry.selectedIndex === oi && styles.draftOptionTextActive,
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </Pressable>
                ))}
                <Pressable
                  onPress={() =>
                    setLogStage({
                      stage: "ai_review",
                      draftEntries: draftEntries.map((e, i) =>
                        i === ei ? { ...e, removed: true } : e
                      ),
                    })
                  }
                >
                  <Text style={styles.draftRemove}>ลบออก ✕</Text>
                </Pressable>
              </Card>
            );
          })}

          <View style={styles.rowBtns}>
            <Pressable
              onPress={() => setLogStage({ stage: "form" })}
              style={[styles.btn, { backgroundColor: "#ECEDF7", flex: 1 }]}
            >
              <Text style={[styles.btnText, { color: C.dark }]}>ยกเลิก</Text>
            </Pressable>
            <Pressable
              disabled={loading}
              onPress={() => handleConfirmAutoLog(draftEntries)}
              style={[styles.btn, { backgroundColor: C.gold, flex: 1 }]}
            >
              {loading ? (
                <ActivityIndicator color={C.dark} />
              ) : (
                <Text style={styles.btnText}>ยืนยัน ✓</Text>
              )}
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Stage: AI Result ──────────────────────────────────────────────────────────

  if (logStage.stage === "ai_result") {
    const { result } = logStage;
    return (
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.pageTitle}>🎉 บันทึกเรียบร้อย!</Text>

          {result.logged.length > 0 && (
            <Card>
              <SectionLabel>บันทึกแล้ว ({result.logged.length} รายการ)</SectionLabel>
              {result.logged.map((item, i) => (
                <View key={i} style={styles.resultRow}>
                  <Text style={styles.resultName}>{item.name}</Text>
                  <Text style={styles.resultCoins}>+{item.coinsEarned.toFixed(1)} 🪙</Text>
                </View>
              ))}
            </Card>
          )}

          {result.skipped.length > 0 && (
            <Card>
              <SectionLabel>ข้ามไป ({result.skipped.length} รายการ)</SectionLabel>
              {result.skipped.map((item, i) => (
                <View key={i} style={styles.resultRow}>
                  <Text style={[styles.resultName, { color: C.muted }]}>{item.name}</Text>
                  <Text style={[styles.resultCoins, { color: C.muted, fontSize: 11 }]}>{item.reason}</Text>
                </View>
              ))}
            </Card>
          )}

          <View style={styles.rowBtns}>
            <Pressable
              onPress={resetForm}
              style={[styles.btn, { backgroundColor: "#ECEDF7", flex: 1 }]}
            >
              <Text style={[styles.btnText, { color: C.dark }]}>บันทึกเพิ่ม</Text>
            </Pressable>
            <Pressable
              onPress={() => router.navigate("/(app)/dashboard")}
              style={[styles.btn, { backgroundColor: C.gold, flex: 1 }]}
            >
              <Text style={styles.btnText}>กลับหน้าหลัก</Text>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Stage: Form (default) ─────────────────────────────────────────────────────

  // No round + joinable rounds → join prompt
  if (!activeRound && joinableRounds.length > 0) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.pageTitle}>เข้าร่วม Round</Text>
          {joinableRounds.map((r) => (
            <Card key={r._id}>
              <Text style={styles.joinRoundName}>{r.name}</Text>
              <Text style={styles.joinRoundReward}>🎯 {r.rewardDescription}</Text>
              <Pressable
                disabled={joiningId === r._id}
                onPress={() => handleJoin(r._id)}
                style={[styles.btn, { backgroundColor: C.gold, marginTop: 10 }]}
              >
                {joiningId === r._id ? (
                  <ActivityIndicator color={C.dark} />
                ) : (
                  <Text style={styles.btnText}>เข้าร่วม</Text>
                )}
              </Pressable>
            </Card>
          ))}
        </ScrollView>
      </SafeAreaView>
    );
  }

  // No round + nothing joinable
  if (!activeRound) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={{ fontSize: 44, marginBottom: 10 }}>😴</Text>
        <Text style={{ color: C.muted, fontSize: 14 }}>ยังไม่มี round ที่ active</Text>
      </SafeAreaView>
    );
  }

  // Full form
  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.pageTitle}>บันทึกการออกกำลังกาย</Text>

          {/* Round picker */}
          <RoundPicker
            rounds={myRounds}
            selectedId={selectedRoundId ?? activeRound._id}
            onSelect={setSelectedRoundId}
          />

          {/* AI free-text */}
          <Card>
            <SectionLabel>🤖 AI Coach — พิมพ์อะไรก็ได้</SectionLabel>
            <TextInput
              style={styles.freeTextInput}
              placeholder={'เช่น "วิ่ง 5km, นั่งยกน้ำหนัก 3 เซ็ต"'}
              placeholderTextColor="#AAAACC"
              value={freeText}
              onChangeText={setFreeText}
              multiline
              numberOfLines={3}
            />
            <Pressable
              disabled={!freeText.trim() || loading}
              onPress={handleParse}
              style={[
                styles.btn,
                { backgroundColor: freeText.trim() ? C.gold : "#ECEDF7", marginTop: 8 },
              ]}
            >
              {loading ? (
                <ActivityIndicator color={C.dark} />
              ) : (
                <Text style={[styles.btnText, { color: freeText.trim() ? C.dark : C.muted }]}>
                  ให้ AI วิเคราะห์
                </Text>
              )}
            </Pressable>
          </Card>

          {/* ── Weight activities ─────────────────────────────────── */}
          <View style={styles.categorySection}>
            <View style={styles.categoryHeader}>
              <Text style={styles.categoryEmoji}>💪</Text>
              <Text style={[styles.categoryLabel, { color: C.gold }]}>WEIGHT TRAINING</Text>
            </View>
            <View style={styles.activityGrid}>
              {weightActivities.map((a) => {
                const sel = selectedActivity === a._id;
                return (
                  <Pressable
                    key={a._id}
                    onPress={() => {
                      setSelectedActivity(sel ? null : a._id);
                      setMetricValue("");
                    }}
                    style={[styles.activityBtn, sel && { borderColor: C.gold, backgroundColor: "rgba(217,155,0,0.08)" }]}
                  >
                    <Text style={[styles.activityName, sel && { color: C.gold, fontWeight: "700" }]}>
                      {a.name}
                    </Text>
                    <Text style={styles.activityMultiplier}>{a.weightMultiplier.toFixed(1)} 🪙</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* ── Cardio activities ─────────────────────────────────── */}
          <View style={styles.categorySection}>
            <View style={styles.categoryHeader}>
              <Text style={styles.categoryEmoji}>🏃</Text>
              <Text style={[styles.categoryLabel, { color: C.red }]}>CARDIO</Text>
            </View>
            <View style={styles.activityGrid}>
              {cardioActivities.map((a) => {
                const sel = selectedActivity === a._id;
                return (
                  <Pressable
                    key={a._id}
                    onPress={() => {
                      setSelectedActivity(sel ? null : a._id);
                      setMetricValue("");
                    }}
                    style={[styles.activityBtn, sel && { borderColor: C.red, backgroundColor: "rgba(240,62,85,0.08)" }]}
                  >
                    <Text style={[styles.activityName, sel && { color: C.red, fontWeight: "700" }]}>
                      {a.name}
                    </Text>
                    <Text style={styles.activityMultiplier}>{a.weightMultiplier.toFixed(1)} 🪙</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* ── Metric form (appears when activity selected) ────────── */}
          {selectedActivityData && (
            criteria ? (
              <Card style={{ borderColor: C.border }}>
                <Text style={styles.metricActName}>{selectedActivityData.name}</Text>
                <View style={styles.metricGoalBadge}>
                  <Text style={styles.metricGoalText}>
                    🎯 เป้า Lv.{user?.level}: ≥ {criteria.value} {criteria.unit} → {selectedActivityData.weightMultiplier.toFixed(1)} coin
                  </Text>
                </View>

                <Text style={styles.inputLabel}>{criteria.metric || criteria.unit}</Text>
                <TextInput
                  style={[styles.metricInput, belowMin && { borderColor: C.red, color: C.red }]}
                  placeholder={`กรอก ${criteria.unit}...`}
                  placeholderTextColor="#AAAACC"
                  value={metricValue}
                  onChangeText={setMetricValue}
                  keyboardType="decimal-pad"
                />
                {belowMin && (
                  <Text style={styles.belowMinText}>
                    ⚠️ ต้องมากกว่าหรือเท่ากับ {criteria.value} {criteria.unit}
                  </Text>
                )}

                <Text style={styles.inputLabel}>โน้ต (ไม่บังคับ)</Text>
                <TextInput
                  style={[styles.metricInput, styles.noteInput]}
                  placeholder="บันทึกความรู้สึก..."
                  placeholderTextColor="#AAAACC"
                  value={note}
                  onChangeText={setNote}
                  multiline
                  numberOfLines={3}
                />

                <Pressable
                  disabled={loading || !metricValue || belowMin}
                  onPress={handleSubmit}
                  style={[
                    styles.btn,
                    { backgroundColor: loading || !metricValue || belowMin ? "#E0E1EF" : accentColor },
                  ]}
                >
                  {loading ? (
                    <ActivityIndicator color={C.dark} />
                  ) : (
                    <Text style={[styles.btnText, { color: !metricValue || belowMin ? C.muted : C.dark }]}>
                      บันทึก {isWeightAct ? "💪" : "🏃"}
                    </Text>
                  )}
                </Pressable>
              </Card>
            ) : (
              <Card style={{ borderColor: "rgba(240,62,85,0.25)" }}>
                <Text style={{ textAlign: "center", fontSize: 24, marginBottom: 6 }}>⚠️</Text>
                <Text style={styles.noCriteriaText}>{selectedActivityData.name} ยังไม่มีเกณฑ์</Text>
                <Text style={styles.noCriteriaSub}>Admin ต้องตั้งเกณฑ์ก่อนถึงจะบันทึกได้</Text>
              </Card>
            )
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, backgroundColor: C.bg, alignItems: "center", justifyContent: "center" },
  scroll: { padding: 16, paddingBottom: 40 },

  pageTitle: { fontSize: 20, fontWeight: "800", color: C.dark, marginBottom: 14 },
  pageSub: { fontSize: 13, color: C.muted, marginBottom: 14 },

  // Success
  successEmoji: { fontSize: 72, marginBottom: 12 },
  successTitle: { fontSize: 26, fontWeight: "800", color: C.dark, marginBottom: 4 },
  successSub: { fontSize: 16, color: C.muted, marginBottom: 32 },
  successBtns: { flexDirection: "row", gap: 10, width: "80%" as const },

  // Buttons
  btn: { borderRadius: 12, paddingVertical: 13, alignItems: "center" },
  btnText: { fontSize: 15, fontWeight: "800", color: C.dark },
  rowBtns: { flexDirection: "row", gap: 10, marginTop: 8 },

  // AI draft review
  draftRaw: { fontSize: 12, color: C.muted, fontStyle: "italic", marginBottom: 8 },
  draftOption: {
    borderWidth: 1, borderColor: C.border, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 8, marginBottom: 6,
    backgroundColor: "#ECEDF7",
  },
  draftOptionActive: { borderColor: C.gold, backgroundColor: "rgba(217,155,0,0.10)" },
  draftOptionText: { fontSize: 13, color: C.dark },
  draftOptionTextActive: { color: C.gold, fontWeight: "700" },
  draftRemove: { color: C.red, fontSize: 12, marginTop: 6, textAlign: "right" },

  // AI result
  resultRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  resultName: { fontSize: 14, color: C.dark, flex: 1 },
  resultCoins: { fontSize: 14, fontWeight: "700", color: C.gold },

  // Join round
  joinRoundName: { fontSize: 16, fontWeight: "800", color: C.dark },
  joinRoundReward: { fontSize: 13, color: C.muted, marginTop: 4 },

  // Free-text input
  freeTextInput: {
    backgroundColor: "#ECEDF7",
    borderWidth: 1, borderColor: C.border, borderRadius: 10,
    paddingHorizontal: 13, paddingVertical: 10,
    fontSize: 14, color: C.dark,
    minHeight: 72, textAlignVertical: "top",
  },

  // Activities
  categorySection: { marginBottom: 4 },
  categoryHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10 },
  categoryEmoji: { fontSize: 16 },
  categoryLabel: { fontSize: 14, fontWeight: "800", letterSpacing: 0.5 },
  activityGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 },
  activityBtn: {
    width: "47%" as const,
    backgroundColor: C.white,
    borderWidth: 1, borderColor: C.border,
    borderRadius: 12, padding: 12,
  },
  activityName: { fontSize: 13, color: C.dark, marginBottom: 4 },
  activityMultiplier: { fontSize: 11, color: C.muted },

  // Metric form
  metricActName: { fontSize: 18, fontWeight: "800", color: C.dark, marginBottom: 6 },
  metricGoalBadge: {
    backgroundColor: "#E0E1EF", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 14,
  },
  metricGoalText: { fontSize: 12, color: C.muted },
  inputLabel: { fontSize: 11, color: C.muted, fontWeight: "600", letterSpacing: 0.4, marginBottom: 5 },
  metricInput: {
    backgroundColor: C.white, borderWidth: 1, borderColor: C.border,
    borderRadius: 10, paddingHorizontal: 13, paddingVertical: 10,
    fontSize: 16, color: C.dark, marginBottom: 12,
  },
  noteInput: { height: 58, textAlignVertical: "top", fontSize: 13, marginBottom: 16 },
  belowMinText: { color: C.red, fontSize: 11, marginTop: -8, marginBottom: 12 },
  noCriteriaText: { color: C.red, fontWeight: "700", fontSize: 13, textAlign: "center", marginBottom: 4 },
  noCriteriaSub: { color: "#AAAACC", fontSize: 12, textAlign: "center" },
});
