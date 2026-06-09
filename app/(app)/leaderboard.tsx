import { SafeAreaView, Text, StyleSheet } from "react-native";

export default function LeaderboardScreen() {
  return (
    <SafeAreaView style={styles.center}>
      <Text style={styles.text}>Leaderboard — Phase 4</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#F4F5FA" },
  text: { fontSize: 16, color: "#888" },
});
