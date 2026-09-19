# react-native-hinge

A React Native native library built with **Nitro Modules** exposing the **iPhone Duo Hinge API** (`UIHingeInteraction`) to JavaScript with zero-latency **UI-thread Worklet** support (`react-native-worklets`).

Architecture based on Apple Tech Talk 111464:
**["Take advantage of the unique features of iPhone Duo"](https://developer.apple.com/videos/play/tech-talks/111464/)**
*(Chris Donegan, Engineering Manager in UI Frameworks & Alex Muller, System Experience Engineer)*.

---

## 🌟 Features

- ⚡ **Nitro Modules Architecture**: Ultra-fast C++ and Swift Hybrid Objects with zero serialization overhead.
- 🧵 **Zero-Latency UI-Thread Worklets**: Directly observe continuous hinge angle streams using `react-native-worklets` running directly on the UI Runtime.
- 📐 **Apple Tech Talk 111464 Alignment**:
  - High-level hinge status: `'closed' | 'partiallyOpen' | 'fullyOpen'`.
  - Continuous hinge angle updates (ideal for live effects and interactions like pitch bends, 3D folding transforms, or responsive layouts).
  - Checking for non-null hinge to determine hardware support.
- 🍏 **Native iOS 27.1 Support**: Full native implementation using UIKit's `UIHingeInteraction` with `if #available(iOS 27.1, *)`.
- 🛡️ **Cross-Platform Safe**: Android, Web, and legacy iOS safely fallback to a lightweight No-op without crashing or breaking builds.
- 📱 **Included Interactive Example App**: Telemetry, live posture monitor, and whammy-bar pitch bend demo.

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

UIKit's `UIHingeInteraction` reports the native angle in **radians** (0 to π). `useHingeAngle` defaults to **degrees** (`unit: 'degrees'`, 0° to 180°), but you can pass `unit: 'radians'` whenever needed:

```tsx
import React, { useCallback } from 'react'
import { useHingeAngle, type HingeUpdate } from 'react-native-hinge'

export function DuoInteractionView() {
  // Memoize callback to prevent re-declaring on every render
  const onHingeUpdate = useCallback((update: HingeUpdate) => {
    'worklet'
    if (update.status === 'partiallyOpen') {
      // update.angle: continuous hinge opening angle (degrees or radians based on unit option)
      // Drive live interaction (e.g. whammy-bar pitch bend, 3D folding transform)
    } else {
      // Reset effect when device is not in partially open state
    }
  }, [])

  // Degrees (default):
  const { angle, status, isSupported } = useHingeAngle({
    unit: 'degrees', // 'degrees' (default, 0° to 180°) or 'radians' (0 to π)
    onHingeUpdate,
  })

  return null
}
```

### 2. Direct Subscription API (`subscribeToHinge`)

You can subscribe directly to continuous hinge updates outside of React components or in custom stores. Note that the low-level `subscribeToHinge` passes the native UIKit value (in radians), and helper conversion functions `radiansToDegrees` and `degreesToRadians` are exported for your convenience:

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

Track discrete transitions (`closed` -> `partiallyOpen` -> `fullyOpen`):

```tsx
import React, { useCallback } from 'react'
import { useHingeStatus } from 'react-native-hinge'

export function AdaptiveDuoLayout() {
  const handleStatusChange = useCallback((newStatus: string) => {
    console.log('iPhone Duo hinge status changed to:', newStatus)
  }, [])

  const status = useHingeStatus(handleStatusChange)

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
