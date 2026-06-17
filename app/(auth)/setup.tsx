import { useMutation, useQuery } from "convex/react";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import { api } from "../../convex/_generated/api";

const GOLD = "#D99B00";
const BG = "#F4F5FA";
const DARK = "#1A1A2E";
const MUTED = "#6A6A98";
const BORDER = "#E0E1EF";
const INPUT_BG = "#ECEDF7";

const GOALS = [
  { value: "weight_loss", label: "ลดน้ำหนัก" },
  { value: "muscle_gain", label: "เพิ่มกล้ามเนื้อ" },
  { value: "health", label: "สุขภาพดีขึ้น" },
];

export default function SetupScreen() {
  const user = useQuery(api.users.getCurrentUser);
  const createOrUpdateProfile = useMutation(api.users.createOrUpdateProfile);
  const router = useRouter();

  const [name, setName] = useState("");
  const [nameInitialized, setNameInitialized] = useState(false);
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [fitnessLevel, setFitnessLevel] = useState("");
  const [weeklyFrequency, setWeeklyFrequency] = useState("");
  const [goals, setGoals] = useState<string[]>([]);
  const [medicalConditions, setMedicalConditions] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user?.name && !nameInitialized) {
      setName(user.name);
      setNameInitialized(true);
    }
  }, [user?.name, nameInitialized]);

  if (user === undefined) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator color={GOLD} size="large" />
      </SafeAreaView>
    );
  }

  async function handleSubmit() {
    if (!name.trim()) { Alert.alert("กรุณากรอกชื่อ"); return; }
    setLoading(true);
    try {
      await createOrUpdateProfile({
        name,
        email: user?.email ?? "",
        age: age ? Number(age) : undefined,
        gender: gender || undefined,
        weightKg: weightKg ? Number(weightKg) : undefined,
        heightCm: heightCm ? Number(heightCm) : undefined,
        fitnessLevel: fitnessLevel || undefined,
        weeklyFrequency: weeklyFrequency ? Number(weeklyFrequency) : undefined,
        goals: goals.length > 0 ? goals : undefined,
        medicalConditions: medicalConditions || undefined,
      });
      router.replace("/(app)/dashboard");
    } catch (err: any) {
      Alert.alert("เกิดข้อผิดพลาด", err.message || "กรุณาลองใหม่อีกครั้ง");
    } finally {
      setLoading(false);
    }
  }

  function toggleGoal(g: string) {
    setGoals((prev) => prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]);
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.logo}>💪 BUFFIT</Text>
          <Text style={styles.title}>ตั้งค่าโปรไฟล์</Text>
          <Text style={styles.sub}>ช่วยให้ AI Coach แนะนำได้แม่นขึ้น</Text>

          <View style={styles.card}>
            <Text style={styles.label}>ชื่อ *</Text>
            <TextInput
              style={styles.input}
              placeholder={user?.name ?? "ชื่อเล่นหรือชื่อจริง"}
              placeholderTextColor="#AAAACC"
              value={name}
              onChangeText={setName}
            />

            <View style={styles.row2}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>อายุ</Text>
                <TextInput
                  style={styles.input}
                  placeholder="25"
                  placeholderTextColor="#AAAACC"
                  value={age}
                  onChangeText={setAge}
                  keyboardType="number-pad"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>น้ำหนัก (kg)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="65"
                  placeholderTextColor="#AAAACC"
                  value={weightKg}
                  onChangeText={setWeightKg}
                  keyboardType="decimal-pad"
                />
              </View>
            </View>

            <Text style={styles.label}>เพศ</Text>
            <View style={[styles.chipRow, { marginBottom: 12 }]}>
              {[{ val: "male", label: "ชาย" }, { val: "female", label: "หญิง" }, { val: "other", label: "อื่นๆ" }].map(({ val, label }) => (
                <Pressable key={val} onPress={() => setGender(val)}
                  style={[styles.chip, gender === val && styles.chipActive]}>
                  <Text style={[styles.chipText, gender === val && styles.chipTextActive]}>{label}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.label}>ระดับฟิตเนส</Text>
            <View style={[styles.chipRow, { marginBottom: 12 }]}>
              {[{ val: "beginner", label: "มือใหม่" }, { val: "intermediate", label: "ปานกลาง" }, { val: "advanced", label: "ขั้นสูง" }].map(({ val, label }) => (
                <Pressable key={val} onPress={() => setFitnessLevel(val)}
                  style={[styles.chip, fitnessLevel === val && styles.chipActive]}>
                  <Text style={[styles.chipText, fitnessLevel === val && styles.chipTextActive]}>{label}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.label}>เป้าหมาย</Text>
            <View style={[styles.chipRow, { marginBottom: 12, flexWrap: "wrap" }]}>
              {GOALS.map((g) => (
                <Pressable key={g.value} onPress={() => toggleGoal(g.value)}
                  style={[styles.chip, goals.includes(g.value) && styles.chipActive]}>
                  <Text style={[styles.chipText, goals.includes(g.value) && styles.chipTextActive]}>{g.label}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.label}>โรคประจำตัว (ถ้ามี)</Text>
            <TextInput
              style={[styles.input, { height: 58, textAlignVertical: "top", marginBottom: 20 }]}
              placeholder="เช่น หัวเข่าอักเสบ, เก๊าท์..."
              placeholderTextColor="#AAAACC"
              value={medicalConditions}
              onChangeText={setMedicalConditions}
              multiline
              numberOfLines={3}
            />

            <Pressable
              onPress={handleSubmit}
              disabled={loading}
              style={({ pressed }) => [styles.submitBtn, pressed && { opacity: 0.75 }]}
            >
              {loading ? (
                <ActivityIndicator color={DARK} />
              ) : (
                <Text style={styles.submitText}>เริ่มใช้งาน BUFFIT 💪</Text>
              )}
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  center: { flex: 1, backgroundColor: BG, alignItems: "center", justifyContent: "center" },
  scroll: { padding: 22, paddingBottom: 40 },

  logo: { fontSize: 24, fontWeight: "800", color: GOLD, marginBottom: 4 },
  title: { fontSize: 22, fontWeight: "800", color: DARK },
  sub: { fontSize: 13, color: MUTED, marginTop: 2, marginBottom: 24 },

  card: { backgroundColor: "#fff", borderRadius: 18, padding: 20, borderWidth: 1, borderColor: BORDER },
  row2: { flexDirection: "row", gap: 10 },

  label: { fontSize: 11, color: MUTED, fontWeight: "600", letterSpacing: 0.4, marginBottom: 5 },
  input: {
    backgroundColor: INPUT_BG, borderWidth: 1, borderColor: BORDER,
    borderRadius: 10, paddingHorizontal: 13, paddingVertical: 10,
    fontSize: 14, color: DARK, marginBottom: 12,
  },

  chipRow: { flexDirection: "row", gap: 6 },
  chip: { backgroundColor: INPUT_BG, borderWidth: 1, borderColor: BORDER, borderRadius: 99, paddingHorizontal: 10, paddingVertical: 5, marginBottom: 6 },
  chipActive: { backgroundColor: "rgba(217,155,0,0.12)", borderColor: GOLD },
  chipText: { fontSize: 12, color: MUTED },
  chipTextActive: { color: GOLD, fontWeight: "700" },

  submitBtn: { backgroundColor: GOLD, borderRadius: 12, paddingVertical: 13, alignItems: "center" },
  submitText: { fontSize: 16, fontWeight: "800", color: DARK },
});
