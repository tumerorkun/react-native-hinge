import { useEffect, useState, useRef, useCallback } from "react";
import { Platform } from "react-native";
import { NitroModules } from "react-native-nitro-modules";
import { scheduleOnUI, scheduleOnRN } from "react-native-worklets";
import type { Hinge, HingeUpdate, HingeStatus } from "../specs/Hinge.nitro";

/**
 * No-op implementation for all non-iOS platforms (Android, Web, Windows, macOS, etc.)
 * Ensures safe execution without throwing missing hybrid object errors.
 */
const NoopHinge: Hinge = {
  name: "Hinge",
  isSupported: () => false,
  getAngle: () => Math.PI,
  getStatus: () => "fullyOpen",
  subscribeToHingeUpdates: () => () => {},
  equals: (other) => other === NoopHinge,
  dispose: () => {},
  toString: () => "[HybridObject Hinge (Noop)]",
};

/**
 * Loads native Nitro HybridObject on iOS, or returns safe No-op on other platforms.
 */
function resolveHingeModule(): Hinge {
  if (Platform.OS !== "ios") {
    return NoopHinge;
  }

  try {
    return NitroModules.createHybridObject<Hinge>("Hinge");
  } catch {
    // If native module is not linked or unavailable in this build, fallback to Noop
    return NoopHinge;
  }
}

// Load Nitro Hybrid Object singleton with non-iOS noop safety
export const HingeModule: Hinge = resolveHingeModule();

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
export function subscribeToHinge(
  onUpdate: (update: HingeUpdate) => void,
): () => void {
  let unsubscribe: (() => void) | null = null;

  scheduleOnUI(() => {
    "worklet";
    unsubscribe = HingeModule.subscribeToHingeUpdates((update) => {
      "worklet";
      onUpdate(update);
      return true;
    });
  });

  return () => {
    scheduleOnUI(() => {
      "worklet";
      if (unsubscribe) {
        unsubscribe();
      }
    });
  };
}

const RAD_TO_DEG = 180 / Math.PI;

export type AngleUnit = "degrees" | "radians";

/**
 * Converts radians to degrees.
 */
export function radiansToDegrees(radians: number): number {
  return radians * RAD_TO_DEG;
}

export interface UseHingeAngleOptions {
  /**
   * Continuous callback invoked on each live hinge update.
   * Can be a UI-thread worklet (marked with `'worklet';`) from `react-native-worklets`
   * for driving live frame-accurate interactions or effects (e.g. pitch bend, folding 3D transforms).
   *
   * Note: The `update.angle` in the callback will match the specified `unit` option.
   */
  onHingeUpdate?: (update: HingeUpdate) => void;

  /**
   * Angle measurement unit returned by `angle` and received in `onHingeUpdate`.
   * - `'radians'`: Native UIKit format (0 to π).
   * - `'degrees'`: Converted to degrees (0° to 180°).
   *
   * @default 'radians'
   */
  unit?: AngleUnit;

  /**
   * Whether to actively subscribe to hinge updates.
   * @default true
   */
  enabled?: boolean;
}

export interface UseHingeAngleResult {
  /** Current opening angle in the requested unit ('degrees' or 'radians'). */
  angle: number;
  /** Angle measurement unit used ('degrees' | 'radians'). */
  unit: AngleUnit;
  /** High-level status: 'closed' | 'partiallyOpen' | 'fullyOpen'. */
  status: HingeStatus;
  /** Whether the current hardware device has a non-null hinge (iPhone Duo on iOS). */
  isSupported: boolean;
}

/**
 * Hook for live hinge angle observation on iPhone Duo (UIKit UIHingeInteraction).
 *
 * Supports zero-latency UI thread execution using `react-native-worklets`.
 * Runs in safe No-op mode on non-iOS platforms (Android, Web, etc.).
 *
 * Apple UIKit provides the native angle in radians. Set `unit: 'radians'` (default)
 * or `unit: 'degrees'` according to your math/animation needs.
 *
 * Reference: Apple Tech Talk 111464:
 * "Hinge data is observed live and is ideal for driving interactions or effects."
 * https://developer.apple.com/videos/play/tech-talks/111464/
 *
 * @example
 * ```tsx
 * // Default: radians (0 to π)
 * const { angle, status } = useHingeAngle();
 *
 * // Or explicitly degrees (0° to 180°):
 * const { angle } = useHingeAngle({ unit: 'degrees' });
 * ```
 */
export function useHingeAngle(
  options: UseHingeAngleOptions = {},
): UseHingeAngleResult {
  const { onHingeUpdate, unit = "radians", enabled = true } = options;

  // Native module returns radians (0 to π, or Math.PI when fully open)
  const [nativeState, setNativeState] = useState<HingeUpdate>(() => ({
    angle: HingeModule.getAngle(),
    status: HingeModule.getStatus(),
    timestamp: Date.now(),
  }));

  const [hasHardwareSupport, setHasHardwareSupport] = useState<boolean>(() =>
    HingeModule.isSupported(),
  );

  useEffect(() => {
    // If disabled or non-iOS platform, do not attach native listeners
    if (!enabled || Platform.OS !== "ios") {
      return;
    }

    const updateReactState = (update: HingeUpdate) => {
      setHasHardwareSupport(true);
      setNativeState(update);
    };

    const currentUnit = unit;
    const userCallback = onHingeUpdate;

    const handleUpdate = (update: HingeUpdate) => {
      "worklet";
      // update.angle from native is in radians
      const convertedAngle =
        currentUnit === "degrees" ? update.angle * RAD_TO_DEG : update.angle;

      const formattedUpdate: HingeUpdate = {
        ...update,
        angle: convertedAngle,
      };

      // 1. Invoke custom callback directly on the UI thread / worklet runtime
      if (userCallback) {
        userCallback(formattedUpdate);
      }

      // 2. Safely sync React component state back on the React Native JS thread
      try {
        scheduleOnRN(updateReactState, update);
      } catch {
        updateReactState(update);
      }

      return true;
    };

    let unsubscribe: (() => void) | null = null;

    scheduleOnUI(() => {
      "worklet";
      unsubscribe = HingeModule.subscribeToHingeUpdates(handleUpdate);
    });

    return () => {
      scheduleOnUI(() => {
        "worklet";
        if (unsubscribe) {
          unsubscribe();
        }
      });
    };
  }, [enabled, unit, onHingeUpdate]);

  const currentAngle =
    unit === "degrees" ? nativeState.angle * RAD_TO_DEG : nativeState.angle;

  return {
    angle: currentAngle,
    unit,
    status: nativeState.status,
    isSupported: hasHardwareSupport,
  };
}

/**
 * Hook to track discrete high-level hinge status transitions:
 * 'closed' | 'partiallyOpen' | 'fullyOpen'
 */
export function useHingeStatus(): HingeStatus {
  const [status, setStatus] = useState<HingeStatus>(() =>
    HingeModule.isSupported() ? HingeModule.getStatus() : "fullyOpen",
  );

  const lastStatusRef = useRef<HingeStatus>(status);
  const onHingeUpdate = useCallback((update: HingeUpdate) => {
    "worklet";
    if (update.status !== lastStatusRef.current) {
      lastStatusRef.current = update.status;
      scheduleOnRN(setStatus, update.status);
    }
  }, []);

  useHingeAngle({ onHingeUpdate });

  return status;
}
