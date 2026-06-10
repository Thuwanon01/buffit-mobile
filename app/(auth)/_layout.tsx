import { useConvexAuth, useQuery } from "convex/react";
import { Redirect, Stack } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { api } from "../../convex/_generated/api";

export default function AuthLayout() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const user = useQuery(api.users.getCurrentUser, isAuthenticated ? {} : "skip");

  if (isLoading || (isAuthenticated && user === undefined)) {
    return (
      <View style={{ flex: 1, backgroundColor: "#F4F5FA", alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color="#D99B00" size="large" />
      </View>
    );
  }

  // Only bounce to the app if the profile is complete — otherwise let the
  // (app) layout's redirect to /(auth)/setup land here without looping back.
  if (isAuthenticated && user?.profileCompleted) {
    return <Redirect href="/(app)/dashboard" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
