import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import {
  ActivityIndicator,
  Alert,
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

type AdminTab = "round" | "users";

function RoundTab() {
  const activeRounds = useQuery(api.rounds.getActiveRounds);
  const allUsers = useQuery(api.users.getAllUsers);
  const createRound = useMutation(api.rounds.createRound);
  const closeRound = useMutation(api.rounds.closeRound);
  const updateRound = useMutation(api.rounds.updateRound);
  const removeParticipant = useMutation(api.rounds.removeParticipant);

  const [name, setName] = useState("");
  const [reward, setReward] = useState("");
  const [weightTarget, setWeightTarget] = useState("6");
  const [cardioTarget, setCardioTarget] = useState("6");
  const [selectedParticipants, setSelectedParticipants] = useState<Id<"users">[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  function toggleParticipant(id: Id<"users">) {
    setSelectedParticipants((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  }

  async function handleCreate() {
    if (!name.trim() || !reward.trim()) {
      Toast.show({ type: "error", text1: "กรุณากรอกข้อมูลให้ครบ" });
      return;
    }
    if (selectedParticipants.length === 0) {
      Toast.show({ type: "error", text1: "เลือกผู้เข้าร่วมอย่างน้อย 1 คน" });
      return;
    }
    setLoading(true);
    try {
      await createRound({
        name: name.trim(),
        rewardDescription: reward.trim(),
        participantIds: selectedParticipants,
        targetWeightCoinsPerPerson: Number(weightTarget),
        targetCardioCoinsPerPerson: Number(cardioTarget),
      });
      Toast.show({ type: "success", text1: "สร้าง round สำเร็จ! 🎉" });
      setName(""); setReward(""); setSelectedParticipants([]);
      setShowCreate(false);
    } catch (err: any) {
      Toast.show({ type: "error", text1: "เกิดข้อผิดพลาด", text2: err.message });
    } finally {
      setLoading(false);
    }
  }

  function confirmClose(roundId: Id<"rounds">, roundName: string) {
    Alert.alert("ปิด Round", `ต้องการปิด "${roundName}" ใช่ไหม?`, [
      { text: "ยกเลิก", style: "cancel" },
      {
        text: "ปิด Round",
        style: "destructive",
        onPress: async () => {
          try {
            await closeRound({ id: roundId });
            Toast.show({ type: "success", text1: "ปิด round แล้ว" });
          } catch (err: any) {
            Toast.show({ type: "error", text1: err.message });
          }
        },
      },
    ]);
  }

  if (activeRounds === undefined) {
    return <ActivityIndicator color={C.gold} style={{ marginTop: 32 }} />;
  }

  return (
    <View>
      {activeRounds.map((round) => {
        const participants = allUsers?.filter((u) => round.participantIds.includes(u._id)) ?? [];
        const notJoined = allUsers?.filter((u) => !round.participantIds.includes(u._id)) ?? [];
        return (
          <View key={round._id} style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>{round.name}</Text>
              <View style={styles.activeBadge}>
                <Text style={styles.activeBadgeText}>● ACTIVE</Text>
              </View>
            </View>
            <Text style={styles.cardSub}>🎯 {round.rewardDescription} • {round.participantIds.length} คน</Text>

            {participants.length > 0 && (
              <View style={{ marginTop: 10 }}>
                <Text style={styles.fieldLabel}>ผู้เข้าร่วม (กดเพื่อเตะออก)</Text>
                <View style={styles.chipRow}>
                  {participants.map((u) => (
                    <Pressable
                      key={u._id}
                      onPress={() => {
                        Alert.alert("เตะออก", `เตะ "${u.name}" ออกจาก round ใช่ไหม?`, [
                          { text: "ยกเลิก", style: "cancel" },
                          {
                            text: "เตะออก", style: "destructive",
                            onPress: async () => {
                              try {
                                await removeParticipant({ roundId: round._id, userId: u._id });
                                Toast.show({ type: "success", text1: `เตะ ${u.name} ออกแล้ว` });
                              } catch (e: any) { Toast.show({ type: "error", text1: e.message }); }
                            },
                          },
                        ]);
                      }}
                      style={styles.chipParticipant}
                    >
                      <Text style={styles.chipParticipantText}>{u.name}{u.isAdmin ? " 👑" : ""} ✕</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}

            {notJoined.length > 0 && (
              <View style={{ marginTop: 8 }}>
                <Text style={styles.fieldLabel}>เพิ่มผู้เข้าร่วม</Text>
                <View style={styles.chipRow}>
                  {notJoined.map((u) => (
                    <Pressable
                      key={u._id}
                      onPress={async () => {
                        try {
                          await updateRound({ id: round._id, participantIds: [...round.participantIds, u._id] });
                          Toast.show({ type: "success", text1: `เพิ่ม ${u.name} แล้ว` });
                        } catch (e: any) { Toast.show({ type: "error", text1: e.message }); }
                      }}
                      style={styles.chip}
                    >
                      <Text style={styles.chipText}>+ {u.name}{u.isAdmin ? " 👑" : ""}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}

            <Pressable onPress={() => confirmClose(round._id, round.name)} style={[styles.btn, styles.btnDanger]}>
              <Text style={styles.btnDangerText}>🔒 ปิด Round นี้</Text>
            </Pressable>
          </View>
        );
      })}

      <Pressable
        onPress={() => setShowCreate((v) => !v)}
        style={[styles.btn, styles.btnGhost, { marginTop: 0, marginBottom: showCreate ? 10 : 0 }]}
      >
        <Text style={styles.btnGhostText}>{showCreate ? "▲ ซ่อน" : "➕ สร้าง Round ใหม่"}</Text>
      </Pressable>

      {showCreate && (
        <View style={styles.card}>
          <Text style={styles.fieldLabel}>ชื่อ Round</Text>
          <TextInput value={name} onChangeText={setName} placeholder="เช่น Round 5" style={styles.input} placeholderTextColor="#AAAACC" />

          <Text style={styles.fieldLabel}>Reward (ร้านบุฟเฟ่ต์)</Text>
          <TextInput value={reward} onChangeText={setReward} placeholder="เช่น ชาบู MK" style={styles.input} placeholderTextColor="#AAAACC" />

          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>Weight target/คน</Text>
              <TextInput value={weightTarget} onChangeText={setWeightTarget} keyboardType="numeric" style={styles.input} placeholderTextColor="#AAAACC" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>Cardio target/คน</Text>
              <TextInput value={cardioTarget} onChangeText={setCardioTarget} keyboardType="numeric" style={styles.input} placeholderTextColor="#AAAACC" />
            </View>
          </View>

          <Text style={styles.fieldLabel}>Participants ({selectedParticipants.length} คน)</Text>
          <View style={styles.chipRow}>
            {allUsers?.map((u) => {
              const sel = selectedParticipants.includes(u._id);
              return (
                <Pressable key={u._id} onPress={() => toggleParticipant(u._id)} style={sel ? styles.chipSelected : styles.chip}>
                  <Text style={sel ? styles.chipSelectedText : styles.chipText}>{u.name}{u.isAdmin ? " 👑" : ""}</Text>
                </Pressable>
              );
            })}
          </View>

          {selectedParticipants.length > 0 && (
            <Text style={styles.hint}>
              Group target: {selectedParticipants.length * Number(weightTarget)}W + {selectedParticipants.length * Number(cardioTarget)}C coins
            </Text>
          )}

          <Pressable onPress={handleCreate} disabled={loading} style={[styles.btn, styles.btnPrimary, { marginTop: 14 }]}>
            <Text style={styles.btnPrimaryText}>{loading ? "กำลังสร้าง..." : "สร้าง Round"}</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

function UsersTab() {
  const data = useQuery(api.admin.getAdminUsersPage, {});
  const promoteToAdmin = useMutation(api.users.promoteToAdmin);
  const revokeLog = useMutation(api.workoutLogs.revokeLog);
  const [revokingId, setRevokingId] = useState<Id<"workoutLogs"> | null>(null);
  const [revokeReason, setRevokeReason] = useState("");

  if (data === undefined) {
    return <ActivityIndicator color={C.gold} style={{ marginTop: 32 }} />;
  }
  if (!data) return null;

  const { users, logs, activities } = data;
  const activityMap = new Map(activities.map((a) => [a._id, a]));
  const userMap = new Map(users.map((u) => [u._id, u]));

  return (
    <View>
      <Text style={styles.sectionLabel}>MEMBERS ({users.length})</Text>
      {users.map((u) => (
        <View key={u._id} style={styles.card}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                <Text style={styles.userName}>{u.name}</Text>
                <View style={styles.lvBadge}><Text style={styles.lvBadgeText}>Lv.{u.level}</Text></View>
                {u.isAdmin && <Text style={styles.adminTag}>ADMIN</Text>}
              </View>
              <Text style={styles.userEmail} numberOfLines={1}>{u.email}</Text>
            </View>
            {!u.isAdmin && (
              <Pressable
                onPress={() => {
                  Alert.alert("Promote", `Promote "${u.name}" เป็น Admin ใช่ไหม?`, [
                    { text: "ยกเลิก", style: "cancel" },
                    {
                      text: "Promote",
                      onPress: async () => {
                        try {
                          await promoteToAdmin({ targetUserId: u._id });
                          Toast.show({ type: "success", text1: "Promoted!" });
                        } catch (e: any) { Toast.show({ type: "error", text1: e.message }); }
                      },
                    },
                  ]);
                }}
                style={styles.promoteBtn}
              >
                <Text style={styles.promoteBtnText}>MAKE ADMIN</Text>
              </Pressable>
            )}
          </View>
          <View style={{ flexDirection: "row", gap: 7 }}>
            <View style={styles.coinBadge}>
              <Text style={[styles.coinValue, { color: C.gold }]}>{(u.lifetimeWeightCoins ?? 0).toFixed(1)}</Text>
              <Text style={styles.coinLabel}> W</Text>
            </View>
            <View style={[styles.coinBadge, { backgroundColor: "rgba(240,62,85,0.12)" }]}>
              <Text style={[styles.coinValue, { color: C.red }]}>{(u.lifetimeCardioCoins ?? 0).toFixed(1)}</Text>
              <Text style={styles.coinLabel}> C</Text>
            </View>
          </View>
        </View>
      ))}

      {logs.length > 0 && (
        <>
          <Text style={[styles.sectionLabel, { marginTop: 8 }]}>WORKOUT LOGS</Text>
          {logs.map((log) => {
            const logUser = userMap.get(log.userId);
            const activity = activityMap.get(log.activityTypeId);
            const isRevoking = revokingId === log._id;
            return (
              <View key={log._id} style={[styles.logRow, log.status === "revoked" && styles.logRowRevoked]}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.logUser}>{logUser?.name} — {activity?.name}</Text>
                  <Text style={styles.logDetail}>
                    {log.metrics.value} {log.metrics.unit} → {log.coinsEarned.toFixed(1)} coin
                    {log.status === "revoked" && <Text style={{ color: C.red }}> (revoked)</Text>}
                  </Text>
                  {isRevoking && (
                    <View style={{ marginTop: 6, gap: 6 }}>
                      <TextInput
                        value={revokeReason}
                        onChangeText={setRevokeReason}
                        placeholder="เหตุผล..."
                        style={[styles.input, { marginBottom: 0 }]}
                        placeholderTextColor="#AAAACC"
                        autoFocus
                      />
                      <View style={{ flexDirection: "row", gap: 6 }}>
                        <Pressable
                          onPress={async () => {
                            try {
                              await revokeLog({ logId: log._id, reason: revokeReason || undefined });
                              Toast.show({ type: "success", text1: "Revoked" });
                              setRevokingId(null); setRevokeReason("");
                            } catch (e: any) { Toast.show({ type: "error", text1: e.message }); }
                          }}
                          style={[styles.btn, styles.btnDanger, { flex: 1, marginTop: 0 }]}
                        >
                          <Text style={styles.btnDangerText}>ยืนยัน Revoke</Text>
                        </Pressable>
                        <Pressable
                          onPress={() => { setRevokingId(null); setRevokeReason(""); }}
                          style={[styles.btn, styles.btnGhost, { flex: 1, marginTop: 0 }]}
                        >
                          <Text style={styles.btnGhostText}>ยกเลิก</Text>
                        </Pressable>
                      </View>
                    </View>
                  )}
                </View>
                {log.status === "auto_approved" && !isRevoking && (
                  <Pressable
                    onPress={() => { setRevokingId(log._id); setRevokeReason(""); }}
                    style={styles.revokeBtn}
                  >
                    <Text style={styles.revokeBtnText}>REVOKE</Text>
                  </Pressable>
                )}
              </View>
            );
          })}
        </>
      )}
    </View>
  );
}

export default function AdminScreen() {
  const user = useQuery(api.users.getCurrentUser);
  const [tab, setTab] = useState<AdminTab>("round");

  if (user === undefined) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator color={C.gold} size="large" />
      </SafeAreaView>
    );
  }

  if (!user?.isAdmin) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={{ color: C.muted, fontSize: 14 }}>คุณไม่มีสิทธิ์เข้าหน้านี้</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.tabBar}>
        {(["round", "users"] satisfies AdminTab[]).map((t) => (
          <Pressable key={t} onPress={() => setTab(t)} style={[styles.tabBtn, tab === t && styles.tabBtnActive]}>
            <Text style={[styles.tabBtnText, tab === t && styles.tabBtnTextActive]}>
              {t === "round" ? "ROUND" : "USERS"}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {tab === "round" && <RoundTab />}
        {tab === "users" && <UsersTab />}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, backgroundColor: C.bg, alignItems: "center", justifyContent: "center" },
  scroll: { padding: 14, paddingBottom: 40 },

  tabBar: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: C.border, backgroundColor: C.bg },
  tabBtn: { flex: 1, paddingVertical: 11, alignItems: "center", borderBottomWidth: 2, borderBottomColor: "transparent" },
  tabBtnActive: { borderBottomColor: C.gold },
  tabBtnText: { fontSize: 11, fontWeight: "800", color: "#AAAACC", letterSpacing: 0.8 },
  tabBtnTextActive: { color: C.gold },

  sectionLabel: { fontSize: 10, fontWeight: "800", color: "#AAAACC", letterSpacing: 1, marginBottom: 8 },

  card: {
    backgroundColor: C.white, borderRadius: 14, padding: 13,
    borderWidth: 1, borderColor: C.border, marginBottom: 10,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  cardTitle: { fontSize: 17, fontWeight: "800", color: C.dark, flex: 1, marginRight: 8 },
  cardSub: { fontSize: 12, color: C.muted },
  activeBadge: { backgroundColor: "rgba(30,154,66,0.12)", borderRadius: 99, paddingHorizontal: 9, paddingVertical: 3 },
  activeBadgeText: { color: "#1E9A42", fontSize: 10, fontWeight: "700" },

  fieldLabel: { fontSize: 11, fontWeight: "700", color: C.muted, marginBottom: 5, marginTop: 10 },
  input: {
    backgroundColor: C.bg, borderWidth: 1, borderColor: C.border,
    borderRadius: 9, paddingHorizontal: 11, paddingVertical: 9,
    fontSize: 14, color: C.dark,
  },
  hint: { fontSize: 11, color: "#AAAACC", marginTop: 6 },

  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  chip: {
    backgroundColor: "#ECEDF7", borderWidth: 1, borderColor: C.border,
    borderRadius: 99, paddingHorizontal: 11, paddingVertical: 5,
  },
  chipText: { fontSize: 12, color: C.muted },
  chipSelected: {
    backgroundColor: "rgba(217,155,0,0.12)", borderWidth: 1, borderColor: C.gold,
    borderRadius: 99, paddingHorizontal: 11, paddingVertical: 5,
  },
  chipSelectedText: { fontSize: 12, color: C.gold, fontWeight: "700" },
  chipParticipant: {
    backgroundColor: "rgba(30,154,66,0.10)", borderWidth: 1, borderColor: "rgba(30,154,66,0.3)",
    borderRadius: 99, paddingHorizontal: 11, paddingVertical: 5,
  },
  chipParticipantText: { fontSize: 12, color: "#1E9A42", fontWeight: "700" },

  btn: { borderRadius: 10, paddingVertical: 10, alignItems: "center", marginTop: 12 },
  btnPrimary: { backgroundColor: C.gold },
  btnPrimaryText: { color: C.dark, fontWeight: "800", fontSize: 14 },
  btnGhost: { borderWidth: 1, borderColor: C.border, backgroundColor: C.white },
  btnGhostText: { color: C.muted, fontWeight: "700", fontSize: 13 },
  btnDanger: { borderWidth: 1, borderColor: "rgba(240,62,85,0.3)", backgroundColor: "rgba(240,62,85,0.08)" },
  btnDangerText: { color: C.red, fontWeight: "700", fontSize: 13 },

  userName: { fontSize: 14, fontWeight: "700", color: C.dark },
  userEmail: { fontSize: 11, color: "#AAAACC", marginTop: 1 },
  lvBadge: { backgroundColor: "#E0E1EF", borderRadius: 99, paddingHorizontal: 8, paddingVertical: 2 },
  lvBadgeText: { fontSize: 11, fontWeight: "700", color: C.muted },
  adminTag: { fontSize: 10, fontWeight: "800", color: C.gold, letterSpacing: 0.5 },
  promoteBtn: { backgroundColor: "#ECEDF7", borderWidth: 1, borderColor: C.border, borderRadius: 7, paddingHorizontal: 8, paddingVertical: 5, flexShrink: 0 },
  promoteBtnText: { fontSize: 10, fontWeight: "700", color: C.muted },
  coinBadge: { flex: 1, backgroundColor: "rgba(217,155,0,0.12)", borderRadius: 8, padding: 7, flexDirection: "row", alignItems: "baseline", justifyContent: "center" },
  coinValue: { fontSize: 15, fontWeight: "800" },
  coinLabel: { fontSize: 10, color: "#AAAACC" },

  logRow: {
    backgroundColor: C.white, borderRadius: 10, padding: 11, marginBottom: 7,
    borderWidth: 1, borderColor: C.border,
    flexDirection: "row", alignItems: "flex-start", gap: 8,
  },
  logRowRevoked: { backgroundColor: "rgba(240,62,85,0.04)", borderColor: "rgba(240,62,85,0.3)" },
  logUser: { fontSize: 13, fontWeight: "700", color: C.dark },
  logDetail: { fontSize: 12, color: C.muted, marginTop: 2 },
  revokeBtn: { backgroundColor: "rgba(240,62,85,0.12)", borderWidth: 1, borderColor: "rgba(240,62,85,0.3)", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, flexShrink: 0 },
  revokeBtnText: { color: C.red, fontSize: 11, fontWeight: "700" },
});
