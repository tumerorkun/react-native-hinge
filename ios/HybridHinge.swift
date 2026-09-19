import Foundation
import UIKit
import NitroModules

/**
 * Native Swift implementation for iPhone Duo Hinge API.
 *
 * Implements UIKit's UIHingeInteraction:
 * - Observing hinge state associated with the view hierarchy.
 * - Handles `update.hinge` being non-null (active hinge) or nil (no hinge / left hierarchy).
 * - Reads continuous `hinge.angle` and high-level `hinge.status` (`.closed`, `.partiallyOpen`, `.fullyOpen`).
 * - Dispatches updates synchronously on the UI thread for zero-latency execution with react-native-worklets.
 *
 * Reference:
 * - Apple Tech Talk 111464: "Take advantage of the unique features of iPhone Duo"
 * - UIKit/UIHingeInteraction.h
 */
public class HybridHinge: HybridHingeSpec_base, HybridHingeSpec_protocol {

    // Current live sensor state (in radians: 0.0 to .pi, matching UIKit UIHinge)
    private var currentAngle: Double = Double.pi
    private var currentStatus: HingeStatus = .fullyopen
    private var hasHingeHardware: Bool = false

    // Persistent probe interaction to detect initial hinge state on launch
    private var probeInteraction: UIInteraction?
    private weak var attachedView: UIView?

    public override init() {
        super.init()

        // Proactively probe initial hinge state on the key window
        DispatchQueue.main.async { [weak self] in
            self?.probeInitialHingeState()
        }
    }

    deinit {
        DispatchQueue.main.async { [weak self] in
            if let interaction = self?.probeInteraction, let view = self?.attachedView {
                view.removeInteraction(interaction)
            }
        }
    }

    // MARK: - Hardware Support Check

    /**
     * Checks if current device has a non-null hardware hinge (iPhone Duo).
     * Returns true when UIHingeInteraction is available and reports an active hinge.
     */
    public func isSupported() throws -> Bool {
        if #available(iOS 27.1, *) {
            return hasHingeHardware
        } else {
            return false
        }
    }

    // MARK: - Static Queries

    /**
     * Reads current static hinge opening angle in radians (0.0 to Double.pi).
     */
    public func getAngle() throws -> Double {
        return currentAngle
    }

    /**
     * Reads current high-level hinge status: closed, partiallyOpen, or fullyOpen.
     */
    public func getStatus() throws -> HingeStatus {
        return currentStatus
    }

    // MARK: - Subscription-based Live Updates

    /**
     * Subscribes to live continuous hinge updates via UIKit's UIHingeInteraction.
     *
     * Example usage from Apple UIKit UIHingeInteraction.h:
     * ```swift
     * if #available(iOS 27.1, *) {
     *     let interaction = UIHingeInteraction { [weak self] _, update in
     *         guard let self else { return }
     *         guard let hinge = update.hinge else {
     *             print("[UIHingeInteraction] Hinge unavailable")
     *             return
     *         }
     *         print("[UIHingeInteraction] Hinge angle: \(hinge.angle)")
     *     }
     *     view.addInteraction(interaction)
     * }
     * ```
     *
     * @param onUpdate Callback receiving live hinge data (can be a worklet).
     * @returns An unsubscribe closure that removes the interaction from the view hierarchy.
     */
    public func subscribeToHingeUpdates(onUpdate: @escaping (_ update: HingeUpdate) -> Bool) throws -> () -> Void {
        guard #available(iOS 27.1, *) else {
            return {}
        }

        var interactionToRemove: UIInteraction?
        weak var targetViewToClean: UIView?

        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            guard let window = self.findKeyWindow() else { return }

            let targetView = window.rootViewController?.view ?? window

            // Instantiate UIHingeInteraction with updateHandler
            let interaction = UIHingeInteraction { [weak self] _, update in
                guard let self = self else { return }

                // A nil `hinge` indicates the interaction has left a
                // hierarchy that provides hinge updates (or device has no hinge).
                guard let hinge = update.hinge else {
                    self.hasHingeHardware = false
                    return
                }

                self.hasHingeHardware = true
                self.currentAngle = hinge.angle
                let status = HingeStatus(hinge.status)
                self.currentStatus = status

                let payload = HingeUpdate(
                    angle: hinge.angle,
                    status: status,
                    timestamp: Date().timeIntervalSince1970 * 1000.0
                )

                // Dispatched on UI thread for zero-latency execution with react-native-worklets
                _ = onUpdate(payload)
            }

            targetView.addInteraction(interaction)
            interactionToRemove = interaction
            targetViewToClean = targetView
        }

        // Return unsubscribe function
        return {
            DispatchQueue.main.async {
                if let interaction = interactionToRemove, let view = targetViewToClean {
                    view.removeInteraction(interaction)
                }
            }
        }
    }

    // MARK: - Private Helpers

    /**
     * Adds an initial interaction to observe the hinge state immediately on launch.
     * "The handler is invoked with the initial hinge state, and again whenever there is an update."
     */
    private func probeInitialHingeState() {
        guard #available(iOS 27.1, *) else { return }
        guard let window = findKeyWindow() else { return }

        let targetView = window.rootViewController?.view ?? window
        let probe = UIHingeInteraction { [weak self] _, update in
            guard let self = self else { return }
            if let hinge = update.hinge {
                self.hasHingeHardware = true
                self.currentAngle = hinge.angle
                self.currentStatus = HingeStatus(hinge.status)
            } else {
                self.hasHingeHardware = false
            }
        }

        targetView.addInteraction(probe)
        self.probeInteraction = probe
        self.attachedView = targetView
    }

    private func findKeyWindow() -> UIWindow? {
        return UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .flatMap { $0.windows }
            .first { $0.isKeyWindow }
    }
}

// MARK: - Direct UIHinge.Status Bridge Extension

@available(iOS 27.1, *)
extension HingeStatus {
    init(_ status: UIHinge.Status) {
        switch status {
        case .closed:
            self = .closed
        case .partiallyOpen:
            self = .partiallyopen
        case .fullyOpen:
            self = .fullyopen
        default:
            self = .fullyopen
        }
    }
}
