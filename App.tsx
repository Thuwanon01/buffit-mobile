import { ConvexProvider, ConvexReactClient } from "convex/react";
import { StatusBar } from "expo-status-bar";
import { DashboardScreen } from "./src/screens/DashboardScreen";

const convex = new ConvexReactClient(process.env.EXPO_PUBLIC_CONVEX_URL!);

export default function App() {
  return (
    <ConvexProvider client={convex}>
      <StatusBar style="auto" />
      <DashboardScreen />
    </ConvexProvider>
  );
}
