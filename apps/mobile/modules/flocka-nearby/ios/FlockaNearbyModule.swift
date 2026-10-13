import ExpoModulesCore
import CoreBluetooth

public class FlockaNearbyModule: Module {
  private var session: NearbySession?

  public func definition() -> ModuleDefinition {
    Name("FlockaNearby")
    Events("onPeer", "onError")
    AsyncFunction("requestPermissions") { () -> [String: Bool] in
      ["granted": CBManager.authorization != .denied && CBManager.authorization != .restricted]
    }
    AsyncFunction("start") { (code: String, promise: Promise) in
      guard code.range(of: "^[A-Za-z0-9_-]{43}$", options: .regularExpression) != nil else {
        promise.reject("INVALID_CODE", "交換コードが不正です")
        return
      }
      self.session?.stop()
      let session = NearbySession(code: code, promise: promise) { [weak self] event, value in
        self?.sendEvent(event, value)
      }
      self.session = session
      session.start()
    }.runOnQueue(.main)
    AsyncFunction("stop") {
      self.session?.stop()
      self.session = nil
    }.runOnQueue(.main)
    OnDestroy {
      let session = self.session
      DispatchQueue.main.async { session?.stop() }
    }
  }
}

// Only an expiring invitation is exposed over GATT. Profiles remain behind the authenticated API.
private final class NearbySession: NSObject, CBCentralManagerDelegate, CBPeripheralManagerDelegate, CBPeripheralDelegate {
  private let serviceID = CBUUID(string: "6B7D9110-E86B-47D8-A5C1-A17C0F10CA01")
  private let codeID = CBUUID(string: "6B7D9111-E86B-47D8-A5C1-A17C0F10CA01")
  private let code: String
  private var promise: Promise?
  private let emit: (String, [String: Any]) -> Void
  private var central: CBCentralManager!
  private var advertiser: CBPeripheralManager!
  private var peers: [UUID: CBPeripheral] = [:]
  private var seen: [UUID: Date] = [:]
  private var signals: [UUID: Int] = [:]
  private var timeouts: [UUID: DispatchWorkItem] = [:]
  private var active = true
  private var serviceAdded = false

  init(code: String, promise: Promise, emit: @escaping (String, [String: Any]) -> Void) {
    self.code = code
    self.promise = promise
    self.emit = emit
    super.init()
  }
  func start() {
    central = CBCentralManager(delegate: self, queue: .main)
    advertiser = CBPeripheralManager(delegate: self, queue: .main)
  }
  func stop() {
    active = false
    if central?.state == .poweredOn {
      central.stopScan()
      for peer in peers.values { central.cancelPeripheralConnection(peer) }
    }
    if advertiser?.state == .poweredOn { advertiser.stopAdvertising(); advertiser.removeAllServices() }
    for timeout in timeouts.values { timeout.cancel() }
    timeouts.removeAll(); peers.removeAll()
    if let promise { promise.reject("CANCELLED", "近距離交換を停止しました") }
    promise = nil
    central?.delegate = nil
    advertiser?.delegate = nil
  }
  private func updateState() {
    guard active, let central, let advertiser else { return }
    let states = [central.state, advertiser.state]
    if states.contains(.unauthorized) || states.contains(.unsupported) || states.contains(.poweredOff) {
      let message = states.contains(.unauthorized) ? "Bluetoothを端末の設定から許可してください" : states.contains(.unsupported) ? "この端末は近距離交換に対応していません" : "Bluetoothをオンにしてください"
      promise?.reject("BLUETOOTH_UNAVAILABLE", message); promise = nil
      emit("onError", ["message": message])
      return
    }
    guard central.state == .poweredOn, advertiser.state == .poweredOn, !serviceAdded else { return }
    serviceAdded = true
    let service = CBMutableService(type: serviceID, primary: true)
    service.characteristics = [CBMutableCharacteristic(type: codeID, properties: [.read], value: code.data(using: .utf8), permissions: [.readable])]
    advertiser.add(service)
  }
  func centralManagerDidUpdateState(_ central: CBCentralManager) { updateState() }
  func peripheralManagerDidUpdateState(_ peripheral: CBPeripheralManager) { updateState() }
  func peripheralManager(_ peripheral: CBPeripheralManager, didAdd service: CBService, error: Error?) {
    guard active else { return }
    if let error { promise?.reject("SERVICE_FAILED", error.localizedDescription); promise = nil; return }
    peripheral.startAdvertising([CBAdvertisementDataServiceUUIDsKey: [serviceID]])
    central.scanForPeripherals(withServices: [serviceID], options: [CBCentralManagerScanOptionAllowDuplicatesKey: true])
  }
  func peripheralManagerDidStartAdvertising(_ peripheral: CBPeripheralManager, error: Error?) {
    guard active else { return }
    if let error { promise?.reject("ADVERTISING_FAILED", error.localizedDescription) }
    else { promise?.resolve() }
    promise = nil
  }
  func centralManager(_ central: CBCentralManager, didDiscover peripheral: CBPeripheral, advertisementData: [String: Any], rssi RSSI: NSNumber) {
    guard active, peers[peripheral.identifier] == nil else { return }
    if let previous = seen[peripheral.identifier], Date().timeIntervalSince(previous) < 10 { return }
    seen[peripheral.identifier] = Date()
    peers[peripheral.identifier] = peripheral
    signals[peripheral.identifier] = RSSI.intValue
    peripheral.delegate = self
    central.connect(peripheral)
    let timeout = DispatchWorkItem { [weak self, weak peripheral] in
      guard let self, let peripheral else { return }
      self.central.cancelPeripheralConnection(peripheral)
      self.peers.removeValue(forKey: peripheral.identifier)
    }
    timeouts[peripheral.identifier] = timeout
    DispatchQueue.main.asyncAfter(deadline: .now() + 8, execute: timeout)
  }
  func centralManager(_ central: CBCentralManager, didConnect peripheral: CBPeripheral) { if active { peripheral.discoverServices([serviceID]) } }
  func peripheral(_ peripheral: CBPeripheral, didDiscoverServices error: Error?) {
    guard active, error == nil else { central.cancelPeripheralConnection(peripheral); return }
    for service in peripheral.services ?? [] where service.uuid == serviceID { peripheral.discoverCharacteristics([codeID], for: service) }
  }
  func peripheral(_ peripheral: CBPeripheral, didDiscoverCharacteristicsFor service: CBService, error: Error?) {
    guard active, error == nil else { central.cancelPeripheralConnection(peripheral); return }
    for characteristic in service.characteristics ?? [] where characteristic.uuid == codeID { peripheral.readValue(for: characteristic) }
  }
  func peripheral(_ peripheral: CBPeripheral, didUpdateValueFor characteristic: CBCharacteristic, error: Error?) {
    defer { central.cancelPeripheralConnection(peripheral) }
    guard active, error == nil, characteristic.uuid == codeID, let data = characteristic.value,
      let value = String(data: data, encoding: .utf8), value != code,
      value.range(of: "^[A-Za-z0-9_-]{43}$", options: .regularExpression) != nil else { return }
    emit("onPeer", ["deviceId": peripheral.identifier.uuidString, "code": value, "rssi": signals[peripheral.identifier] ?? 0])
  }
  func centralManager(_ central: CBCentralManager, didDisconnectPeripheral peripheral: CBPeripheral, error: Error?) { release(peripheral) }
  func centralManager(_ central: CBCentralManager, didFailToConnect peripheral: CBPeripheral, error: Error?) { release(peripheral) }
  private func release(_ peripheral: CBPeripheral) {
    timeouts.removeValue(forKey: peripheral.identifier)?.cancel()
    peers.removeValue(forKey: peripheral.identifier)
    signals.removeValue(forKey: peripheral.identifier)
  }
}
