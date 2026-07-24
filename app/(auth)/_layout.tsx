import { useConvexAuth, useQuery } from "convex/react";
import { Redirect, Stack, useSegments } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { api } from "../../convex/_generated/api";

export default function AuthLayout() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const user = useQuery(api.users.getCurrentUser, isAuthenticated ? {} : "skip");
  const segments = useSegments();
  const onSetup = segments[segments.length - 1] === "setup";

  if (isLoading || (isAuthenticated && user === undefined)) {
    return (
      <View style={{ flex: 1, backgroundColor: "#F4F5FA", alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color="#D99B00" size="large" />
      </View>
    );
  }

  if (isAuthenticated && user !== undefined && user !== null) {
    if (user.profileCompleted) {
      return <Redirect href="/(app)/dashboard" />;
    }
    // Incomplete profile → go to setup, but ONLY if we are not already on it.
    // setup.tsx is a child of the <Stack> rendered below; returning a <Redirect>
    // to /(auth)/setup while on that route would re-enter this layout and loop
    // forever, so the setup form could never mount. Falling through to <Stack>
    // when already on setup lets the form render.
    if (!onSetup) {
      return <Redirect href="/(auth)/setup" />;
    }
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
