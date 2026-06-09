import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth, useQuery } from "convex/react";
import { Redirect, Tabs, useRouter } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, Alert, Pressable, Text, View } from "react-native";
import { api } from "../../convex/_generated/api";

const GOLD = "#D99B00";
const INACTIVE = "#9CA3AF";
const DARK = "#1A1A2E";
const MUTED = "#6A6A98";

function HeaderLeft({ level }: { level?: number | null }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 7, marginLeft: 16 }}>
      <Text style={{ fontSize: 18, fontWeight: "800", color: GOLD, letterSpacing: 1 }}>💪 BUFFIT</Text>
      {level != null && (
        <View style={{ backgroundColor: "#E0E1EF", borderRadius: 99, paddingHorizontal: 8, paddingVertical: 2 }}>
          <Text style={{ fontSize: 11, fontWeight: "700", color: MUTED }}>Lv.{level}</Text>
        </View>
      )}
    </View>
  );
}

function HeaderRight({ isAdmin, onSignOut, onAdmin }: { isAdmin?: boolean; onSignOut: () => void; onAdmin: () => void }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginRight: 12 }}>
      {isAdmin && (
        <Pressable
          onPress={onAdmin}
          hitSlop={8}
          style={({ pressed }) => ({
            opacity: pressed ? 0.6 : 1,
            borderWidth: 1, borderColor: "#E0E1EF", borderRadius: 7,
            paddingHorizontal: 9, paddingVertical: 4,
          })}
        >
          <Text style={{ fontSize: 11, fontWeight: "700", color: MUTED }}>ADMIN ⚙️</Text>
        </Pressable>
      )}
      <Pressable
        onPress={onSignOut}
        hitSlop={8}
        style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
      >
        <Text style={{ fontSize: 20, color: MUTED }}>⏏</Text>
      </Pressable>
    </View>
  );
}

export default function AppLayout() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { signOut } = useAuthActions();
  const user = useQuery(
    api.users.getCurrentUser,
    isAuthenticated ? {} : "skip"
  );

  // Client has a token but server can't resolve the session → sign out to reset
  useEffect(() => {
    if (!isLoading && isAuthenticated && user === null) {
      signOut().catch(console.error);
    }
  }, [isLoading, isAuthenticated, user, signOut]);

  // Loading: auth state resolving or user record loading
  if (isLoading || (isAuthenticated && user === undefined)) {
    return (
      <View style={{ flex: 1, backgroundColor: "#F4F5FA", alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={GOLD} size="large" />
      </View>
    );
  }

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  // Authenticated but profile not completed → go to setup
  if (user !== null && user !== undefined && !user.profileCompleted) {
    return <Redirect href="/(auth)/setup" />;
  }

  function handleSignOut() {
    Alert.alert("ออกจากระบบ", "ต้องการออกจากระบบใช่ไหม?", [
      { text: "ยกเลิก", style: "cancel" },
      { text: "ออกจากระบบ", style: "destructive", onPress: () => signOut().catch(console.error) },
    ]);
  }

  function handleAdmin() {
    router.push("/(app)/admin");
  }

  const headerLeft = () => <HeaderLeft level={user?.level} />;
  const headerRight = () => <HeaderRight isAdmin={user?.isAdmin} onSignOut={handleSignOut} onAdmin={handleAdmin} />;

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        headerLeft,
        headerRight,
        headerStyle: { backgroundColor: "#FFFFFF" },
        headerShadowVisible: true,
        headerTitle: "",
        tabBarActiveTintColor: GOLD,
        tabBarInactiveTintColor: INACTIVE,
        tabBarStyle: {
          backgroundColor: "#fff",
          borderTopColor: "#E5E7EB",
        },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: "หน้าหลัก",
          tabBarLabel: "หน้าหลัก",
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 18, color }}>🏠</Text>,
        }}
      />
      <Tabs.Screen
        name="log"
        options={{
          title: "บันทึก",
          tabBarLabel: "บันทึก",
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 18, color }}>➕</Text>,
        }}
      />
      <Tabs.Screen
        name="leaderboard"
        options={{
          title: "อันดับ",
          tabBarLabel: "อันดับ",
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 18, color }}>🏆</Text>,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: "ประวัติ",
          tabBarLabel: "ประวัติ",
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 18, color }}>📋</Text>,
        }}
      />
      <Tabs.Screen
        name="admin"
        options={{
          title: "Admin",
          href: null,
        }}
      />
    </Tabs>
  );
}
