package jp.kazu3.flocka.nearby

import android.Manifest
import android.annotation.SuppressLint
import android.bluetooth.*
import android.bluetooth.le.*
import android.content.Context
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.ParcelUuid
import expo.modules.interfaces.permissions.PermissionsStatus
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.util.UUID

class FlockaNearbyModule : Module() {
  private var session: NearbySession? = null
  override fun definition() = ModuleDefinition {
    Name("FlockaNearby")
    Events("onPeer", "onError")
    AsyncFunction("requestPermissions") { promise: Promise ->
      val permissions = appContext.permissions
      if (permissions == null) { promise.reject("PERMISSIONS_UNAVAILABLE", "権限サービスを利用できません", null); return@AsyncFunction }
      val required = if (Build.VERSION.SDK_INT >= 31) arrayOf(Manifest.permission.BLUETOOTH_SCAN, Manifest.permission.BLUETOOTH_CONNECT, Manifest.permission.BLUETOOTH_ADVERTISE)
        else arrayOf(Manifest.permission.ACCESS_FINE_LOCATION)
      permissions.askForPermissions({ result -> promise.resolve(mapOf("granted" to result.values.all { it.status == PermissionsStatus.GRANTED })) }, *required)
    }
    AsyncFunction("start") { code: String, promise: Promise ->
      val context = appContext.reactContext
      if (context == null || !Regex("^[A-Za-z0-9_-]{43}$").matches(code)) { promise.reject("INVALID_CODE", "交換コードまたは端末情報が不正です", null); return@AsyncFunction }
      session?.stop()
      try {
        session = NearbySession(context, code) { event, data -> sendEvent(event, data) }
        session?.start(promise)
      } catch (error: Exception) { promise.reject("BLUETOOTH_UNAVAILABLE", error.message ?: "Bluetoothを利用できません", error) }
    }
    AsyncFunction("stop") { session?.stop(); session = null }
    OnDestroy { session?.stop(); session = null }
  }
}

@SuppressLint("MissingPermission")
private class NearbySession(private val context: Context, private val code: String, private val emit: (String, Map<String, Any>) -> Unit) {
  private val serviceID = UUID.fromString("6B7D9110-E86B-47D8-A5C1-A17C0F10CA01")
  private val codeID = UUID.fromString("6B7D9111-E86B-47D8-A5C1-A17C0F10CA01")
  private val manager = context.getSystemService(Context.BLUETOOTH_SERVICE) as BluetoothManager
  private val adapter = manager.adapter
  private val handler = Handler(Looper.getMainLooper())
  private var server: BluetoothGattServer? = null
  private var active = false
  private var promise: Promise? = null
  private val connections = mutableMapOf<String, BluetoothGatt>()
  private val seen = mutableMapOf<String, Long>()
  private val signals = mutableMapOf<String, Int>()

  fun start(promise: Promise) {
    if (adapter == null || !adapter.isEnabled) throw IllegalStateException("Bluetoothをオンにしてください")
    if (!adapter.isMultipleAdvertisementSupported) throw IllegalStateException("この端末はBluetooth広告に対応していません")
    this.promise = promise; active = true
    server = manager.openGattServer(context, serverCallback) ?: throw IllegalStateException("GATTサーバーを起動できません")
    val service = BluetoothGattService(serviceID, BluetoothGattService.SERVICE_TYPE_PRIMARY)
    service.addCharacteristic(BluetoothGattCharacteristic(codeID, BluetoothGattCharacteristic.PROPERTY_READ, BluetoothGattCharacteristic.PERMISSION_READ))
    if (server?.addService(service) != true) throw IllegalStateException("交換サービスを追加できません")
  }
  fun stop() {
    active = false
    handler.removeCallbacksAndMessages(null)
    try { adapter?.bluetoothLeScanner?.stopScan(scanCallback); adapter?.bluetoothLeAdvertiser?.stopAdvertising(advertiseCallback) } catch (_: SecurityException) { /* Permission can be revoked while the screen is open. */ }
    synchronized(connections) { connections.values.forEach { it.disconnect(); it.close() }; connections.clear() }
    server?.close(); server = null
    promise?.reject("CANCELLED", "近距離交換を停止しました", null); promise = null
  }
  private fun fail(message: String) {
    promise?.reject("BLUETOOTH_FAILED", message, null); promise = null
    emit("onError", mapOf("message" to message))
  }
  private val serverCallback = object : BluetoothGattServerCallback() {
    override fun onServiceAdded(status: Int, service: BluetoothGattService) {
      if (!active) return
      if (status != BluetoothGatt.GATT_SUCCESS) { fail("交換サービスを追加できません"); return }
      val settings = AdvertiseSettings.Builder().setAdvertiseMode(AdvertiseSettings.ADVERTISE_MODE_LOW_LATENCY).setConnectable(true).setTimeout(0).build()
      val data = AdvertiseData.Builder().addServiceUuid(ParcelUuid(serviceID)).setIncludeDeviceName(false).build()
      adapter.bluetoothLeAdvertiser.startAdvertising(settings, data, advertiseCallback)
    }
    override fun onCharacteristicReadRequest(device: BluetoothDevice, requestId: Int, offset: Int, characteristic: BluetoothGattCharacteristic) {
      val bytes = code.toByteArray(Charsets.UTF_8)
      if (!active || characteristic.uuid != codeID) { server?.sendResponse(device, requestId, BluetoothGatt.GATT_REQUEST_NOT_SUPPORTED, offset, null); return }
      if (offset > bytes.size) { server?.sendResponse(device, requestId, BluetoothGatt.GATT_INVALID_OFFSET, offset, null); return }
      server?.sendResponse(device, requestId, BluetoothGatt.GATT_SUCCESS, offset, bytes.copyOfRange(offset, bytes.size))
    }
  }
  private val advertiseCallback = object : AdvertiseCallback() {
    override fun onStartSuccess(settings: AdvertiseSettings) {
      if (!active) return
      adapter.bluetoothLeScanner.startScan(listOf(ScanFilter.Builder().setServiceUuid(ParcelUuid(serviceID)).build()), ScanSettings.Builder().setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY).build(), scanCallback)
      promise?.resolve(null); promise = null
    }
    override fun onStartFailure(code: Int) { fail("Bluetooth広告を開始できません（$code）") }
  }
  private val scanCallback = object : ScanCallback() {
    override fun onScanResult(callbackType: Int, result: ScanResult) {
      if (!active) return
      val address = result.device.address
      synchronized(connections) {
        if (connections.containsKey(address) || System.currentTimeMillis() - (seen[address] ?: 0) < 10_000) return
        seen[address] = System.currentTimeMillis(); signals[address] = result.rssi
        val gatt = result.device.connectGatt(context, false, clientCallback, BluetoothDevice.TRANSPORT_LE)
        connections[address] = gatt
        handler.postDelayed({ synchronized(connections) { connections.remove(address)?.let { it.disconnect(); it.close() }; signals.remove(address) } }, 8_000)
      }
    }
    override fun onScanFailed(errorCode: Int) { fail("Bluetooth探索を開始できません（$errorCode）") }
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
      if (Build.VERSION.SDK_INT < 33) received(gatt, characteristic, characteristic.value ?: byteArrayOf(), status)
    }
    override fun onCharacteristicRead(gatt: BluetoothGatt, characteristic: BluetoothGattCharacteristic, value: ByteArray, status: Int) { received(gatt, characteristic, value, status) }
  }
  private fun received(gatt: BluetoothGatt, characteristic: BluetoothGattCharacteristic, bytes: ByteArray, status: Int) {
    val value = bytes.toString(Charsets.UTF_8), address = gatt.device.address
    if (active && status == BluetoothGatt.GATT_SUCCESS && characteristic.uuid == codeID && value != code && Regex("^[A-Za-z0-9_-]{43}$").matches(value))
      emit("onPeer", mapOf("deviceId" to address, "code" to value, "rssi" to (signals[address] ?: 0)))
    close(gatt)
  }
  private fun close(gatt: BluetoothGatt) {
    synchronized(connections) { connections.remove(gatt.device.address); signals.remove(gatt.device.address) }
    gatt.disconnect(); gatt.close()
  }
}
