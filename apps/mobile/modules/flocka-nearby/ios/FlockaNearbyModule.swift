import ExpoModulesCore
import CoreBluetooth

public class FlockaNearbyModule: Module {
  private var session: NearbySession?

  public func definition() -> ModuleDefinition {
    Name("FlockaNearby")
    Events("onPeer", "onError", "onReady", "onExchangeStarted")
    AsyncFunction("requestPermissions") { () -> [String: Bool] in
      // Once denied, iOS only lets the user change Bluetooth access from the Settings app.
      let granted = CBManager.authorization != .denied && CBManager.authorization != .restricted
      return ["granted": granted, "canAskAgain": granted]
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
    AsyncFunction("notifyExchangeStarted") { (code: String, exchangeId: String, promise: Promise) in
      guard let session = self.session else { promise.reject("NOT_CONNECTED", "相手とのBluetooth接続がありません"); return }
      session.notifyExchangeStarted(code, exchangeId: exchangeId, promise: promise)
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

// BLE carries expiring invitations and a wake-up UUID. The API verifies exchange membership.
private final class NearbySession: NSObject, CBCentralManagerDelegate, CBPeripheralManagerDelegate, CBPeripheralDelegate {
  private let serviceID = CBUUID(string: "6B7D9110-E86B-47D8-A5C1-A17C0F10CA01")
  private let codeID = CBUUID(string: "6B7D9111-E86B-47D8-A5C1-A17C0F10CA01")
  private let signalID = CBUUID(string: "6B7D9112-E86B-47D8-A5C1-A17C0F10CA01")
  private let code: String
  private var promise: Promise?
  private let emit: (String, [String: Any]) -> Void
  private var central: CBCentralManager!
  private var advertiser: CBPeripheralManager!
  private var signalCharacteristic: CBMutableCharacteristic?
  private var peers: [UUID: CBPeripheral] = [:]
  private var seen: [UUID: Date] = [:]
  private var signals: [UUID: Int] = [:]
  private var timeouts: [UUID: DispatchWorkItem] = [:]
  private var established: Set<UUID> = []
  private var outboundCodes: [UUID: String] = [:]
  private var inboundCodes: [UUID: String] = [:]
  private var subscribers: [UUID: CBCentral] = [:]
  private var remoteSignals: [UUID: CBCharacteristic] = [:]
  private var remoteCodes: [UUID: CBCharacteristic] = [:]
  private var replies: [UUID: [Data]] = [:]
  private var invitations = NearbyInvitationBuffer()
  private var acknowledgements: [UUID: Data] = [:]
  private var writingAcknowledgement: Set<UUID> = []
  private var presenceTimer: Timer?
  private struct Delivery {
    let promise: Promise
    let target: UUID
    let outgoing: Bool
    let exchangeId: String
    let packet: Data
    let timeout: DispatchWorkItem
    var queued = false
  }
  private var delivery: Delivery?
  private var active = true
  private var serviceAdded = false
  private var pausedFor: String?

  init(code: String, promise: Promise, emit: @escaping (String, [String: Any]) -> Void) {
    self.code = code; self.promise = promise; self.emit = emit
    super.init()
  }
  func start() {
    central = CBCentralManager(delegate: self, queue: .main)
    advertiser = CBPeripheralManager(delegate: self, queue: .main)
  }
  func stop() {
    active = false
    teardown()
    promise?.reject("CANCELLED", "近距離交換を停止しました"); promise = nil
    central?.delegate = nil; advertiser?.delegate = nil
  }
  private func teardown() {
    completeDelivery(false)
    presenceTimer?.invalidate(); presenceTimer = nil
    if central?.state == .poweredOn {
      central.stopScan()
      for peer in peers.values { central.cancelPeripheralConnection(peer) }
    }
    if advertiser?.state == .poweredOn { advertiser.stopAdvertising(); advertiser.removeAllServices() }
    serviceAdded = false; signalCharacteristic = nil
    for timeout in timeouts.values { timeout.cancel() }
    timeouts.removeAll(); peers.removeAll(); seen.removeAll(); signals.removeAll()
    established.removeAll(); outboundCodes.removeAll(); inboundCodes.removeAll(); subscribers.removeAll()
    remoteSignals.removeAll(); remoteCodes.removeAll(); replies.removeAll(); invitations.clear()
    acknowledgements.removeAll(); writingAcknowledgement.removeAll()
  }
  private func pause(_ code: String, _ message: String) {
    teardown()
    let pending = promise; promise = nil
    pending?.reject(code, message)
    if pending != nil || pausedFor != code { emit("onError", ["code": code, "message": message]) }
    pausedFor = code
  }
  private func finish(_ code: String, _ message: String) {
    active = false; teardown()
    promise?.reject(code, message); promise = nil
    emit("onError", ["code": code, "message": message])
    central?.delegate = nil; advertiser?.delegate = nil
  }
  private func updateState() {
    guard active, let central, let advertiser else { return }
    let states = [central.state, advertiser.state]
    if states.contains(.unauthorized) { finish("PERMISSION_DENIED", "Bluetoothを端末の設定から許可してください"); return }
    if states.contains(.unsupported) { finish("UNSUPPORTED", "この端末は近距離交換に対応していません"); return }
    if states.contains(.poweredOff) { pause("BLUETOOTH_OFF", "Bluetoothをオンにしてください"); return }
    guard central.state == .poweredOn, advertiser.state == .poweredOn else {
      if states.contains(.resetting) { teardown() }
      return
    }
    guard !serviceAdded else { return }
    serviceAdded = true
    let service = CBMutableService(type: serviceID, primary: true)
    let signal = CBMutableCharacteristic(type: signalID, properties: [.write, .indicate], value: nil, permissions: [.writeable])
    signalCharacteristic = signal
    service.characteristics = [
      CBMutableCharacteristic(type: codeID, properties: [.read, .write], value: nil, permissions: [.readable, .writeable]), signal
    ]
    advertiser.add(service)
  }
  func centralManagerDidUpdateState(_ central: CBCentralManager) { updateState() }
  func peripheralManagerDidUpdateState(_ peripheral: CBPeripheralManager) { updateState() }
  func peripheralManager(_ peripheral: CBPeripheralManager, didAdd service: CBService, error: Error?) {
    guard active, serviceAdded else { return }
    if error != nil { finish("BLUETOOTH_FAILED", "交換サービスを追加できません"); return }
    peripheral.startAdvertising([CBAdvertisementDataServiceUUIDsKey: [serviceID]])
    central.scanForPeripherals(withServices: [serviceID], options: [CBCentralManagerScanOptionAllowDuplicatesKey: true])
  }
  func peripheralManagerDidStartAdvertising(_ peripheral: CBPeripheralManager, error: Error?) {
    guard active, serviceAdded else { return }
    if error != nil { finish("BLUETOOTH_FAILED", "Bluetooth広告を開始できません"); return }
    pausedFor = nil
    if let promise { promise.resolve() } else { emit("onReady", [:]) }
    promise = nil
    presenceTimer?.invalidate()
    presenceTimer = Timer.scheduledTimer(withTimeInterval: 5, repeats: true) { [weak self] _ in self?.refreshConnectedPeers() }
  }
  private func refreshConnectedPeers() {
    guard active else { return }
    let codes = established.compactMap { outboundCodes[$0] } + subscribers.keys.compactMap { inboundCodes[$0] }
    for peerCode in Set(codes) { emit("onPeer", ["deviceId": peerCode, "code": peerCode, "rssi": 0]) }
  }
  func peripheralManager(_ peripheral: CBPeripheralManager, central: CBCentral, didSubscribeTo characteristic: CBCharacteristic) {
    if active && characteristic.uuid == signalID { subscribers[central.identifier] = central }
  }
  func peripheralManager(_ peripheral: CBPeripheralManager, central: CBCentral, didUnsubscribeFrom characteristic: CBCharacteristic) {
    guard characteristic.uuid == signalID else { return }
    subscribers.removeValue(forKey: central.identifier); inboundCodes.removeValue(forKey: central.identifier)
    invitations.remove(central.identifier)
    if delivery?.target == central.identifier && delivery?.outgoing == false { completeDelivery(false) }
  }
  func peripheralManager(_ peripheral: CBPeripheralManager, didReceiveRead request: CBATTRequest) {
    guard active, serviceAdded, request.characteristic.uuid == codeID else { peripheral.respond(to: request, withResult: .readNotPermitted); return }
    let data = Data(code.utf8)
    guard request.offset >= 0, request.offset <= data.count else { peripheral.respond(to: request, withResult: .invalidOffset); return }
    request.value = data.subdata(in: request.offset..<data.count)
    peripheral.respond(to: request, withResult: .success)
  }
  func peripheralManager(_ peripheral: CBPeripheralManager, didReceiveWrite requests: [CBATTRequest]) {
    guard let first = requests.first else { return }
    guard active, serviceAdded else { rejectWrites(peripheral, requests: requests, result: .writeNotPermitted); return }
    // A batch is atomic: do not keep earlier chunks when a later request is invalid.
    var candidate = invitations
    var codes = inboundCodes
    var discovered: [(UUID, String)] = []
    var packets: [(String, Data)] = []
    for request in requests {
      guard request.offset == 0, let value = request.value else { rejectWrites(peripheral, requests: requests, result: .invalidOffset); return }
      if request.characteristic.uuid == codeID {
        let receipt = candidate.receive(value, from: request.central.identifier, ownCode: code)
        guard receipt.accepted else { rejectWrites(peripheral, requests: requests, result: .invalidAttributeValueLength); return }
        if let peerCode = receipt.code { codes[request.central.identifier] = peerCode; discovered.append((request.central.identifier, peerCode)) }
      } else if request.characteristic.uuid == signalID {
        guard let peerCode = codes[request.central.identifier], NearbyExchangePacket.decode(value) != nil else { rejectWrites(peripheral, requests: requests, result: .writeNotPermitted); return }
        packets.append((peerCode, value))
      } else { rejectWrites(peripheral, requests: requests, result: .writeNotPermitted); return }
    }
    invitations = candidate; inboundCodes = codes
    peripheral.respond(to: first, withResult: .success)
    for (device, peerCode) in discovered { emit("onPeer", ["deviceId": device.uuidString, "code": peerCode, "rssi": 0]) }
    for (peerCode, packet) in packets { receiveSignal(peerCode, data: packet) }
  }
  private func rejectWrites(_ peripheral: CBPeripheralManager, requests: [CBATTRequest], result: CBATTError.Code) {
    for request in requests { invitations.remove(request.central.identifier) }
    if let first = requests.first { peripheral.respond(to: first, withResult: result) }
  }
  private func receiveSignal(_ peerCode: String, data: Data) {
    guard active, let decoded = NearbyExchangePacket.decode(data) else { return }
    if decoded.acknowledgement {
      if let delivery, !delivery.outgoing, delivery.exchangeId == decoded.id, inboundCodes[delivery.target] == peerCode { completeDelivery(true) }
    } else { emit("onExchangeStarted", ["code": peerCode, "exchangeId": decoded.id]) }
  }
  func notifyExchangeStarted(_ peerCode: String, exchangeId: String, promise: Promise) {
    guard active, central.state == .poweredOn, advertiser.state == .poweredOn else { promise.reject("NOT_CONNECTED", "相手とのBluetooth接続がありません"); return }
    guard delivery == nil, writingAcknowledgement.isEmpty else { promise.reject("BUSY", "Bluetoothの通知中です"); return }
    guard let packet = NearbyExchangePacket.encode(exchangeId) else { promise.reject("INVALID_EXCHANGE", "交換情報が不正です"); return }
    let outgoing = established.first { outboundCodes[$0] == peerCode }
    let incoming = subscribers.keys.first { inboundCodes[$0] == peerCode }
    guard let target = outgoing ?? incoming else { promise.reject("NOT_CONNECTED", "相手とのBluetooth接続が切れました"); return }
    let timeout = DispatchWorkItem { [weak self] in
      self?.completeDelivery(false)
      self?.finish("BLUETOOTH_FAILED", "相手へのBluetooth通知を確認できませんでした。探索をやり直してください")
    }
    delivery = Delivery(promise: promise, target: target, outgoing: outgoing != nil, exchangeId: exchangeId.lowercased(), packet: packet, timeout: timeout)
    DispatchQueue.main.asyncAfter(deadline: .now() + 5, execute: timeout)
    if let outgoing, let peer = peers[outgoing], let signal = remoteSignals[outgoing] { peer.writeValue(packet, for: signal, type: .withResponse) }
    else { sendIndication() }
  }
  private func sendIndication() {
    guard var current = delivery, !current.outgoing, !current.queued, let characteristic = signalCharacteristic, let target = subscribers[current.target] else { return }
    current.queued = advertiser.updateValue(current.packet, for: characteristic, onSubscribedCentrals: [target])
    delivery = current
  }
  func peripheralManagerIsReady(toUpdateSubscribers peripheral: CBPeripheralManager) { sendIndication() }
  private func completeDelivery(_ success: Bool) {
    guard let current = delivery else { return }
    delivery = nil; current.timeout.cancel()
    if success { current.promise.resolve() } else { current.promise.reject("DELIVERY_FAILED", "相手へBluetoothで通知できませんでした") }
  }
  func centralManager(_ central: CBCentralManager, didDiscover peripheral: CBPeripheral, advertisementData: [String: Any], rssi RSSI: NSNumber) {
    guard active, peers[peripheral.identifier] == nil else { return }
    if let previous = seen[peripheral.identifier], Date().timeIntervalSince(previous) < 10 { return }
    seen[peripheral.identifier] = Date(); peers[peripheral.identifier] = peripheral; signals[peripheral.identifier] = RSSI.intValue
    peripheral.delegate = self; central.connect(peripheral)
    let timeout = DispatchWorkItem { [weak self, weak peripheral] in
      guard let self, let peripheral, !self.established.contains(peripheral.identifier) else { return }
      self.central.cancelPeripheralConnection(peripheral); self.release(peripheral)
    }
    timeouts[peripheral.identifier] = timeout
    DispatchQueue.main.asyncAfter(deadline: .now() + 8, execute: timeout)
  }
  func centralManager(_ central: CBCentralManager, didConnect peripheral: CBPeripheral) { if active { peripheral.discoverServices([serviceID]) } }
  func peripheral(_ peripheral: CBPeripheral, didDiscoverServices error: Error?) {
    guard active, error == nil else { central.cancelPeripheralConnection(peripheral); return }
    for service in peripheral.services ?? [] where service.uuid == serviceID { peripheral.discoverCharacteristics([codeID, signalID], for: service) }
  }
  func peripheral(_ peripheral: CBPeripheral, didDiscoverCharacteristicsFor service: CBService, error: Error?) {
    guard active, error == nil, let code = service.characteristics?.first(where: { $0.uuid == codeID }) else { central.cancelPeripheralConnection(peripheral); return }
    remoteCodes[peripheral.identifier] = code
    if let signal = service.characteristics?.first(where: { $0.uuid == signalID }) {
      remoteSignals[peripheral.identifier] = signal
      peripheral.setNotifyValue(true, for: signal)
    } else { peripheral.readValue(for: code) }
  }
  func peripheral(_ peripheral: CBPeripheral, didUpdateNotificationStateFor characteristic: CBCharacteristic, error: Error?) {
    guard active, error == nil, characteristic.uuid == signalID, characteristic.isNotifying, let code = remoteCodes[peripheral.identifier] else { central.cancelPeripheralConnection(peripheral); return }
    peripheral.readValue(for: code)
  }
  func peripheral(_ peripheral: CBPeripheral, didUpdateValueFor characteristic: CBCharacteristic, error: Error?) {
    guard active, error == nil, let data = characteristic.value else { central.cancelPeripheralConnection(peripheral); return }
    if characteristic.uuid == signalID {
      guard let packet = NearbyExchangePacket.decode(data), !packet.acknowledgement, outboundCodes[peripheral.identifier] != nil, acknowledgements[peripheral.identifier] == nil else { return }
      acknowledgements[peripheral.identifier] = data; sendAcknowledgement(peripheral)
      return
    }
    guard characteristic.uuid == codeID, let value = String(data: data, encoding: .utf8), value != code, NearbyInvitationBuffer.validCode(value) else { central.cancelPeripheralConnection(peripheral); return }
    outboundCodes[peripheral.identifier] = value
    if characteristic.properties.contains(.write), remoteSignals[peripheral.identifier] != nil {
      replies[peripheral.identifier] = NearbyInvitationBuffer.chunks(code)
      writeReply(peripheral)
    } else {
      emit("onPeer", ["deviceId": peripheral.identifier.uuidString, "code": value, "rssi": signals[peripheral.identifier] ?? 0])
      central.cancelPeripheralConnection(peripheral)
    }
  }
  private func writeReply(_ peripheral: CBPeripheral) {
    guard active, let characteristic = remoteCodes[peripheral.identifier], var chunks = replies[peripheral.identifier] else { return }
    if chunks.isEmpty {
      replies.removeValue(forKey: peripheral.identifier); established.insert(peripheral.identifier)
      timeouts.removeValue(forKey: peripheral.identifier)?.cancel()
      sendAcknowledgement(peripheral)
      if let value = outboundCodes[peripheral.identifier] { emit("onPeer", ["deviceId": peripheral.identifier.uuidString, "code": value, "rssi": signals[peripheral.identifier] ?? 0]) }
      return
    }
    let chunk = chunks.removeFirst(); replies[peripheral.identifier] = chunks
    peripheral.writeValue(chunk, for: characteristic, type: .withResponse)
  }
  private func sendAcknowledgement(_ peripheral: CBPeripheral) {
    let id = peripheral.identifier
    if delivery?.outgoing == true && delivery?.target == id { return }
    guard active, established.contains(id), !writingAcknowledgement.contains(id), let packet = acknowledgements[id], let decoded = NearbyExchangePacket.decode(packet), let bytes = NearbyExchangePacket.encode(decoded.id, acknowledgement: true), let signal = remoteSignals[id] else { return }
    writingAcknowledgement.insert(id); peripheral.writeValue(bytes, for: signal, type: .withResponse)
  }
  func peripheral(_ peripheral: CBPeripheral, didWriteValueFor characteristic: CBCharacteristic, error: Error?) {
    guard active else { return }
    let id = peripheral.identifier
    if characteristic.uuid == signalID {
      if writingAcknowledgement.remove(id) != nil {
        if let packet = acknowledgements.removeValue(forKey: id), error == nil, let peerCode = outboundCodes[id] { receiveSignal(peerCode, data: packet) }
        else { central.cancelPeripheralConnection(peripheral) }
      } else if delivery?.outgoing == true && delivery?.target == id {
        completeDelivery(error == nil); sendAcknowledgement(peripheral)
      }
    } else if error == nil { writeReply(peripheral) }
    else { central.cancelPeripheralConnection(peripheral) }
  }
  func centralManager(_ central: CBCentralManager, didDisconnectPeripheral peripheral: CBPeripheral, error: Error?) { release(peripheral) }
  func centralManager(_ central: CBCentralManager, didFailToConnect peripheral: CBPeripheral, error: Error?) { release(peripheral) }
  private func release(_ peripheral: CBPeripheral) {
    let id = peripheral.identifier
    if delivery?.outgoing == true && delivery?.target == id { completeDelivery(false) }
    timeouts.removeValue(forKey: id)?.cancel(); peers.removeValue(forKey: id); signals.removeValue(forKey: id)
    established.remove(id); outboundCodes.removeValue(forKey: id); remoteSignals.removeValue(forKey: id); remoteCodes.removeValue(forKey: id)
    replies.removeValue(forKey: id); acknowledgements.removeValue(forKey: id); writingAcknowledgement.remove(id)
  }
}
