# react-native-hinge

[![npm version](https://img.shields.io/npm/v/react-native-hinge.svg?style=flat-square)](https://www.npmjs.com/package/react-native-hinge)
[![npm downloads](https://img.shields.io/npm/dm/react-native-hinge.svg?style=flat-square)](https://www.npmjs.com/package/react-native-hinge)
[![license](https://img.shields.io/npm/l/react-native-hinge.svg?style=flat-square)](https://github.com/tumerorkun/react-native-hinge/blob/main/LICENSE)

A cross-platform React Native native library built with **Nitro Modules** exposing continuous hinge angle reading and folding posture monitoring for **iOS** (UIKit `UIHingeInteraction`) and **Android** (Jetpack WindowManager & `TYPE_HINGE_ANGLE` sensor) to JavaScript with zero-latency **UI-thread Worklet** support (`react-native-worklets`).

Architecture inspired by Apple Tech Talk 111464:
**["Take advantage of the unique features of iPhone Duo"](https://developer.apple.com/videos/play/tech-talks/111464/)**
*(Chris Donegan, Engineering Manager in UI Frameworks & Alex Muller, System Experience Engineer)* and Android Jetpack WindowManager foldable standards.

<p align="center">
  <img src="https://raw.githubusercontent.com/tumerorkun/react-native-hinge/main/example/assets/demo.gif" width="48%" alt="react-native-hinge iOS Demo" />
  <img src="https://raw.githubusercontent.com/tumerorkun/react-native-hinge/main/example/assets/android_demo.gif" width="48%" alt="react-native-hinge Android Demo" />
</p>

> [!IMPORTANT]
> **Requirements**:
> - **iOS**: Native hinge interaction requires **Xcode 27.1+** (iOS 27.1 SDK) on hardware supporting `UIHingeInteraction` (e.g. iPhone Duo).
> - **Android**: Requires **Android API 24+** (`minSdkVersion 24`). Continuous angle readings use Android's `TYPE_HINGE_ANGLE` hardware sensor (API 30+), and posture tracking is powered by Jetpack WindowManager across foldable form-factors (Samsung Galaxy Z Fold/Flip, Google Pixel Fold, OnePlus Open, Motorola Razr, Microsoft Surface Duo, etc.).
> - **Graceful Fallback**: Non-foldable devices, older OS versions, and Web safely fallback to a lightweight no-op without throwing errors or breaking builds.

---

## 🌟 Features

- ⚡ **Nitro Modules Architecture**: Ultra-fast C++, Swift, and Kotlin Hybrid Objects with direct JSI bindings and zero serialization overhead.
- 🧵 **Zero-Latency UI-Thread Worklets**: Directly observe continuous hinge angle streams using `react-native-worklets` running synchronously on the UI Runtime.
- 📐 **Unified Status & Angles**:
  - High-level hinge status: `'closed' | 'partiallyOpen' | 'fullyOpen' | 'unknown'`.
  - Continuous hinge angle updates (ideal for live effects and interactions like pitch bends, 3D folding transforms, or responsive layouts).
  - Hardware detection via `isSupported`.
- 🍏 **Native iOS 27.1 Support**: Full native implementation using UIKit's `UIHingeInteraction`.
- 🤖 **Native Android Support**: Full native implementation combining Android Jetpack WindowManager (`FoldingFeature`) and Android `Sensor.TYPE_HINGE_ANGLE`.
- 🛡️ **Cross-Platform Safe**: Standard non-foldable phones, Web, and legacy OS versions safely fallback without crashing.
- 📱 **Included Interactive Example App**: Telemetry, live posture monitor, and whammy-bar pitch bend demo.

---

## 📦 Installation

```bash
npm install react-native-hinge react-native-nitro-modules react-native-worklets
# or
bun add react-native-hinge react-native-nitro-modules react-native-worklets
# or
yarn add react-native-hinge react-native-nitro-modules react-native-worklets
```

### iOS Setup
Install CocoaPods:

```bash
cd ios && pod install
```

### Android Setup
Android autolinking is configured out-of-the-box via React Native and Nitro Modules. No additional manual steps are required.

---

## 🛠️ Nitro Codegen

To regenerate C++, Swift, and Kotlin bindings whenever specs change:

```bash
npm run codegen
```

---

## 🚀 Usage

### 1. Live Interactive Effects with UI-Thread Worklets

Native APIs report the angle in **radians** (0 to π). `useHingeAngle` defaults to **radians** (`unit: 'radians'`), matching native platforms. You can pass `unit: 'degrees'` (0° to 180°) whenever preferred:

```tsx
import React, { useCallback } from 'react'
import { useHingeAngle, type HingeUpdate } from 'react-native-hinge'

export function FoldableInteractionView() {
  // Memoize callback to prevent re-declaring on every render
  const onHingeUpdate = useCallback((update: HingeUpdate) => {
    'worklet'
    if (update.status === 'partiallyOpen') {
      // update.angle: continuous hinge opening angle (radians by default, or degrees if unit: 'degrees')
      // Drive live interaction (e.g. whammy-bar pitch bend, 3D folding transform)
    } else {
      // Reset effect when device is not in partially open state
    }
  }, [])

  const { angle, status, isSupported } = useHingeAngle({
    unit: 'degrees', // 'degrees' (0° to 180°) or 'radians' (default, 0 to π)
    onHingeUpdate,
  })

  return null
}
```

### 2. Direct Subscription API (`subscribeToHinge`)

You can subscribe directly to continuous hinge updates outside of React components or inside custom stores. The low-level `subscribeToHinge` passes native values in radians. Conversion helpers `radiansToDegrees` and `degreesToRadians` are exported for convenience:

```typescript
import { subscribeToHinge, radiansToDegrees } from 'react-native-hinge'

const unsubscribe = subscribeToHinge((update) => {
  const degrees = radiansToDegrees(update.angle)
  console.log('Live angle (rad):', update.angle, 'degrees:', degrees, 'Status:', update.status)
})

// Stop observing and release resources:
unsubscribe()
```

### 3. High-Level Hinge Status Hook (`useHingeStatus`)

Track discrete posture transitions (`closed` -> `partiallyOpen` -> `fullyOpen` -> `unknown`):

```tsx
import React from 'react'
import { useHingeStatus } from 'react-native-hinge'

export function AdaptiveLayout() {
  const status = useHingeStatus()

  if (status === 'partiallyOpen') {
    return <DualPaneOrBookLayout />
  }

  return <StandardCanvasLayout />
}
```

---

## 📐 Hinge Status Reference

| Status | iOS (UIHinge) | Android (WindowManager & Sensor) | Description |
| :--- | :--- | :--- | :--- |
| `closed` | `UIHinge.Status.closed` | - | Device is folded shut, outer display active. |
| `partiallyOpen` | `UIHinge.Status.partiallyOpen` | `FoldingFeature.State.HALF_OPENED` | Device is between closed and flat (Tabletop, Book, Tent). Angle is actively read to drive interactions. |
| `fullyOpen` | `UIHinge.Status.fullyOpen` | `FoldingFeature.State.FLAT` | Continuous large canvas unfolded flat (180°). |
| `unknown` | - | No folding feature or sensor-only | Standalone sensor reading without an associated folding feature, or flat non-separating display. |

---

## 📄 License

MIT
