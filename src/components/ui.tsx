import { Pressable, StyleSheet, Text, View } from "react-native";
import type { Id } from "../../convex/_generated/dataModel";

// Matt Pocock: satisfies enforces shape without widening literals
const AVATAR_COLORS = [
  "#D99B00", "#F03E55", "#1E9A42", "#5B7FFA",
  "#A855F7", "#EC4899", "#14B8A6",
] satisfies string[];

// ─── ProgressBar ─────────────────────────────────────────────────────────────

export function ProgressBar({
  value,
  max,
  color,
}: {
  value: number;
  max: number;
  color: string;
}) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <View style={styles.track}>
      <View style={[styles.fill, { width: `${pct}%`, backgroundColor: color }]} />
    </View>
  );
}

// ─── CoinProgressRow ─────────────────────────────────────────────────────────

export function CoinProgressRow({
  label,
  value,
  max,
  type,
}: {
  label: string;
  value: number;
  max: number;
  type: "weight" | "cardio";
}) {
  const color = type === "weight" ? "#D99B00" : "#F03E55";
  const emoji = type === "weight" ? "💪" : "🏃";
  return (
    <View style={styles.coinRow}>
      <View style={styles.coinRowHeader}>
        <Text style={styles.coinRowLabel}>{emoji} {label}</Text>
        <Text style={[styles.coinRowValue, { color }]}>
          {value.toFixed(2)}
          <Text style={styles.coinRowMax}> / {max}</Text>
        </Text>
      </View>
      <ProgressBar value={value} max={max} color={color} />
    </View>
  );
}

// ─── Avatar ──────────────────────────────────────────────────────────────────

export function Avatar({ name, size = 34 }: { name: string; size?: number }) {
  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase();
  const colorIndex =
    name.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0) %
    AVATAR_COLORS.length;
  return (
    <View
      style={[
        styles.avatar,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: AVATAR_COLORS[colorIndex],
        },
      ]}
    >
      <Text style={[styles.avatarText, { fontSize: size * 0.38 }]}>
        {initials}
      </Text>
    </View>
  );
}

// ─── RoundPicker ─────────────────────────────────────────────────────────────

export function RoundPicker({
  rounds,
  selectedId,
  onSelect,
}: {
  rounds: { _id: Id<"rounds">; name: string }[];
  selectedId: Id<"rounds"> | null;
  onSelect: (id: Id<"rounds">) => void;
}) {
  if (rounds.length <= 1) return null;
  return (
    <View style={styles.chipRow}>
      {rounds.map((r) => {
        const active = r._id === selectedId;
        return (
          <Pressable
            key={r._id}
            onPress={() => onSelect(r._id)}
            style={[styles.chip, active && styles.chipActive]}
          >
            <Text style={[styles.chipText, active && styles.chipTextActive]}>
              {r.name}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ─── Card ─────────────────────────────────────────────────────────────────────

export function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: object;
}) {
  return <View style={[styles.card, style]}>{children}</View>;
}

// ─── SectionLabel ─────────────────────────────────────────────────────────────

export function SectionLabel({ children }: { children: string }) {
  return <Text style={styles.sectionLabel}>{children}</Text>;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  track: {
    height: 6,
    backgroundColor: "#E0E1EF",
    borderRadius: 99,
    overflow: "hidden",
    marginBottom: 2,
  },
  fill: { height: "100%", borderRadius: 99 },

  coinRow: { marginBottom: 12 },
  coinRowHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginBottom: 5,
  },
  coinRowLabel: { fontSize: 12, color: "#6A6A98", fontWeight: "600" },
  coinRowValue: { fontSize: 14, fontWeight: "800" },
  coinRowMax: { fontSize: 11, color: "#AAAACC", fontWeight: "400" },

  avatar: { alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#fff", fontWeight: "800" },

  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginBottom: 14 },
  chip: {
    backgroundColor: "#ECEDF7",
    borderWidth: 1,
    borderColor: "#E0E1EF",
    borderRadius: 99,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  chipActive: {
    backgroundColor: "rgba(217,155,0,0.12)",
    borderColor: "#D99B00",
  },
  chipText: { fontSize: 12, color: "#6A6A98" },
  chipTextActive: { color: "#D99B00", fontWeight: "700" },

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 15,
    borderWidth: 1,
    borderColor: "#E0E1EF",
    marginBottom: 12,
  },

  sectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#AAAACC",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    marginBottom: 13,
  },
});
