# react-native-hinge

A React Native native library built with **Nitro Modules** exposing the **iPhone Duo Hinge API** (`UIHingeInteraction`) to JavaScript with zero-latency **UI-thread Worklet** support (`react-native-worklets`).

Architecture based on Apple Tech Talk 111464:
**["Take advantage of the unique features of iPhone Duo"](https://developer.apple.com/videos/play/tech-talks/111464/)**
*(Chris Donegan, Engineering Manager in UI Frameworks & Alex Muller, System Experience Engineer)*.

---

## 🌟 Features

- ⚡ **Nitro Modules Architecture**: Ultra-fast C++ and Swift Hybrid Objects with zero serialization overhead.
- 🧵 **UI-Thread Worklets**: Directly observe continuous hinge angle streams using `react-native-worklets` without blocking the JS event loop.
- 📐 **Apple Tech Talk 111464 Alignment**:
  - High-level hinge status: `'closed' | 'partiallyOpen' | 'fullyOpen'`.
  - Continuous hinge angle updates (ideal for live effects and interactions like pitch bends or folding transforms).
  - Checking for non-null hinge to determine hardware support.
- 🛠️ **Xcode SDK 27.1 Ready**: Clean Swift architectural skeleton with explicit `TODO: [Xcode SDK 27.1]` connection points for `UIHingeInteraction`.
- 📱 **Included Interactive Example App**: Dual-screen visualizer and telemetry demo.

---

## 📦 Installation

```bash
npm install react-native-hinge react-native-nitro-modules react-native-worklets
```

Then install CocoaPods:

```bash
cd ios && pod install
```

---

## 🛠️ Nitro Codegen

To generate the C++ and Swift glue code:

```bash
npm run codegen
```

---

## 🚀 Usage

### 1. Live Interactive Effects with UI-Thread Worklets

Reference from Tech Talk 111464:
> *"The onHingeChange modifier / UIHingeInteraction takes a closure... Check for a non-null hinge, since null indicates a device without one, and filter for the partially open state — adding an else condition to reset when the angle isn't being read."*

```tsx
import React from 'react'
import { useHingeAngle, type HingeUpdate } from 'react-native-hinge'

export function DuoInteractionView() {
  // Callback executed on the UI thread via react-native-worklets
  const onHingeUpdate = (update: HingeUpdate) => {
    'worklet'
    if (update.status === 'partiallyOpen') {
      // update.angle: continuous hinge opening angle
      // Drive live interaction (e.g. whammy-bar pitch bend, 3D folding transform)
    } else {
      // Reset effect when device is not in partially open state
    }
  }

  const { angle, status, isSupported } = useHingeAngle({
    onHingeUpdate,
  })

  return null
}
```

### 2. Direct Subscription API (`subscribeToHinge`)

You can subscribe directly to continuous hinge updates outside of React components or in custom stores. The method returns an `unsubscribe` cleanup function:

```typescript
import { subscribeToHinge } from 'react-native-hinge'

const unsubscribe = subscribeToHinge((update) => {
  console.log('Live angle:', update.angle, 'Status:', update.status)
})

// Stop observing and release resources:
unsubscribe()
```

### 3. High-Level Hinge Status Hook (`useHingeStatus`)

Track discrete transitions (`closed` -> `partiallyOpen` -> `fullyOpen`):

```tsx
import { useHingeStatus } from 'react-native-hinge'

export function AdaptiveDuoLayout() {
  const status = useHingeStatus((newStatus) => {
    console.log('iPhone Duo hinge status changed to:', newStatus)
  })

  if (status === 'partiallyOpen') {
    return <BookOrSeatedLayout />
  }

  return <CanvasLayout />
}
```

---

## 📐 Hinge Status Reference

| Status | Apple Tech Talk Description |
| :--- | :--- |
| `closed` | Device is folded shut, outer display active |
| `partiallyOpen` | Device is between closed and flat (Seated, Book, Tent). Angle is actively read to drive interactions. |
| `fullyOpen` | Continuous large canvas unfolded |

---

## 📄 License

MIT © Tumer Orkun
