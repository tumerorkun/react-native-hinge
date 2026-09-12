import { useEffect, useState, useRef, useCallback } from 'react'
import { Platform } from 'react-native'
import { NitroModules } from 'react-native-nitro-modules'
import type { Hinge, HingeUpdate, HingeStatus } from '../specs/Hinge.nitro'

/**
 * No-op implementation for all non-iOS platforms (Android, Web, Windows, macOS, etc.)
 * Ensures safe execution without throwing missing hybrid object errors.
 */
const NoopHinge: Hinge = {
  name: 'Hinge',
  isSupported: () => false,
  getAngle: () => 180.0,
  getStatus: () => 'fullyOpen',
  subscribeToHingeUpdates: () => () => {},
  equals: (other) => other === NoopHinge,
  dispose: () => {},
  toString: () => '[HybridObject Hinge (Noop)]',
}

/**
 * Loads native Nitro HybridObject on iOS, or returns safe No-op on other platforms.
 */
function resolveHingeModule(): Hinge {
  if (Platform.OS !== 'ios') {
    return NoopHinge
  }

  try {
    return NitroModules.createHybridObject<Hinge>('Hinge')
  } catch {
    // If native module is not linked or unavailable in this build, fallback to Noop
    return NoopHinge
  }
}

// Load Nitro Hybrid Object singleton with non-iOS noop safety
export const HingeModule: Hinge = resolveHingeModule()

/**
 * Top-level convenience subscription helper.
 *
 * @example
 * ```ts
 * const unsubscribe = subscribeToHinge((update) => {
 *   console.log('Hinge angle:', update.angle, 'Status:', update.status)
 * })
 *
 * // Later:
 * unsubscribe()
 * ```
 */
export function subscribeToHinge(onUpdate: (update: HingeUpdate) => void): () => void {
  return HingeModule.subscribeToHingeUpdates(onUpdate)
}

export interface UseHingeAngleOptions {
  /**
   * Continuous callback invoked on each live hinge update.
   * Can be a UI-thread worklet (marked with `'worklet';`) from `react-native-worklets`
   * for driving live frame-accurate interactions or effects (e.g. pitch bend, folding 3D transforms).
   */
  onHingeUpdate?: (update: HingeUpdate) => void

  /**
   * Whether to actively subscribe to hinge updates.
   * @default true
   */
  enabled?: boolean
}

export interface UseHingeAngleResult {
  /** Current opening angle in degrees. */
  angle: number
  /** High-level status: 'closed' | 'partiallyOpen' | 'fullyOpen'. */
  status: HingeStatus
  /** Whether the current hardware device has a non-null hinge (iPhone Duo on iOS). */
  isSupported: boolean
}

/**
 * Hook for live hinge angle observation on iPhone Duo (UIKit UIHingeInteraction).
 *
 * Supports zero-latency UI thread execution using `react-native-worklets`.
 * Runs in safe No-op mode on non-iOS platforms (Android, Web, etc.).
 *
 * Reference: Apple Tech Talk 111464:
 * "Hinge data is observed live and is ideal for driving interactions or effects."
 * https://developer.apple.com/videos/play/tech-talks/111464/
 *
 * @example
 * ```tsx
 * useHingeAngle({
 *   onHingeUpdate: (update) => {
 *     'worklet';
 *     if (update.status === 'partiallyOpen') {
 *       bendAmount.value = update.angle;
 *     } else {
 *       bendAmount.value = 0;
 *     }
 *   },
 * });
 * ```
 */
export function useHingeAngle(options: UseHingeAngleOptions = {}): UseHingeAngleResult {
  const { onHingeUpdate, enabled = true } = options

  const isSupported = HingeModule.isSupported()

  const [state, setState] = useState<HingeUpdate>(() => ({
    angle: isSupported ? HingeModule.getAngle() : 180,
    status: isSupported ? HingeModule.getStatus() : 'fullyOpen',
    timestamp: Date.now(),
  }))

  const onUpdateRef = useRef(onHingeUpdate)
  onUpdateRef.current = onHingeUpdate

  useEffect(() => {
    // If disabled or non-iOS / unsupported platform, do not attach native listeners
    if (!enabled || !isSupported) {
      return
    }

    const handleUpdate = (update: HingeUpdate) => {
      // 1. Invoke custom callback / UI-thread worklet if provided
      if (onUpdateRef.current) {
        onUpdateRef.current(update)
      }

      // 2. Update React state for standard component re-renders
      setState(update)
    }

    // Subscribe via subscribeToHingeUpdates and return unsubscribe cleanup closure
    const unsubscribe = HingeModule.subscribeToHingeUpdates(handleUpdate)
    return () => {
      unsubscribe()
    }
  }, [enabled, isSupported])

  return {
    angle: state.angle,
    status: state.status,
    isSupported,
  }
}

/**
 * Hook to track discrete high-level hinge status transitions:
 * 'closed' | 'partiallyOpen' | 'fullyOpen'
 */
export function useHingeStatus(
  onStatusChange?: (status: HingeStatus) => void
): HingeStatus {
  const [status, setStatus] = useState<HingeStatus>(() =>
    HingeModule.isSupported() ? HingeModule.getStatus() : 'fullyOpen'
  )

  const lastStatusRef = useRef<HingeStatus>(status)
  const onStatusChangeRef = useRef(onStatusChange)
  onStatusChangeRef.current = onStatusChange

  const handleUpdate = useCallback((update: HingeUpdate) => {
    if (update.status !== lastStatusRef.current) {
      lastStatusRef.current = update.status
      setStatus(update.status)
      onStatusChangeRef.current?.(update.status)
    }
  }, [])

  useHingeAngle({
    onHingeUpdate: handleUpdate,
  })

  return status
}
