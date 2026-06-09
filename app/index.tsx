import { useConvexAuth } from "convex/react";
import { Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";

export default function Index() {
  const { isAuthenticated, isLoading } = useConvexAuth();

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: "#F4F5FA", alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color="#D99B00" size="large" />
      </View>
    );
  }

  return <Redirect href={isAuthenticated ? "/(app)/dashboard" : "/(auth)/login"} />;
}
