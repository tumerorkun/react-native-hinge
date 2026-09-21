package com.margelo.nitro.hinge

import android.app.Activity
import android.content.Context
import android.content.ContextWrapper
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.util.Log
import androidx.core.content.ContextCompat
import androidx.core.util.Consumer
import androidx.window.WindowSdkExtensions
import androidx.window.java.layout.WindowInfoTrackerCallbackAdapter
import androidx.window.layout.FoldingFeature
import androidx.window.layout.WindowInfoTracker
import androidx.window.layout.WindowLayoutInfo
import com.facebook.react.bridge.LifecycleEventListener
import com.facebook.react.bridge.ReactApplicationContext
import com.margelo.nitro.NitroModules
import java.util.concurrent.CopyOnWriteArraySet

/**
 * Native Android implementation for Hinge API using Nitro Modules.
 *
 * Observes:
 * - Jetpack WindowManager folding features for the Activity window (HALF_OPENED -> partiallyOpen, FLAT -> fullyOpen, none -> unknown).
 * - Android TYPE_HINGE_ANGLE hardware sensor (on API 30+) in radians.
 * - Angle is attached only when there is at most one folding feature. With multiple features,
 *   angle is not associated. If only sensor is available, status is unknown.
 */
class HybridHinge : HybridHingeSpec(), SensorEventListener {

  companion object {
    private const val TAG = "HybridHinge"

    init {
      HingeOnLoad.initializeNative()
    }
  }

  // Current live state (angle in radians: 0.0 to Math.PI)
  private var currentAngle: Double = Math.PI
  private var currentStatus: HingeStatus = HingeStatus.FULLYOPEN
  private var hasHingeHardware: Boolean = false

  // Internal tracking
  private var rawHingeAngle: Double? = null
  private var foldingFeatures: List<FoldingFeature> = emptyList()
  private var hingeSensor: Sensor? = null
  private var trackerAdapter: WindowInfoTrackerCallbackAdapter? = null
  private var isSensorRegistered: Boolean = false
  private var isWindowTrackerRegistered: Boolean = false
  private var lifecycleListenerRegistered: Boolean = false

  private val mainHandler = Handler(Looper.getMainLooper())
  private val subscribers = CopyOnWriteArraySet<(update: HingeUpdate) -> Boolean>()

  private val layoutInfoConsumer = Consumer<WindowLayoutInfo> { info ->
    val features = info.displayFeatures.filterIsInstance<FoldingFeature>()
    Log.d(TAG, "WindowLayoutInfo updated: ${features.size} folding feature(s)")
    for (f in features) {
      Log.d(TAG, "FoldingFeature: state=${f.state}, bounds=${f.bounds}")
    }
    foldingFeatures = features
    updateStateAndNotify()
  }

  init {
    Log.i(TAG, "Initializing HybridHinge native module")
    mainHandler.post {
      probeInitialState()
      setupLifecycleListener()
    }
  }

  // MARK: - Hardware Support Check

  override fun isSupported(): Boolean {
    if (hasHingeHardware) return true

    val sensorManager = getSensorManager()
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R && sensorManager != null) {
      if (sensorManager.getDefaultSensor(Sensor.TYPE_HINGE_ANGLE) != null) {
        hasHingeHardware = true
        return true
      }
    }
    return hasHingeHardware
  }

  // MARK: - Static Queries

  override fun getAngle(): Double {
    return currentAngle
  }

  override fun getStatus(): HingeStatus {
    return currentStatus
  }

  // MARK: - Subscriptions

  override fun subscribeToHingeUpdates(onUpdate: (update: HingeUpdate) -> Boolean): () -> Unit {
    Log.d(TAG, "New subscriber added (total: ${subscribers.size + 1})")
    subscribers.add(onUpdate)

    // Immediately dispatch current cached state to new subscriber
    val currentPayload = HingeUpdate(
      angle = currentAngle,
      status = currentStatus,
      timestamp = System.currentTimeMillis().toDouble()
    )
    mainHandler.post {
      try {
        onUpdate(currentPayload)
      } catch (e: Throwable) {
        Log.e(TAG, "Error invoking initial subscriber update", e)
      }
      startObservation()
    }

    return {
      subscribers.remove(onUpdate)
      Log.d(TAG, "Subscriber removed (remaining: ${subscribers.size})")
      if (subscribers.isEmpty()) {
        mainHandler.post {
          if (subscribers.isEmpty()) {
            stopObservation()
          }
        }
      }
    }
  }

  // MARK: - SensorEventListener

  override fun onSensorChanged(event: SensorEvent) {
    if (event.sensor.type == Sensor.TYPE_HINGE_ANGLE) {
      val degrees = event.values[0].toDouble()
      val radians = Math.toRadians(degrees)
      rawHingeAngle = radians
      Log.d(TAG, "Sensor TYPE_HINGE_ANGLE changed: degrees=$degrees, radians=$radians")
      updateStateAndNotify()
    }
  }

  override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) = Unit

  // MARK: - Internal Observation Lifecycle

  private fun setupLifecycleListener() {
    val reactContext = NitroModules.applicationContext as? ReactApplicationContext ?: return
    if (!lifecycleListenerRegistered) {
      reactContext.addLifecycleEventListener(object : LifecycleEventListener {
        override fun onHostResume() {
          Log.d(TAG, "Activity onHostResume: ensuring observation is active")
          mainHandler.post {
            if (subscribers.isNotEmpty()) {
              startObservation()
            }
          }
        }

        override fun onHostPause() = Unit

        override fun onHostDestroy() {
          Log.d(TAG, "Activity onHostDestroy: stopping window observation")
          mainHandler.post {
            stopWindowObservation()
          }
        }
      })
      lifecycleListenerRegistered = true
    }
  }

  private fun probeInitialState() {
    val sensorManager = getSensorManager()
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R && sensorManager != null) {
      val sensor = sensorManager.getDefaultSensor(Sensor.TYPE_HINGE_ANGLE)
      if (sensor != null) {
        hasHingeHardware = true
        hingeSensor = sensor
        Log.d(TAG, "Found TYPE_HINGE_ANGLE sensor: ${sensor.name}")
      }
    }

    val activity = getActivity()
    if (activity != null) {
      try {
        val windowTracker = WindowInfoTracker.getOrCreate(activity)
        if (WindowSdkExtensions.getInstance().extensionVersion >= 9) {
          foldingFeatures = windowTracker.getCurrentWindowLayoutInfo(activity)
            .displayFeatures.filterIsInstance<FoldingFeature>()
          if (foldingFeatures.isNotEmpty()) {
            hasHingeHardware = true
            Log.d(TAG, "Probe found ${foldingFeatures.size} folding feature(s)")
          }
        }
      } catch (t: Throwable) {
        Log.w(TAG, "WindowInfoTracker probe warning: ${t.message}")
      }
    }

    updateState()
  }

  private fun startObservation() {
    startSensorObservation()
    startWindowObservation()
  }

  private fun startSensorObservation() {
    if (isSensorRegistered) return
    val sensorManager = getSensorManager() ?: return

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
      val sensor = hingeSensor ?: sensorManager.getDefaultSensor(Sensor.TYPE_HINGE_ANGLE)
      if (sensor != null) {
        hingeSensor = sensor
        hasHingeHardware = true
        val registered = sensorManager.registerListener(this, sensor, SensorManager.SENSOR_DELAY_NORMAL)
        isSensorRegistered = registered
        Log.i(TAG, "Registered TYPE_HINGE_ANGLE sensor listener: success=$registered")
      }
    }
  }

  private fun startWindowObservation() {
    if (isWindowTrackerRegistered && trackerAdapter != null) return

    val activity = getActivity()
    if (activity == null) {
      Log.d(TAG, "Activity not yet available for WindowInfoTracker, will retry on resume")
      // Schedule a quick retry
      mainHandler.postDelayed({
        if (subscribers.isNotEmpty() && !isWindowTrackerRegistered) {
          startWindowObservation()
        }
      }, 300)
      return
    }

    try {
      val windowTracker = WindowInfoTracker.getOrCreate(activity)
      val adapter = WindowInfoTrackerCallbackAdapter(windowTracker)
      adapter.addWindowLayoutInfoListener(
        activity,
        ContextCompat.getMainExecutor(activity),
        layoutInfoConsumer
      )
      trackerAdapter = adapter
      isWindowTrackerRegistered = true
      Log.i(TAG, "Registered WindowInfoTracker layout info listener on activity: $activity")
    } catch (t: Throwable) {
      Log.e(TAG, "Failed to register WindowLayoutInfo listener", t)
    }

    updateStateAndNotify()
  }

  private fun stopObservation() {
    stopSensorObservation()
    stopWindowObservation()
  }

  private fun stopSensorObservation() {
    if (!isSensorRegistered) return
    isSensorRegistered = false

    val sensorManager = getSensorManager()
    try {
      sensorManager?.unregisterListener(this)
      Log.d(TAG, "Unregistered sensor listener")
    } catch (t: Throwable) {
      Log.w(TAG, "Error unregistering sensor listener: ${t.message}")
    }
  }

  private fun stopWindowObservation() {
    if (!isWindowTrackerRegistered) return
    isWindowTrackerRegistered = false

    try {
      trackerAdapter?.removeWindowLayoutInfoListener(layoutInfoConsumer)
      Log.d(TAG, "Removed window layout listener")
    } catch (t: Throwable) {
      Log.w(TAG, "Error removing window layout listener: ${t.message}")
    }
    trackerAdapter = null
  }

  private fun updateState() {
    if (foldingFeatures.isNotEmpty()) {
      hasHingeHardware = true
      if (foldingFeatures.size == 1) {
        val feature = foldingFeatures[0]
        currentStatus = when (feature.state) {
          FoldingFeature.State.FLAT -> HingeStatus.FULLYOPEN
          FoldingFeature.State.HALF_OPENED -> HingeStatus.PARTIALLYOPEN
          else -> HingeStatus.UNKNOWN
        }
        // When there is at most one folding feature, attach sensor angle
        currentAngle = rawHingeAngle ?: when (currentStatus) {
          HingeStatus.FULLYOPEN -> Math.PI
          HingeStatus.PARTIALLYOPEN -> Math.PI / 2.0
          else -> Math.PI
        }
      } else {
        // Multiple folding features: no reliable feature-to-sensor association; angle remains unassociated
        val hasHalfOpened = foldingFeatures.any { it.state == FoldingFeature.State.HALF_OPENED }
        val hasFlat = foldingFeatures.any { it.state == FoldingFeature.State.FLAT }
        currentStatus = when {
          hasHalfOpened -> HingeStatus.PARTIALLYOPEN
          hasFlat -> HingeStatus.FULLYOPEN
          else -> HingeStatus.UNKNOWN
        }
        currentAngle = when (currentStatus) {
          HingeStatus.FULLYOPEN -> Math.PI
          HingeStatus.PARTIALLYOPEN -> Math.PI / 2.0
          else -> Math.PI
        }
      }
    } else if (rawHingeAngle != null || hingeSensor != null) {
      // If only the sensor is available without folding features, status is unknown
      hasHingeHardware = true
      currentStatus = HingeStatus.UNKNOWN
      currentAngle = rawHingeAngle ?: Math.PI
    }
  }

  private fun updateStateAndNotify() {
    updateState()

    if (subscribers.isEmpty()) return

    val payload = HingeUpdate(
      angle = currentAngle,
      status = currentStatus,
      timestamp = System.currentTimeMillis().toDouble()
    )

    mainHandler.post {
      for (subscriber in subscribers) {
        try {
          subscriber(payload)
        } catch (e: Throwable) {
          Log.e(TAG, "Error dispatching hinge update to subscriber", e)
        }
      }
    }
  }

  // MARK: - Context & Activity Helpers

  private fun getSensorManager(): SensorManager? {
    val context = NitroModules.applicationContext ?: return null
    return context.getSystemService(Context.SENSOR_SERVICE) as? SensorManager
  }

  private fun getActivity(): Activity? {
    val context = NitroModules.applicationContext ?: return null
    if (context is ReactApplicationContext) {
      context.currentActivity?.let { return it }
    }
    return findActivity(context)
  }

  private fun findActivity(context: Context?): Activity? = when (context) {
    is Activity -> context
    is ContextWrapper -> findActivity(context.baseContext)
    else -> null
  }
}
