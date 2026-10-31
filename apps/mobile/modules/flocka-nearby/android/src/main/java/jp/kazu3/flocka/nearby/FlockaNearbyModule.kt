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
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.util.UUID
import java.util.concurrent.atomic.AtomicReference

class FlockaNearbyModule : Module() {
  private val sessionLock = Any()
  private var session: NearbySession? = null
  override fun definition() = ModuleDefinition {
    Name("FlockaNearby")
    Events("onPeer", "onError", "onReady", "onExchangeStarted")
    AsyncFunction("requestPermissions") { promise: Promise ->
      val permissions = appContext.permissions
      if (permissions == null) { promise.reject("PERMISSIONS_UNAVAILABLE", "権限サービスを利用できません", null); return@AsyncFunction }
      val required = if (Build.VERSION.SDK_INT >= 31) arrayOf(Manifest.permission.BLUETOOTH_SCAN, Manifest.permission.BLUETOOTH_CONNECT, Manifest.permission.BLUETOOTH_ADVERTISE)
        else arrayOf(Manifest.permission.ACCESS_FINE_LOCATION)
      val resolvePermissions = expo.modules.interfaces.permissions.PermissionsResponseListener { result ->
        val denied = result.values.filter { it.status != PermissionsStatus.GRANTED }
        promise.resolve(mapOf("granted" to denied.isEmpty(), "canAskAgain" to denied.all { it.canAskAgain }))
      }
      // requestPermissions launches Android's permission activity even for grants
      // we already have. That pause/resume used to restart the radio endlessly.
      permissions.getPermissions({ result ->
        val missing = required.filter { result[it]?.status != PermissionsStatus.GRANTED }
        if (missing.isEmpty()) resolvePermissions.onResult(result)
        else permissions.askForPermissions({
          permissions.getPermissions(resolvePermissions, *required)
        }, *missing.toTypedArray())
      }, *required)
    }.runOnQueue(Queues.MAIN)
    AsyncFunction("start") { code: String, promise: Promise ->
      val context = appContext.reactContext
      if (context == null || !Regex("^[A-Za-z0-9_-]{43}$").matches(code)) { promise.reject("INVALID_CODE", "交換コードまたは端末情報が不正です", null); return@AsyncFunction }
      synchronized(sessionLock) {
        session?.stop()
        session = NearbySession(context, code) { event, data -> sendEvent(event, data) }.also { it.start(promise) }
      }
    }
    AsyncFunction("notifyExchangeStarted") { code: String, exchangeId: String, promise: Promise ->
      synchronized(sessionLock) {
        val current = session
        if (current == null) promise.reject("NOT_CONNECTED", "相手とのBluetooth接続がありません", null)
        else current.notifyExchangeStarted(code, exchangeId, promise)
      }
    }.runOnQueue(Queues.MAIN)
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
  private val signalID = UUID.fromString("6B7D9112-E86B-47D8-A5C1-A17C0F10CA01")
  private val cccdID = UUID.fromString("00002902-0000-1000-8000-00805F9B34FB")
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
  private val invitations = NearbyInvitationExchange(code)
  private val replies = mutableMapOf<BluetoothGatt, ArrayDeque<ByteArray>>()

  private val outboundCodes = mutableMapOf<BluetoothGatt, String>()
  private val established = mutableSetOf<BluetoothGatt>()
  private val inboundCodes = mutableMapOf<String, String>()
  private val subscribers = mutableMapOf<String, BluetoothDevice>()
  private data class Delivery(val promise: Promise, val address: String, val gatt: BluetoothGatt?, val exchangeId: String, val timeout: Runnable)
  private var delivery: Delivery? = null
  private val acknowledgements = mutableMapOf<BluetoothGatt, ByteArray>()
  private val sendingAcknowledgement = mutableSetOf<BluetoothGatt>()

  fun notifyExchangeStarted(peerCode: String, exchangeId: String, promise: Promise) { synchronized(lock) {
    if (!active || !running) { promise.reject("NOT_CONNECTED", "相手とのBluetooth接続がありません", null); return }
    if (delivery != null || synchronized(connections) { sendingAcknowledgement.isNotEmpty() }) { promise.reject("BUSY", "Bluetoothの通知中です", null); return }
    val payload = try { NearbyExchangeSignal.encode(exchangeId) } catch (_: IllegalArgumentException) {
      promise.reject("INVALID_EXCHANGE", "交換情報が不正です", null); return
    }
    val outgoing = synchronized(connections) { established.firstOrNull { outboundCodes[it] == peerCode } }
    val incoming = synchronized(connections) { subscribers.values.firstOrNull { inboundCodes[it.address] == peerCode } }
    if (outgoing == null && incoming == null) { promise.reject("NOT_CONNECTED", "相手とのBluetooth接続が切れました", null); return }
    val address = outgoing?.device?.address ?: incoming!!.address
    val timeout = Runnable { synchronized(lock) {
      completeDelivery(false)
      finish("BLUETOOTH_FAILED", "相手へのBluetooth通知を確認できませんでした。探索をやり直してください")
    } }
    delivery = Delivery(promise, address, outgoing, exchangeId.lowercase(), timeout)
    handler.postDelayed(timeout, 5000)
    val sent = try {
      if (outgoing != null) {
        val characteristic = outgoing.getService(serviceID)?.getCharacteristic(signalID)
        characteristic != null && writeValue(outgoing, characteristic, payload)
      } else {
        val opened = server
        val characteristic = opened?.getService(serviceID)?.getCharacteristic(signalID)
        if (opened == null || characteristic == null) false
        else if (Build.VERSION.SDK_INT >= 33) opened.notifyCharacteristicChanged(incoming!!, characteristic, true, payload) == BluetoothStatusCodes.SUCCESS
        else {
          @Suppress("DEPRECATION")
          characteristic.value = payload
          @Suppress("DEPRECATION")
          opened.notifyCharacteristicChanged(incoming!!, characteristic, true)
        }
      }
    } catch (_: SecurityException) { false } catch (_: IllegalStateException) { false }
    if (!sent) completeDelivery(false)
  } }
  private fun completeDelivery(success: Boolean) {
    val current = delivery ?: return
    delivery = null
    handler.removeCallbacks(current.timeout)
    if (success) current.promise.resolve(null)
    else current.promise.reject("DELIVERY_FAILED", "相手へBluetoothで通知できませんでした", null)
  }
  private fun signalReceived(peerCode: String?, bytes: ByteArray) {
    if (!active || peerCode == null) return
    val id = NearbyExchangeSignal.decode(bytes) ?: return
    if (NearbyExchangeSignal.isAcknowledgement(bytes)) {
      if (delivery?.gatt == null && delivery?.exchangeId == id && synchronized(connections) { inboundCodes[delivery?.address] } == peerCode) completeDelivery(true)
    } else emit("onExchangeStarted", mapOf("code" to peerCode, "exchangeId" to id))
  }
  /** A live BLE link refreshes presence; a disconnected link stops doing so. */
  private fun refreshConnectedPeers(scheduled: Int) {
    if (!active || !running || cycle != scheduled) return
    val codes = synchronized(connections) {
      established.mapNotNull { outboundCodes[it] } + subscribers.keys.mapNotNull { inboundCodes[it] }
    }
    codes.distinct().forEach { emit("onPeer", mapOf("deviceId" to it, "code" to it, "rssi" to 0)) }
    handler.postDelayed({ synchronized(lock) { refreshConnectedPeers(scheduled) } }, 5000)
  }

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
      service.addCharacteristic(BluetoothGattCharacteristic(
        codeID,
        BluetoothGattCharacteristic.PROPERTY_READ or BluetoothGattCharacteristic.PROPERTY_WRITE,
        BluetoothGattCharacteristic.PERMISSION_READ or BluetoothGattCharacteristic.PERMISSION_WRITE
      ))
      val signal = BluetoothGattCharacteristic(signalID, BluetoothGattCharacteristic.PROPERTY_WRITE or BluetoothGattCharacteristic.PROPERTY_INDICATE, BluetoothGattCharacteristic.PERMISSION_WRITE)
      signal.addDescriptor(BluetoothGattDescriptor(cccdID, BluetoothGattDescriptor.PERMISSION_READ or BluetoothGattDescriptor.PERMISSION_WRITE))
      service.addCharacteristic(signal)
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
    refreshConnectedPeers(cycle)
    pausedFor = null
    val promise = pending.getAndSet(null)
    if (promise != null) promise.resolve(null) else emit("onReady", emptyMap())
  }
  private fun teardown() {
    completeDelivery(false)
    cycle++; running = false
    handler.removeCallbacksAndMessages(null)
    // Stopping is best effort: the stack may already be off and the original reason must stay visible.
    bestEffort { adapter?.bluetoothLeScanner?.stopScan(scanCallback) }
    bestEffort { adapter?.bluetoothLeAdvertiser?.stopAdvertising(advertiseCallback) }
    synchronized(connections) {
      connections.values.forEach { bestEffort { it.disconnect(); it.close() } }
      connections.clear(); seen.clear(); signals.clear(); replies.clear(); invitations.clear()
      outboundCodes.clear(); established.clear(); inboundCodes.clear(); subscribers.clear()
      acknowledgements.clear(); sendingAcknowledgement.clear()
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
    override fun onConnectionStateChange(device: BluetoothDevice, status: Int, newState: Int) { synchronized(lock) {
      if (newState == BluetoothProfile.STATE_DISCONNECTED) {
        synchronized(connections) { invitations.disconnected(device.address); inboundCodes.remove(device.address); subscribers.remove(device.address) }
        if (delivery?.gatt == null && delivery?.address == device.address) completeDelivery(false)
      }
    } }
    override fun onDescriptorWriteRequest(device: BluetoothDevice, requestId: Int, descriptor: BluetoothGattDescriptor, preparedWrite: Boolean, responseNeeded: Boolean, offset: Int, value: ByteArray) { synchronized(lock) {
      val opened = server ?: return
      val supported = active && running && descriptor.uuid == cccdID && descriptor.characteristic.uuid == signalID && !preparedWrite && offset == 0
      val enabled = value.contentEquals(BluetoothGattDescriptor.ENABLE_INDICATION_VALUE)
      val disabled = value.contentEquals(BluetoothGattDescriptor.DISABLE_NOTIFICATION_VALUE)
      val status = if (supported && (enabled || disabled)) BluetoothGatt.GATT_SUCCESS else BluetoothGatt.GATT_REQUEST_NOT_SUPPORTED
      if (status == BluetoothGatt.GATT_SUCCESS) synchronized(connections) {
        if (enabled) subscribers[device.address] = device else subscribers.remove(device.address)
      }
      bestEffort { if (responseNeeded) opened.sendResponse(device, requestId, status, offset, null) }
    } }
    override fun onDescriptorReadRequest(device: BluetoothDevice, requestId: Int, offset: Int, descriptor: BluetoothGattDescriptor) { synchronized(lock) {
      val opened = server ?: return
      val supported = active && descriptor.uuid == cccdID && descriptor.characteristic.uuid == signalID && offset == 0
      val value = synchronized(connections) { if (subscribers.containsKey(device.address)) BluetoothGattDescriptor.ENABLE_INDICATION_VALUE else BluetoothGattDescriptor.DISABLE_NOTIFICATION_VALUE }
      bestEffort { opened.sendResponse(device, requestId, if (supported) BluetoothGatt.GATT_SUCCESS else BluetoothGatt.GATT_REQUEST_NOT_SUPPORTED, offset, if (supported) value else null) }
    } }
    override fun onNotificationSent(device: BluetoothDevice, status: Int) { synchronized(lock) {
      if (status != BluetoothGatt.GATT_SUCCESS && delivery?.gatt == null && delivery?.address == device.address) completeDelivery(false)
    } }
    override fun onCharacteristicWriteRequest(device: BluetoothDevice, requestId: Int, characteristic: BluetoothGattCharacteristic, preparedWrite: Boolean, responseNeeded: Boolean, offset: Int, value: ByteArray) { synchronized(lock) {
      val opened = server ?: return
      var peerCode: String? = null
      val isSignal = characteristic.uuid == signalID
      val status = synchronized(connections) {
        when {
          !active || !running || preparedWrite -> BluetoothGatt.GATT_REQUEST_NOT_SUPPORTED
          offset != 0 -> { invitations.disconnected(device.address); BluetoothGatt.GATT_INVALID_OFFSET }
          isSignal -> if (inboundCodes.containsKey(device.address) && NearbyExchangeSignal.decode(value) != null) BluetoothGatt.GATT_SUCCESS else BluetoothGatt.GATT_REQUEST_NOT_SUPPORTED
          characteristic.uuid != codeID -> BluetoothGatt.GATT_REQUEST_NOT_SUPPORTED
          else -> {
            val receipt = invitations.receive(device.address, value)
            peerCode = receipt.code
            if (receipt.code != null) inboundCodes[device.address] = receipt.code
            if (receipt.accepted) BluetoothGatt.GATT_SUCCESS else BluetoothGatt.GATT_INVALID_ATTRIBUTE_LENGTH
          }
        }
      }
      // Acknowledge before JS can navigate away and stop the session.
      var acknowledged = !responseNeeded
      bestEffort { if (responseNeeded) acknowledged = opened.sendResponse(device, requestId, status, offset, null) }
      if (active && acknowledged && status == BluetoothGatt.GATT_SUCCESS) {
        if (isSignal) signalReceived(synchronized(connections) { inboundCodes[device.address] }, value)
        else if (peerCode != null) emit("onPeer", mapOf("deviceId" to device.address, "code" to peerCode!!, "rssi" to 0))
      }
    } }
    override fun onCharacteristicReadRequest(device: BluetoothDevice, requestId: Int, offset: Int, characteristic: BluetoothGattCharacteristic) {
      val server = server ?: return
      val bytes = code.toByteArray(Charsets.UTF_8)
      bestEffort {
        if (!active || characteristic.uuid != codeID) server.sendResponse(device, requestId, BluetoothGatt.GATT_REQUEST_NOT_SUPPORTED, offset, null)
        else if (offset < 0 || offset > bytes.size) server.sendResponse(device, requestId, BluetoothGatt.GATT_INVALID_OFFSET, offset, null)
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
        handler.postDelayed({ synchronized(connections) { if (connections[address] === gatt && gatt !in established) close(gatt) } }, 8_000)
      }
    }
    override fun onScanFailed(errorCode: Int) { synchronized(lock) {
      if (active && running) radioUnavailable("Bluetooth探索を開始できません（$errorCode）")
    } }
  }
  private val clientCallback = object : BluetoothGattCallback() {
    override fun onConnectionStateChange(gatt: BluetoothGatt, status: Int, state: Int) { synchronized(lock) {
      if (active && status == BluetoothGatt.GATT_SUCCESS && state == BluetoothProfile.STATE_CONNECTED) {
        if (!gatt.requestMtu(185)) gatt.discoverServices()
      } else if (state == BluetoothProfile.STATE_DISCONNECTED || status != BluetoothGatt.GATT_SUCCESS) {
        if (delivery?.gatt === gatt) completeDelivery(false)
        close(gatt)
      }
    } }
    override fun onMtuChanged(gatt: BluetoothGatt, mtu: Int, status: Int) { if (active) gatt.discoverServices() }
    override fun onServicesDiscovered(gatt: BluetoothGatt, status: Int) {
      val service = gatt.getService(serviceID)
      val characteristic = service?.getCharacteristic(codeID)
      if (!active || status != BluetoothGatt.GATT_SUCCESS || characteristic == null) { close(gatt); return }
      val signal = service.getCharacteristic(signalID)
      if (signal == null) { if (!gatt.readCharacteristic(characteristic)) close(gatt); return }
      val descriptor = signal.getDescriptor(cccdID)
      if (descriptor == null || !gatt.setCharacteristicNotification(signal, true)) { close(gatt); return }
      val sent = if (Build.VERSION.SDK_INT >= 33) gatt.writeDescriptor(descriptor, BluetoothGattDescriptor.ENABLE_INDICATION_VALUE) == BluetoothStatusCodes.SUCCESS
        else {
          @Suppress("DEPRECATION")
          descriptor.value = BluetoothGattDescriptor.ENABLE_INDICATION_VALUE
          @Suppress("DEPRECATION")
          gatt.writeDescriptor(descriptor)
        }
      if (!sent) close(gatt)
    }
    override fun onDescriptorWrite(gatt: BluetoothGatt, descriptor: BluetoothGattDescriptor, status: Int) {
      val characteristic = gatt.getService(serviceID)?.getCharacteristic(codeID)
      if (!active || status != BluetoothGatt.GATT_SUCCESS || descriptor.uuid != cccdID || characteristic == null || !gatt.readCharacteristic(characteristic)) close(gatt)
    }
    override fun onCharacteristicWrite(gatt: BluetoothGatt, characteristic: BluetoothGattCharacteristic, status: Int) { synchronized(lock) {
      if (characteristic.uuid == signalID) {
        val acknowledging = synchronized(connections) { sendingAcknowledgement.remove(gatt) }
        if (acknowledging) {
          val packet = synchronized(connections) { acknowledgements.remove(gatt) }
          if (status == BluetoothGatt.GATT_SUCCESS && packet != null) signalReceived(synchronized(connections) { outboundCodes[gatt] }, packet)
          else close(gatt)
        } else if (delivery?.gatt === gatt) {
          completeDelivery(status == BluetoothGatt.GATT_SUCCESS)
          sendAcknowledgement(gatt)
        }
      } else if (status != BluetoothGatt.GATT_SUCCESS || characteristic.uuid != codeID) close(gatt)
      else writeReplyChunk(gatt, characteristic)
    } }
    @Deprecated("Required for Android versions below API 33")
    override fun onCharacteristicChanged(gatt: BluetoothGatt, characteristic: BluetoothGattCharacteristic) {
      @Suppress("DEPRECATION")
      if (Build.VERSION.SDK_INT < 33) changed(gatt, characteristic, characteristic.value ?: byteArrayOf())
    }
    override fun onCharacteristicChanged(gatt: BluetoothGatt, characteristic: BluetoothGattCharacteristic, value: ByteArray) { changed(gatt, characteristic, value) }
    @Deprecated("Required for Android versions below API 33")
    override fun onCharacteristicRead(gatt: BluetoothGatt, characteristic: BluetoothGattCharacteristic, status: Int) {
      @Suppress("DEPRECATION")
      if (Build.VERSION.SDK_INT < 33) received(gatt, characteristic, characteristic.value ?: byteArrayOf(), status)
    }
    override fun onCharacteristicRead(gatt: BluetoothGatt, characteristic: BluetoothGattCharacteristic, value: ByteArray, status: Int) { received(gatt, characteristic, value, status) }
  }
  private fun received(gatt: BluetoothGatt, characteristic: BluetoothGattCharacteristic, bytes: ByteArray, status: Int) { synchronized(lock) {
    val address = gatt.device.address
    val current = synchronized(connections) { connections[address] === gatt }
    val value = invitations.peerCode(bytes)
    if (!active || !current || status != BluetoothGatt.GATT_SUCCESS || characteristic.uuid != codeID || value == null) {
      close(gatt); return
    }
    val rssi = synchronized(connections) { signals[address] ?: 0 }
    val hasSignal = gatt.getService(serviceID)?.getCharacteristic(signalID) != null
    if (hasSignal) synchronized(connections) { outboundCodes[gatt] = value }
    else emit("onPeer", mapOf("deviceId" to address, "code" to value, "rssi" to rssi))
    // One successful discovery must identify both participants, even when only
    // one phone receives the other's advertisement. Reply on this same link.
    // A read-only peer (older Android or iOS) still supports the existing read.
    if (characteristic.properties and BluetoothGattCharacteristic.PROPERTY_WRITE == 0) { close(gatt); return }
    synchronized(connections) { replies[gatt] = ArrayDeque(invitations.replyChunks()) }
    writeReplyChunk(gatt, characteristic)
  } }
  private fun writeReplyChunk(gatt: BluetoothGatt, characteristic: BluetoothGattCharacteristic) {
    val chunk = synchronized(connections) {
      if (!active || connections[gatt.device.address] !== gatt) null else replies[gatt]?.removeFirstOrNull()
    }
    if (chunk == null) {
      val keep = synchronized(connections) {
        if (active && connections[gatt.device.address] === gatt && outboundCodes.containsKey(gatt)) { replies.remove(gatt); established.add(gatt); true } else false
      }
      if (!keep) close(gatt)
      else {
        synchronized(connections) { outboundCodes[gatt] }?.let { emit("onPeer", mapOf("deviceId" to gatt.device.address, "code" to it, "rssi" to 0)) }
        sendAcknowledgement(gatt)
      }
      return
    }
    val sent = try { writeValue(gatt, characteristic, chunk) } catch (_: SecurityException) { false } catch (_: IllegalStateException) { false }
    if (!sent) close(gatt)
  }
  private fun changed(gatt: BluetoothGatt, characteristic: BluetoothGattCharacteristic, value: ByteArray) { synchronized(lock) {
    if (characteristic.uuid != signalID || NearbyExchangeSignal.decode(value) == null || NearbyExchangeSignal.isAcknowledgement(value)) return
    synchronized(connections) {
      if (connections[gatt.device.address] !== gatt || !outboundCodes.containsKey(gatt) || acknowledgements.containsKey(gatt)) return
      acknowledgements[gatt] = value.copyOf()
    }
    sendAcknowledgement(gatt)
  } }
  private fun sendAcknowledgement(gatt: BluetoothGatt) {
    if (delivery?.gatt === gatt) return
    val packet = synchronized(connections) {
      if (!active || connections[gatt.device.address] !== gatt || gatt !in established || gatt in sendingAcknowledgement) null else acknowledgements[gatt]
    } ?: return
    val id = NearbyExchangeSignal.decode(packet) ?: return
    val characteristic = gatt.getService(serviceID)?.getCharacteristic(signalID) ?: return
    synchronized(connections) { sendingAcknowledgement.add(gatt) }
    val sent = try { writeValue(gatt, characteristic, NearbyExchangeSignal.encode(id, true)) } catch (_: SecurityException) { false } catch (_: IllegalStateException) { false }
    if (!sent) close(gatt)
  }
  private fun writeValue(gatt: BluetoothGatt, characteristic: BluetoothGattCharacteristic, value: ByteArray): Boolean {
    if (Build.VERSION.SDK_INT >= 33) return gatt.writeCharacteristic(characteristic, value, BluetoothGattCharacteristic.WRITE_TYPE_DEFAULT) == BluetoothStatusCodes.SUCCESS
    @Suppress("DEPRECATION")
    characteristic.value = value
    characteristic.writeType = BluetoothGattCharacteristic.WRITE_TYPE_DEFAULT
    @Suppress("DEPRECATION")
    return gatt.writeCharacteristic(characteristic)
  }
  private fun close(gatt: BluetoothGatt) {
    synchronized(connections) {
      replies.remove(gatt); outboundCodes.remove(gatt); established.remove(gatt)
      acknowledgements.remove(gatt); sendingAcknowledgement.remove(gatt)
      if (connections.remove(gatt.device.address, gatt)) signals.remove(gatt.device.address)
    }
    bestEffort { gatt.disconnect(); gatt.close() }
  }
}
