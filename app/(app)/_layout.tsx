import { useConvexAuth, useQuery } from "convex/react";
import { Redirect, Tabs } from "expo-router";
import { ActivityIndicator, Text, View } from "react-native";
import { api } from "../../convex/_generated/api";

const GOLD = "#D99B00";
const INACTIVE = "#9CA3AF";

export default function AppLayout() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const user = useQuery(
    api.users.getCurrentUser,
    isAuthenticated ? {} : "skip"
  );

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

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
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
    </Tabs>
  );
}
