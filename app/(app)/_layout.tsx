import { Tabs } from "expo-router";

const GOLD = "#D99B00";
const INACTIVE = "#9CA3AF";

export default function AppLayout() {
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
      <Tabs.Screen name="dashboard" options={{ title: "หน้าหลัก", tabBarLabel: "หน้าหลัก" }} />
      <Tabs.Screen name="log" options={{ title: "บันทึก", tabBarLabel: "บันทึก" }} />
      <Tabs.Screen name="leaderboard" options={{ title: "อันดับ", tabBarLabel: "อันดับ" }} />
      <Tabs.Screen name="history" options={{ title: "ประวัติ", tabBarLabel: "ประวัติ" }} />
    </Tabs>
  );
}
