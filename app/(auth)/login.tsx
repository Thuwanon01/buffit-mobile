import { useAuthActions } from "@convex-dev/auth/react";
import { Link } from "expo-router";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
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

export default function LoginScreen() {
  const { signIn } = useAuthActions();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleEmailLogin() {
    if (!email || !password) {
      Alert.alert("ข้อผิดพลาด", "กรุณากรอกอีเมลและรหัสผ่าน");
      return;
    }
    setLoading(true);
    try {
      await signIn("password", { email, password, flow: "signIn" });
    } catch {
      Alert.alert("เข้าสู่ระบบล้มเหลว", "อีเมลหรือรหัสผ่านไม่ถูกต้อง");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setLoading(true);
    try {
      const redirectUri = Linking.createURL("/");
      const result = await signIn("google", { redirectTo: redirectUri });
      if (!result.redirect) return;

      const browserResult = await WebBrowser.openAuthSessionAsync(
        result.redirect.toString(),
        redirectUri
      );

      if (browserResult.type !== "success" || !browserResult.url) return;

      const parsed = Linking.parse(browserResult.url);
      const code = parsed.queryParams?.["code"] as string | undefined;

      if (!code) {
        Alert.alert("เกิดข้อผิดพลาด", "ไม่พบ code จาก Google OAuth กรุณาลองอีกครั้ง");
        return;
      }

      await signIn("google", { code });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      Alert.alert("เกิดข้อผิดพลาด", msg);
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
          {/* Logo */}
          <View style={styles.logoWrap}>
            <Text style={styles.logoEmoji}>💪</Text>
            <Text style={styles.logoText}>BUFFIT</Text>
            <Text style={styles.tagline}>Buff up. Get fit. Eat buffet.</Text>
          </View>

          {/* Auth card */}
          <View style={styles.card}>
            {/* Google */}
            <Pressable
              onPress={handleGoogle}
              disabled={loading}
              style={({ pressed }) => [styles.googleBtn, pressed && styles.pressed]}
            >
              <Text style={styles.googleIcon}>G</Text>
              <Text style={styles.googleText}>Sign in with Google</Text>
            </Pressable>

            {/* Divider */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerLabel}>หรือใช้อีเมล</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Email */}
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

            {/* Password */}
            <Text style={styles.label}>รหัสผ่าน</Text>
            <TextInput
              style={styles.input}
              placeholder="••••••••"
              placeholderTextColor="#AAAACC"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />

            {/* Submit */}
            <Pressable
              onPress={handleEmailLogin}
              disabled={loading}
              style={({ pressed }) => [styles.submitBtn, pressed && styles.pressed]}
            >
              {loading ? (
                <ActivityIndicator color={DARK} />
              ) : (
                <Text style={styles.submitText}>เข้าสู่ระบบ</Text>
              )}
            </Pressable>

            {/* Signup link */}
            <View style={styles.footer}>
              <Text style={styles.footerText}>ยังไม่มีบัญชี?{" "}</Text>
              <Link href="/(auth)/signup" style={styles.footerLink}>
                สมัครสมาชิก
              </Link>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  kav: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: "center", padding: 22 },

  logoWrap: { alignItems: "center", marginBottom: 34 },
  logoEmoji: { fontSize: 80, lineHeight: 96 },
  logoText: { fontSize: 36, fontWeight: "800", color: GOLD, letterSpacing: 2, marginTop: 8 },
  tagline: { fontSize: 13, color: MUTED, marginTop: 4 },

  card: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 22,
    borderWidth: 1,
    borderColor: BORDER,
    shadowColor: DARK,
    shadowOpacity: 0.07,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },

  googleBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    paddingVertical: 12,
    marginBottom: 18,
  },
  googleIcon: { fontSize: 16, fontWeight: "800", color: "#4285F4" },
  googleText: { fontSize: 14, fontWeight: "700", color: DARK },

  divider: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 18 },
  dividerLine: { flex: 1, height: 1, backgroundColor: BORDER },
  dividerLabel: { fontSize: 12, color: "#AAAACC" },

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
    marginTop: 4,
  },
  submitText: { fontSize: 16, fontWeight: "800", color: DARK },

  pressed: { opacity: 0.75 },

  footer: { flexDirection: "row", justifyContent: "center", marginTop: 16 },
  footerText: { fontSize: 13, color: "#AAAACC" },
  footerLink: { fontSize: 13, color: GOLD, fontWeight: "700" },
});
