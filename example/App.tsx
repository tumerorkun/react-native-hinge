import React, { useCallback, useState } from 'react'
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
} from 'react-native'
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import {
  useHingeAngle,
  useHingeStatus,
  type HingeUpdate,
  type HingeStatus,
} from 'react-native-hinge'

export default function App() {
  const [pitchBend, setPitchBend] = useState(0)

  // Continuous UI-thread worklet callback via react-native-worklets
  // Reference: Apple Tech Talk 111464 (1:18 - Drive a pitch bend with hinge angle)
  const handleWorkletUpdate = useCallback((update: HingeUpdate) => {
    'worklet'
    // "Check for a non-null hinge, and filter for the partially open state —
    // adding an else condition to reset the pitch bend when the angle isn't being read."
    if (update.status === 'partiallyOpen') {
      // Map partially open angle to interactive effect
    }
  }, [])

  // Hook for continuous hinge reading
  const { angle, status, isSupported } = useHingeAngle({
    onHingeUpdate: handleWorkletUpdate,
  })

  // Hook for high-level status changes (closed -> partiallyOpen -> fullyOpen)
  useHingeStatus((newStatus: HingeStatus) => {
    console.log(`[iPhone Duo] Hinge status changed to: ${newStatus}`)
  })

  // Visual 3D folding calculation:
  // 180° = fully open canvas (0° fold)
  // 90° = partially open book/seated
  // 0° = closed
  const foldRotationDeg = -(180 - Math.min(180, Math.max(0, angle)))

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" />
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.badge}>Apple Tech Talk 111464 • Xcode SDK 27.1</Text>
            <Text style={styles.title}>iPhone Duo Hinge API</Text>
            <Text style={styles.subtitle}>
              UIHingeInteraction & Worklet Continuous Angle Architecture
            </Text>
          </View>

          {/* 3D Dual-Screen Visualization */}
          <View style={styles.visualizationContainer}>
            <View style={styles.deviceWrapper}>
              {/* Left Screen (Primary Canvas) */}
              <View style={[styles.screen, styles.leftScreen]}>
                <Text style={styles.screenLabel}>Display 1</Text>
                <Text style={styles.screenSub}>Inner Display</Text>
                <View style={styles.speakerGrill} />
              </View>

              {/* Hardware Titanium Hinge Spine */}
              <View style={styles.hingeSpine}>
                <View style={styles.hingeCore} />
              </View>

              {/* Right Screen (Folding Canvas along Hinge Axis) */}
              <View
                style={[
                  styles.screen,
                  styles.rightScreen,
                  {
                    transform: [
                      { perspective: 1000 },
                      { rotateY: `${foldRotationDeg}deg` },
                    ],
                  },
                ]}
              >
                <Text style={styles.screenLabel}>Display 2</Text>
                <Text style={styles.screenSub}>Inner Display</Text>
                <View style={styles.indicatorDot} />
              </View>
            </View>

            <Text style={styles.visualHint}>
              Hinge Angle: {angle.toFixed(1)}° • Status: {status}
            </Text>
          </View>

          {/* Live Telemetry Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Live Hinge Data (UIHingeInteraction)</Text>

            <View style={styles.row}>
              <Text style={styles.label}>Continuous Angle:</Text>
              <Text style={styles.valueHighlight}>{angle.toFixed(1)}°</Text>
            </View>

            <View style={styles.row}>
              <Text style={styles.label}>High-Level Status:</Text>
              <View style={styles.statusBadge}>
                <Text style={styles.statusText}>{status.toUpperCase()}</Text>
              </View>
            </View>

            <View style={styles.row}>
              <Text style={styles.label}>Hardware Hinge Detected:</Text>
              <Text style={[styles.value, { color: isSupported ? '#30d158' : '#ff9f0a' }]}>
                {isSupported ? 'Yes (iPhone Duo Hardware)' : 'Pending Xcode SDK 27.1 / No Hinge'}
              </Text>
            </View>
          </View>

          {/* Apple Tech Talk 111464 Context Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Tech Talk 111464 Summary</Text>
            <Text style={styles.cardSubtitle}>
              "Take advantage of the unique features of iPhone Duo"
            </Text>

            <View style={styles.bulletItem}>
              <Text style={styles.bulletDot}>•</Text>
              <Text style={styles.bulletText}>
                <Text style={styles.boldText}>UIHingeInteraction & onHingeChange:</Text> Report high-level status (closed, partially open, fully open) and continuous hinge angle.
              </Text>
            </View>

            <View style={styles.bulletItem}>
              <Text style={styles.bulletDot}>•</Text>
              <Text style={styles.bulletText}>
                <Text style={styles.boldText}>Live Effects:</Text> Ideal for driving interactions & effects live (e.g. whammy-bar pitch bend in a guitar app).
              </Text>
            </View>

            <View style={styles.bulletItem}>
              <Text style={styles.bulletDot}>•</Text>
              <Text style={styles.bulletText}>
                <Text style={styles.boldText}>SDK Status:</Text> Native methods will link with Xcode SDK 27.1 release.
              </Text>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </SafeAreaProvider>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0c',
  },
  scrollContent: {
    padding: 20,
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  badge: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0a84ff',
    textTransform: 'uppercase',
    letterSpacing: 1.1,
    marginBottom: 6,
    textAlign: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 13,
    color: '#8e8e93',
    textAlign: 'center',
    marginTop: 6,
    maxWidth: 320,
  },
  visualizationContainer: {
    width: '100%',
    height: 240,
    backgroundColor: '#16161a',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#26262b',
  },
  deviceWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 160,
  },
  screen: {
    width: 110,
    height: 160,
    backgroundColor: '#1c1c1e',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#3a3a3c',
    padding: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  leftScreen: {
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
  },
  rightScreen: {
    borderTopLeftRadius: 4,
    borderBottomLeftRadius: 4,
  },
  hingeSpine: {
    width: 6,
    height: 156,
    backgroundColor: '#636366',
    borderRadius: 3,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  hingeCore: {
    width: 2,
    height: 140,
    backgroundColor: '#0a84ff',
    borderRadius: 1,
  },
  screenLabel: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  screenSub: {
    color: '#8e8e93',
    fontSize: 10,
    marginTop: 2,
  },
  speakerGrill: {
    width: 24,
    height: 3,
    backgroundColor: '#48484a',
    borderRadius: 2,
    position: 'absolute',
    top: 8,
  },
  indicatorDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#30d158',
    position: 'absolute',
    top: 8,
    right: 8,
  },
  visualHint: {
    position: 'absolute',
    bottom: 12,
    color: '#8e8e93',
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
  card: {
    width: '100%',
    backgroundColor: '#16161a',
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#26262b',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 6,
  },
  cardSubtitle: {
    fontSize: 12,
    color: '#8e8e93',
    marginBottom: 14,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#26262b',
  },
  label: {
    fontSize: 14,
    color: '#8e8e93',
  },
  value: {
    fontSize: 14,
    color: '#ffffff',
    fontWeight: '600',
  },
  valueHighlight: {
    fontSize: 18,
    color: '#0a84ff',
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  statusBadge: {
    backgroundColor: '#0a84ff20',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#0a84ff40',
  },
  statusText: {
    color: '#0a84ff',
    fontSize: 12,
    fontWeight: '700',
  },
  bulletItem: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  bulletDot: {
    color: '#0a84ff',
    marginRight: 8,
    fontSize: 14,
  },
  bulletText: {
    color: '#cccccc',
    fontSize: 13,
    flex: 1,
    lineHeight: 18,
  },
  boldText: {
    color: '#ffffff',
    fontWeight: '700',
  },
})
