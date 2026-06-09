import { useAuthActions } from "@convex-dev/auth/react";
import { useMutation } from "convex/react";
import { Link, useRouter } from "expo-router";
import { useState } from "react";
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
  { value: "health", label: "สุขภาพดี" },
  { value: "endurance", label: "เพิ่มความทนทาน" },
];

type Step = "account" | "profile";

export default function SignupScreen() {
  const { signIn } = useAuthActions();
  const createProfile = useMutation(api.users.createOrUpdateProfile);
  const router = useRouter();

  const [step, setStep] = useState<Step>("account");
  const [loading, setLoading] = useState(false);

  // Step 1 fields
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Step 2 fields
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [fitnessLevel, setFitnessLevel] = useState("");
  const [weeklyFrequency, setWeeklyFrequency] = useState("");
  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);
  const [medicalConditions, setMedicalConditions] = useState("");

  function toggleGoal(goal: string) {
    setSelectedGoals((prev) =>
      prev.includes(goal) ? prev.filter((g) => g !== goal) : [...prev, goal]
    );
  }

  function handleAccountNext() {
    if (!name.trim()) { Alert.alert("กรุณากรอกชื่อ"); return; }
    if (!email.trim()) { Alert.alert("กรุณากรอกอีเมล"); return; }
    if (password.length < 8) { Alert.alert("ข้อผิดพลาด", "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร"); return; }
    setStep("profile");
  }

  async function handleProfileSubmit() {
    setLoading(true);
    try {
      await signIn("password", { email, password, name, flow: "signUp" });
      await createProfile({
        name,
        email,
        age: age ? Number(age) : undefined,
        gender: gender || undefined,
        weightKg: weightKg ? Number(weightKg) : undefined,
        heightCm: heightCm ? Number(heightCm) : undefined,
        fitnessLevel: fitnessLevel || undefined,
        weeklyFrequency: weeklyFrequency ? Number(weeklyFrequency) : undefined,
        goals: selectedGoals.length > 0 ? selectedGoals : undefined,
        medicalConditions: medicalConditions || undefined,
      });
      router.replace("/(app)/dashboard");
    } catch (err: any) {
      Alert.alert("เกิดข้อผิดพลาด", err.message || "กรุณาลองใหม่อีกครั้ง");
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.kav}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <Pressable
              onPress={() => step === "account" ? router.push("/(auth)/login") : setStep("account")}
              style={styles.backBtn}
            >
              <Text style={styles.backText}>←</Text>
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerTitle}>สมัครสมาชิก</Text>
              <Text style={styles.headerSub}>ขั้นตอน {step === "account" ? 1 : 2} / 2</Text>
            </View>
            {/* Step dots */}
            <View style={styles.dots}>
              {[1, 2].map((s) => {
                const active = (step === "account" && s === 1) || (step === "profile" && s === 2);
                return (
                  <View
                    key={s}
                    style={[styles.dot, active ? styles.dotActive : styles.dotInactive]}
                  />
                );
              })}
            </View>
          </View>

          {step === "account" ? (
            <View style={styles.card}>
              <Text style={styles.stepLabel}>STEP 1 — บัญชีของคุณ</Text>

              <Text style={styles.label}>ชื่อ</Text>
              <TextInput
                style={styles.input}
                placeholder="ชื่อเล่นหรือชื่อจริง"
                placeholderTextColor="#AAAACC"
                value={name}
                onChangeText={setName}
              />

              <Text style={styles.label}>อีเมล</Text>
              <TextInput
                style={styles.input}
                placeholder="your@email.com"
                placeholderTextColor="#AAAACC"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
              />

              <Text style={styles.label}>รหัสผ่าน</Text>
              <TextInput
                style={[styles.input, { marginBottom: 20 }]}
                placeholder="อย่างน้อย 8 ตัว"
                placeholderTextColor="#AAAACC"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />

              <Pressable
                onPress={handleAccountNext}
                style={({ pressed }) => [styles.submitBtn, pressed && styles.pressed]}
              >
                <Text style={styles.submitText}>ถัดไป →</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.card}>
              <Text style={styles.stepLabel}>STEP 2 — โปรไฟล์สำหรับ AI</Text>

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
                  <Text style={styles.label}>เพศ</Text>
                  <View style={styles.pickerRow}>
                    {["ชาย", "หญิง", "อื่นๆ"].map((g, i) => {
                      const val = ["male", "female", "other"][i];
                      return (
                        <Pressable
                          key={val}
                          onPress={() => setGender(val)}
                          style={[styles.chip, gender === val && styles.chipActive]}
                        >
                          <Text style={[styles.chipText, gender === val && styles.chipTextActive]}>
                            {g}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              </View>

              <View style={styles.row2}>
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
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>ส่วนสูง (cm)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="170"
                    placeholderTextColor="#AAAACC"
                    value={heightCm}
                    onChangeText={setHeightCm}
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>

              <Text style={styles.label}>ระดับฟิตเนส</Text>
              <View style={[styles.pickerRow, { marginBottom: 12, flexWrap: "wrap" }]}>
                {[
                  { val: "beginner", label: "มือใหม่" },
                  { val: "intermediate", label: "ปานกลาง" },
                  { val: "advanced", label: "ขั้นสูง" },
                ].map(({ val, label }) => (
                  <Pressable
                    key={val}
                    onPress={() => setFitnessLevel(val)}
                    style={[styles.chip, fitnessLevel === val && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, fitnessLevel === val && styles.chipTextActive]}>
                      {label}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text style={styles.label}>ออกกำลังกาย (วัน/สัปดาห์)</Text>
              <View style={[styles.pickerRow, { marginBottom: 12, flexWrap: "wrap" }]}>
                {[0, 1, 2, 3, 4, 5, 6, 7].map((d) => (
                  <Pressable
                    key={d}
                    onPress={() => setWeeklyFrequency(String(d))}
                    style={[styles.chip, weeklyFrequency === String(d) && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, weeklyFrequency === String(d) && styles.chipTextActive]}>
                      {d}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text style={styles.label}>เป้าหมาย</Text>
              <View style={[styles.pickerRow, { marginBottom: 12, flexWrap: "wrap" }]}>
                {GOALS.map((g) => (
                  <Pressable
                    key={g.value}
                    onPress={() => toggleGoal(g.value)}
                    style={[styles.chip, selectedGoals.includes(g.value) && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, selectedGoals.includes(g.value) && styles.chipTextActive]}>
                      {g.label}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text style={styles.label}>โรคประจำตัว (ถ้ามี)</Text>
              <TextInput
                style={[styles.input, styles.textarea]}
                placeholder="เช่น หัวเข่าอักเสบ, เก๊าท์..."
                placeholderTextColor="#AAAACC"
                value={medicalConditions}
                onChangeText={setMedicalConditions}
                multiline
                numberOfLines={3}
              />

              <View style={[styles.row2, { marginTop: 4 }]}>
                <Pressable
                  onPress={() => setStep("account")}
                  style={({ pressed }) => [styles.backBtnCard, pressed && styles.pressed]}
                >
                  <Text style={styles.backBtnCardText}>← ย้อนกลับ</Text>
                </Pressable>
                <Pressable
                  onPress={handleProfileSubmit}
                  disabled={loading}
                  style={({ pressed }) => [styles.submitBtn, { flex: 1 }, pressed && styles.pressed]}
                >
                  {loading ? (
                    <ActivityIndicator color={DARK} />
                  ) : (
                    <Text style={styles.submitText}>สมัครสมาชิก 🎉</Text>
                  )}
                </Pressable>
              </View>
            </View>
          )}

          <View style={styles.loginRow}>
            <Text style={styles.footerText}>มีบัญชีแล้ว?{" "}</Text>
            <Link href="/(auth)/login" style={styles.footerLink}>เข้าสู่ระบบ</Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  kav: { flex: 1 },
  scroll: { flexGrow: 1, padding: 20 },

  header: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 22 },
  backBtn: { padding: 4 },
  backText: { fontSize: 22, color: MUTED },
  headerTitle: { fontSize: 22, fontWeight: "800", color: DARK },
  headerSub: { fontSize: 11, color: "#AAAACC", marginTop: 1 },
  dots: { flexDirection: "row", gap: 5 },
  dot: { height: 8, borderRadius: 99 },
  dotActive: { width: 22, backgroundColor: GOLD },
  dotInactive: { width: 8, backgroundColor: BORDER },

  card: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: BORDER,
  },
  stepLabel: { fontSize: 12, fontWeight: "700", color: "#AAAACC", letterSpacing: 1, marginBottom: 16 },

  label: { fontSize: 11, color: MUTED, fontWeight: "600", letterSpacing: 0.4, marginBottom: 5 },
  input: {
    backgroundColor: INPUT_BG,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 10,
    paddingHorizontal: 13,
    paddingVertical: 10,
    fontSize: 14,
    color: DARK,
    marginBottom: 12,
  },
  textarea: { height: 58, textAlignVertical: "top" },

  row2: { flexDirection: "row", gap: 10 },

  pickerRow: { flexDirection: "row", gap: 6 },
  chip: {
    backgroundColor: INPUT_BG,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 99,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginBottom: 6,
  },
  chipActive: { backgroundColor: "rgba(217,155,0,0.12)", borderColor: GOLD },
  chipText: { fontSize: 12, color: MUTED },
  chipTextActive: { color: GOLD, fontWeight: "700" },

  submitBtn: {
    backgroundColor: GOLD,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
  },
  submitText: { fontSize: 15, fontWeight: "800", color: DARK },
  pressed: { opacity: 0.75 },

  backBtnCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: "center",
  },
  backBtnCardText: { fontSize: 14, fontWeight: "600", color: MUTED },

  loginRow: { flexDirection: "row", justifyContent: "center", marginTop: 20 },
  footerText: { fontSize: 13, color: "#AAAACC" },
  footerLink: { fontSize: 13, color: GOLD, fontWeight: "700" },
});
