package jp.kazu3.flocka.nearby

import android.Manifest
import android.annotation.SuppressLint
import android.bluetooth.*
import android.bluetooth.le.*
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.location.LocationManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.ParcelUuid
import android.os.SystemClock
import androidx.core.content.ContextCompat
import androidx.core.location.LocationManagerCompat
import expo.modules.interfaces.permissions.PermissionsStatus
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.util.UUID
import java.util.concurrent.atomic.AtomicReference

class FlockaNearbyModule : Module() {
  private val sessionLock = Any()
  private var session: NearbySession? = null
  override fun definition() = ModuleDefinition {
    Name("FlockaNearby")
    Events("onPeer", "onError", "onReady")
    AsyncFunction("requestPermissions") { promise: Promise ->
      val permissions = appContext.permissions
      if (permissions == null) { promise.reject("PERMISSIONS_UNAVAILABLE", "権限サービスを利用できません", null); return@AsyncFunction }
      val required = if (Build.VERSION.SDK_INT >= 31) arrayOf(Manifest.permission.BLUETOOTH_SCAN, Manifest.permission.BLUETOOTH_CONNECT, Manifest.permission.BLUETOOTH_ADVERTISE)
        else arrayOf(Manifest.permission.ACCESS_FINE_LOCATION)
      permissions.askForPermissions({ result ->
        val denied = result.values.filter { it.status != PermissionsStatus.GRANTED }
        promise.resolve(mapOf("granted" to denied.isEmpty(), "canAskAgain" to denied.all { it.canAskAgain }))
      }, *required)
    }
    AsyncFunction("start") { code: String, promise: Promise ->
      val context = appContext.reactContext
      if (context == null || !Regex("^[A-Za-z0-9_-]{43}$").matches(code)) { promise.reject("INVALID_CODE", "交換コードまたは端末情報が不正です", null); return@AsyncFunction }
      synchronized(sessionLock) {
        session?.stop()
        session = NearbySession(context, code) { event, data -> sendEvent(event, data) }.also { it.start(promise) }
      }
    }
    AsyncFunction("stop") { synchronized(sessionLock) { session?.stop(); session = null } }
    OnDestroy { synchronized(sessionLock) { session?.stop(); session = null } }
  }
}

/** Android silently ignores the 6th startScan within 30 seconds, so later starts wait for a free slot. */
private object ScanStartLimiter {
  private const val WINDOW_MS = 30_000L
  private const val MAX_STARTS = 5
  private const val MARGIN_MS = 500L
  private val starts = ArrayDeque<Long>()

  /** Reserves the next allowed start and returns how long to wait before calling startScan. */
  @Synchronized fun reserve(): Long {
    val now = SystemClock.elapsedRealtime()
    while (starts.isNotEmpty() && now - starts.first() >= WINDOW_MS) starts.removeFirst()
    val free = if (starts.size < MAX_STARTS) now else starts[starts.size - MAX_STARTS] + WINDOW_MS + MARGIN_MS
    val at = maxOf(free, starts.lastOrNull() ?: now)
    starts.addLast(at)
    return at - now
  }
}

/**
 * One nearby screen visit. The session stays wanted until stop() or an error the user cannot fix
 * from the screen. While Bluetooth (or Location on Android 11 and below) is off, the radio is torn
 * down, `onError` is sent, and it is set up again with `onReady` once the requirement returns.
 */
@SuppressLint("MissingPermission")
private class NearbySession(context: Context, private val code: String, private val emit: (String, Map<String, Any>) -> Unit) {
  private val context = context.applicationContext
  private val serviceID = UUID.fromString("6B7D9110-E86B-47D8-A5C1-A17C0F10CA01")
  private val codeID = UUID.fromString("6B7D9111-E86B-47D8-A5C1-A17C0F10CA01")
  private val manager = this.context.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager
  private val adapter: BluetoothAdapter? = manager?.adapter
  private val locationManager = this.context.getSystemService(Context.LOCATION_SERVICE) as? LocationManager
  private val handler = Handler(Looper.getMainLooper())
  /** Guards the radio setup state below; Bluetooth callbacks, the receiver and JS calls arrive on different threads. */
  private val lock = Any()
  private val pending = AtomicReference<Promise?>(null)
  @Volatile private var active = false
  @Volatile private var server: BluetoothGattServer? = null
  private var running = false
  private var cycle = 0
  private var pausedFor: String? = null
  private var receiverRegistered = false
  private val connections = mutableMapOf<String, BluetoothGatt>()
  private val seen = mutableMapOf<String, Long>()
  private val signals = mutableMapOf<String, Int>()

  fun start(promise: Promise) { synchronized(lock) {
    if (manager == null || adapter == null || !context.packageManager.hasSystemFeature("android.hardware.bluetooth_le")) {
      promise.reject("UNSUPPORTED", "この端末は近距離交換に対応していません", null); return
    }
    pending.set(promise); active = true
    registerReceiver()
    resume()
  } }
  fun stop() { synchronized(lock) {
    active = false
    teardown()
    unregisterReceiver()
    pending.getAndSet(null)?.reject("CANCELLED", "近距離交換を停止しました", null)
  } }

  private fun blocker(): Pair<String, String>? = when {
    adapter?.isEnabled != true -> "BLUETOOTH_OFF" to "Bluetoothをオンにしてください"
    // Android 11 and below return no scan results while the system Location setting is off.
    Build.VERSION.SDK_INT <= 30 && (locationManager == null || !LocationManagerCompat.isLocationEnabled(locationManager)) -> "LOCATION_OFF" to "位置情報をオンにしてください"
    else -> null
  }
  private fun resume() {
    if (!active || running) return
    val blocked = blocker()
    if (blocked != null) { pause(blocked.first, blocked.second); return }
    // Only reliable while Bluetooth is on, so it is checked after the power check.
    if (adapter?.isMultipleAdvertisementSupported != true) { finish("UNSUPPORTED", "この端末はBluetooth広告に対応していません"); return }
    radio("GATTサーバーを起動できません") {
      val opened = manager?.openGattServer(context, serverCallback)
      if (opened == null) { radioUnavailable("GATTサーバーを起動できません"); return@radio }
      server = opened; running = true
      val service = BluetoothGattService(serviceID, BluetoothGattService.SERVICE_TYPE_PRIMARY)
      service.addCharacteristic(BluetoothGattCharacteristic(codeID, BluetoothGattCharacteristic.PROPERTY_READ, BluetoothGattCharacteristic.PERMISSION_READ))
      if (!opened.addService(service)) radioUnavailable("交換サービスを追加できません")
    }
  }
  /** Runs a radio call; a revoked permission, a stack that turned off, or a null object fails the session cleanly. */
  private inline fun radio(message: String, block: () -> Unit) {
    try { block() }
    catch (_: SecurityException) { finish("PERMISSION_DENIED", "Bluetoothの権限がありません") }
    catch (_: IllegalStateException) { radioUnavailable(message) }
  }
  private fun radioUnavailable(message: String) {
    val blocked = blocker()
    if (blocked != null) pause(blocked.first, blocked.second) else finish("BLUETOOTH_FAILED", message)
  }
  /** A requirement is off: keep the session and wait for the receiver to resume it. */
  private fun pause(code: String, message: String) {
    teardown()
    val promise = pending.getAndSet(null)
    promise?.reject(code, message, null)
    if (promise != null || pausedFor != code) emit("onError", mapOf("code" to code, "message" to message))
    pausedFor = code
  }
  private fun finish(code: String, message: String) {
    active = false
    teardown()
    unregisterReceiver()
    pending.getAndSet(null)?.reject(code, message, null)
    emit("onError", mapOf("code" to code, "message" to message))
  }
  private fun ready() {
    pausedFor = null
    val promise = pending.getAndSet(null)
    if (promise != null) promise.resolve(null) else emit("onReady", emptyMap())
  }
  private fun teardown() {
    cycle++; running = false
    handler.removeCallbacksAndMessages(null)
    // Stopping is best effort: the stack may already be off and the original reason must stay visible.
    bestEffort { adapter?.bluetoothLeScanner?.stopScan(scanCallback) }
    bestEffort { adapter?.bluetoothLeAdvertiser?.stopAdvertising(advertiseCallback) }
    synchronized(connections) {
      connections.values.forEach { bestEffort { it.disconnect(); it.close() } }
      connections.clear(); seen.clear(); signals.clear()
    }
    bestEffort { server?.close() }
    server = null
  }
  private inline fun bestEffort(block: () -> Unit) {
    try { block() } catch (_: SecurityException) { } catch (_: IllegalStateException) { }
  }

  private val stateReceiver = object : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) { synchronized(lock) {
      if (!active) return
      // The broadcast only triggers a re-check; the adapter and location state are read directly.
      val blocked = blocker()
      if (blocked != null) pause(blocked.first, blocked.second) else resume()
    } }
  }
  private fun registerReceiver() {
    if (receiverRegistered) return
    val filter = IntentFilter(BluetoothAdapter.ACTION_STATE_CHANGED)
    if (Build.VERSION.SDK_INT <= 30) filter.addAction(LocationManager.PROVIDERS_CHANGED_ACTION)
    // System broadcasts; exported so they are delivered on every API level.
    ContextCompat.registerReceiver(context, stateReceiver, filter, ContextCompat.RECEIVER_EXPORTED)
    receiverRegistered = true
  }
  private fun unregisterReceiver() {
    if (!receiverRegistered) return
    try { context.unregisterReceiver(stateReceiver) } catch (_: IllegalArgumentException) { }
    receiverRegistered = false
  }

  private val serverCallback = object : BluetoothGattServerCallback() {
    override fun onServiceAdded(status: Int, service: BluetoothGattService) { synchronized(lock) {
      if (!active || !running) return
      if (status != BluetoothGatt.GATT_SUCCESS) { radioUnavailable("交換サービスを追加できません"); return }
      val settings = AdvertiseSettings.Builder().setAdvertiseMode(AdvertiseSettings.ADVERTISE_MODE_LOW_LATENCY).setConnectable(true).setTimeout(0).build()
      val data = AdvertiseData.Builder().addServiceUuid(ParcelUuid(serviceID)).setIncludeDeviceName(false).build()
      radio("Bluetooth広告を開始できません") {
        val advertiser = adapter?.bluetoothLeAdvertiser
        if (advertiser == null) radioUnavailable("Bluetooth広告を開始できません") else advertiser.startAdvertising(settings, data, advertiseCallback)
      }
    } }
    override fun onCharacteristicReadRequest(device: BluetoothDevice, requestId: Int, offset: Int, characteristic: BluetoothGattCharacteristic) {
      val server = server ?: return
      val bytes = code.toByteArray(Charsets.UTF_8)
      bestEffort {
        if (!active || characteristic.uuid != codeID) server.sendResponse(device, requestId, BluetoothGatt.GATT_REQUEST_NOT_SUPPORTED, offset, null)
        else if (offset > bytes.size) server.sendResponse(device, requestId, BluetoothGatt.GATT_INVALID_OFFSET, offset, null)
        else server.sendResponse(device, requestId, BluetoothGatt.GATT_SUCCESS, offset, bytes.copyOfRange(offset, bytes.size))
      }
    }
  }
  private val advertiseCallback = object : AdvertiseCallback() {
    override fun onStartSuccess(settings: AdvertiseSettings) { synchronized(lock) {
      if (!active || !running) return
      val scheduled = cycle
      handler.postDelayed({ synchronized(lock) { if (active && running && cycle == scheduled) startScan() } }, ScanStartLimiter.reserve())
    } }
    override fun onStartFailure(code: Int) { synchronized(lock) {
      if (active && running) radioUnavailable("Bluetooth広告を開始できません（$code）")
    } }
  }
  private fun startScan() {
    radio("Bluetooth探索を開始できません") {
      val scanner = adapter?.bluetoothLeScanner
      if (scanner == null) { radioUnavailable("Bluetooth探索を開始できません"); return@radio }
      scanner.startScan(listOf(ScanFilter.Builder().setServiceUuid(ParcelUuid(serviceID)).build()), ScanSettings.Builder().setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY).build(), scanCallback)
      ready()
    }
  }
  private val scanCallback = object : ScanCallback() {
    override fun onScanResult(callbackType: Int, result: ScanResult) {
      if (!active) return
      val address = result.device.address
      synchronized(connections) {
        if (connections.containsKey(address) || System.currentTimeMillis() - (seen[address] ?: 0) < 10_000) return
        seen[address] = System.currentTimeMillis(); signals[address] = result.rssi
        val gatt = try { result.device.connectGatt(context, false, clientCallback, BluetoothDevice.TRANSPORT_LE) } catch (_: SecurityException) { null } ?: return
        connections[address] = gatt
        handler.postDelayed({ synchronized(connections) { if (connections[address] === gatt) close(gatt) } }, 8_000)
      }
    }
    override fun onScanFailed(errorCode: Int) { synchronized(lock) {
      if (active && running) radioUnavailable("Bluetooth探索を開始できません（$errorCode）")
    } }
  }
  private val clientCallback = object : BluetoothGattCallback() {
    override fun onConnectionStateChange(gatt: BluetoothGatt, status: Int, state: Int) {
      if (active && status == BluetoothGatt.GATT_SUCCESS && state == BluetoothProfile.STATE_CONNECTED) {
        if (!gatt.requestMtu(185)) gatt.discoverServices()
      } else if (state == BluetoothProfile.STATE_DISCONNECTED || status != BluetoothGatt.GATT_SUCCESS) close(gatt)
    }
    override fun onMtuChanged(gatt: BluetoothGatt, mtu: Int, status: Int) { if (active) gatt.discoverServices() }
    override fun onServicesDiscovered(gatt: BluetoothGatt, status: Int) {
      val characteristic = gatt.getService(serviceID)?.getCharacteristic(codeID)
      if (!active || status != BluetoothGatt.GATT_SUCCESS || characteristic == null || !gatt.readCharacteristic(characteristic)) close(gatt)
    }
    @Deprecated("Required for Android versions below API 33")
    override fun onCharacteristicRead(gatt: BluetoothGatt, characteristic: BluetoothGattCharacteristic, status: Int) {
      @Suppress("DEPRECATION")
      if (Build.VERSION.SDK_INT < 33) received(gatt, characteristic, characteristic.value ?: byteArrayOf(), status)
    }
    override fun onCharacteristicRead(gatt: BluetoothGatt, characteristic: BluetoothGattCharacteristic, value: ByteArray, status: Int) { received(gatt, characteristic, value, status) }
  }
  private fun received(gatt: BluetoothGatt, characteristic: BluetoothGattCharacteristic, bytes: ByteArray, status: Int) {
    val value = bytes.toString(Charsets.UTF_8)
    val address = gatt.device.address
    val rssi = synchronized(connections) { signals[address] ?: 0 }
    if (active && status == BluetoothGatt.GATT_SUCCESS && characteristic.uuid == codeID && value != code && Regex("^[A-Za-z0-9_-]{43}$").matches(value))
      emit("onPeer", mapOf("deviceId" to address, "code" to value, "rssi" to rssi))
    close(gatt)
  }
  private fun close(gatt: BluetoothGatt) {
    synchronized(connections) { if (connections.remove(gatt.device.address, gatt)) signals.remove(gatt.device.address) }
    bestEffort { gatt.disconnect(); gatt.close() }
  }
}
