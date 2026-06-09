import { useConvexAuth } from "convex/react";
import { Redirect, Stack } from "expo-router";
import { ActivityIndicator, View } from "react-native";

export default function AuthLayout() {
  const { isAuthenticated, isLoading } = useConvexAuth();

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: "#F4F5FA", alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color="#D99B00" size="large" />
      </View>
    );
  }

  if (isAuthenticated) {
    return <Redirect href="/(app)/dashboard" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
