import { useAuthActions } from "@convex-dev/auth/react";
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

const GOLD = "#D99B00";
const BG = "#F4F5FA";
const DARK = "#1A1A2E";
const MUTED = "#6A6A98";
const BORDER = "#E0E1EF";
const INPUT_BG = "#ECEDF7";

export default function SignupScreen() {
  const { signIn } = useAuthActions();
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function handleSubmit() {
    if (!name.trim()) { Alert.alert("กรุณากรอกชื่อ"); return; }
    if (!email.trim()) { Alert.alert("กรุณากรอกอีเมล"); return; }
    if (password.length < 8) { Alert.alert("ข้อผิดพลาด", "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร"); return; }
    setLoading(true);
    try {
      await signIn("password", { email, password, name, flow: "signUp" });
      router.replace("/(auth)/setup");
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
              onPress={() => router.push("/(auth)/login")}
              style={styles.backBtn}
            >
              <Text style={styles.backText}>←</Text>
            </Pressable>
            <Text style={styles.headerTitle}>สมัครสมาชิก</Text>
          </View>

          <View style={styles.card}>
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
              onPress={handleSubmit}
              disabled={loading}
              style={({ pressed }) => [styles.submitBtn, pressed && styles.pressed]}
            >
              {loading ? (
                <ActivityIndicator color={DARK} />
              ) : (
                <Text style={styles.submitText}>สมัครสมาชิก 🎉</Text>
              )}
            </Pressable>
          </View>

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

  card: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: BORDER,
  },

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

  submitBtn: {
    backgroundColor: GOLD,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
  },
  submitText: { fontSize: 15, fontWeight: "800", color: DARK },
  pressed: { opacity: 0.75 },

  loginRow: { flexDirection: "row", justifyContent: "center", marginTop: 20 },
  footerText: { fontSize: 13, color: "#AAAACC" },
  footerLink: { fontSize: 13, color: GOLD, fontWeight: "700" },
});
