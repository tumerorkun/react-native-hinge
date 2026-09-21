import { useCallback } from "react";
import { StyleSheet, Text, View, ScrollView } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { HingeUpdate, useHingeAngle, useHingeStatus } from "react-native-hinge";
import { isUIRuntime, getRuntimeKind } from "react-native-worklets";

export default function App() {
  const hingeStatus = useHingeStatus();
  // Hook for continuous hinge reading via UIKit UIHingeInteraction
  const { angle, status, isSupported } = useHingeAngle({
    unit: "degrees",
    onHingeUpdate: useCallback((update: HingeUpdate) => {
      "worklet";
      const onUI = typeof isUIRuntime === "function" ? isUIRuntime() : false;
      const runtimeKind =
        typeof getRuntimeKind === "function" ? getRuntimeKind() : "unknown";
      const isMain =
        typeof (globalThis as any)._IS_MAIN_THREAD !== "undefined"
          ? (globalThis as any)._IS_MAIN_THREAD
          : true;

      console.log(
        `[HingeWorklet] 🎯 Executing on UI Thread!\n` +
          `  • isUIRuntime: ${onUI}\n` +
          `  • runtimeKind: ${runtimeKind}\n` +
          `  • angle: ${update.angle.toFixed(2)}°\n` +
          `  • status: ${update.status}\n` +
          `  • timestamp: ${update.timestamp}`,
      );
    }, []),
  });

  // Calculate live pitch bend amount
  const activeBend =
    status === "partiallyOpen"
      ? Math.max(0, Math.min(100, Math.round(((180 - angle) / 90) * 100)))
      : 0;

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" />
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.badge}>UIKit • UIHingeInteraction</Text>
            <Text style={styles.title}>iPhone Duo Hinge API</Text>
            <Text style={styles.subtitle}>Live Worklet Integration {hingeStatus}</Text>
          </View>

          {/* Live Telemetry Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>UIHingeInteraction Telemetry</Text>

            <View style={styles.row}>
              <Text style={styles.label}>Hinge Angle (Live):</Text>
              <Text style={styles.valueHighlight}>{angle.toFixed(1)}°</Text>
            </View>

            <View style={styles.row}>
              <Text style={styles.label}>High-Level Status:</Text>
              <View
                style={[
                  styles.statusBadge,
                  status === "partiallyOpen" ? styles.statusBadgeActive : null,
                ]}
              >
                <Text style={styles.statusText}>{status.toUpperCase()}</Text>
              </View>
            </View>

            <View style={styles.row}>
              <Text style={styles.label}>Hardware Hinge Detected:</Text>
              <Text
                style={[
                  styles.value,
                  { color: isSupported ? "#30d158" : "#ff9f0a" },
                ]}
              >
                {isSupported ? "Yes" : "No"}
              </Text>
            </View>
          </View>

          {/* Interactive Guitar Pitch-Bend Card (Apple Tech Talk 111464 Demo) */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>
              Live Effect: Whammy-Bar Pitch Bend
            </Text>
            <Text style={styles.cardSubtitle}>
              Tech Talk 1:18 demonstration: drives pitch bend when partially
              open, resets otherwise.
            </Text>

            <View style={styles.pitchBendRow}>
              <Text style={styles.label}>Pitch Bend Depth:</Text>
              <Text style={styles.pitchBendValue}>+{activeBend}%</Text>
            </View>

            {/* Gauge Bar */}
            <View style={styles.gaugeContainer}>
              <View style={[styles.gaugeFill, { width: `${activeBend}%` }]} />
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0a0a0c",
  },
  scrollContent: {
    padding: 20,
    alignItems: "center",
  },
  header: {
    alignItems: "center",
    marginBottom: 24,
  },
  badge: {
    fontSize: 11,
    fontWeight: "700",
    color: "#0a84ff",
    textTransform: "uppercase",
    letterSpacing: 1.1,
    marginBottom: 6,
    textAlign: "center",
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: "#ffffff",
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 13,
    color: "#8e8e93",
    textAlign: "center",
    marginTop: 6,
    maxWidth: 320,
  },
  card: {
    width: "100%",
    backgroundColor: "#16161a",
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#26262b",
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#ffffff",
    marginBottom: 6,
  },
  cardSubtitle: {
    fontSize: 12,
    color: "#8e8e93",
    marginBottom: 14,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#26262b",
  },
  label: {
    fontSize: 14,
    color: "#8e8e93",
  },
  value: {
    fontSize: 14,
    color: "#ffffff",
    fontWeight: "600",
  },
  valueHighlight: {
    fontSize: 18,
    color: "#0a84ff",
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  statusBadge: {
    backgroundColor: "#0a84ff20",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#0a84ff40",
  },
  statusBadgeActive: {
    backgroundColor: "#30d15820",
    borderColor: "#30d15850",
  },
  statusText: {
    color: "#0a84ff",
    fontSize: 12,
    fontWeight: "700",
  },
  pitchBendRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  pitchBendValue: {
    fontSize: 18,
    fontWeight: "800",
    color: "#30d158",
    fontVariant: ["tabular-nums"],
  },
  gaugeContainer: {
    width: "100%",
    height: 10,
    backgroundColor: "#26262b",
    borderRadius: 5,
    overflow: "hidden",
  },
  gaugeFill: {
    height: "100%",
    backgroundColor: "#30d158",
    borderRadius: 5,
  },
});
