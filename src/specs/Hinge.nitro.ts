import { type HybridObject, type Sync } from 'react-native-nitro-modules'

/**
 * High-level hinge status reported by Apple's UIHingeInteraction / onHingeChange.
 * Reference: Apple Tech Talk 111464 ("Take advantage of the unique features of iPhone Duo")
 * https://developer.apple.com/videos/play/tech-talks/111464/
 */
export type HingeStatus = 'closed' | 'partiallyOpen' | 'fullyOpen'

/**
 * Continuous hinge data payload observed live.
 * Ideal for driving live interactions or visual effects.
 */
export interface HingeUpdate {
  /** Continuous hinge angle in radians (as reported natively by UIKit UIHinge). */
  angle: number
  /** High-level hinge status: 'closed' | 'partiallyOpen' | 'fullyOpen'. */
  status: HingeStatus
  /** Unix epoch timestamp in milliseconds (Date.now() compatible). */
  timestamp: number
}

/**
 * Nitro Hybrid Object specification for iPhone Duo Hinge API (UIKit UIHingeInteraction).
 * Coming with Xcode SDK 27.1 / iOS 27.1.
 */
export interface Hinge extends HybridObject<{ ios: 'swift' }> {
  /**
   * Check if current hardware device has a non-null hinge (iPhone Duo).
   */
  isSupported(): boolean

  /**
   * Reads current static hinge opening angle in radians.
   */
  getAngle(): number

  /**
   * Reads current high-level hinge status ('closed' | 'partiallyOpen' | 'fullyOpen').
   */
  getStatus(): HingeStatus

  /**
   * Subscribes to live continuous hinge updates via UIHingeInteraction.
   * Dispatches on the UI thread for zero-latency execution with react-native-worklets.
   * Angle is reported in native radians (0 to π).
   *
   * @param onUpdate Callback receiving live hinge data (can be a worklet).
   * @returns An unsubscribe function to stop listening and release the interaction.
   */
  subscribeToHingeUpdates(
    onUpdate: Sync<(update: HingeUpdate) => boolean>
  ): () => void
}
