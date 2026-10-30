import Foundation

struct NearbyInvitationBuffer {
  private var incoming: [UUID: Data] = [:]
  static func validCode(_ value: String) -> Bool {
    value.utf8.count == 43 && value.range(of: "^[A-Za-z0-9_-]{43}$", options: .regularExpression) != nil
  }
  mutating func receive(_ data: Data, from device: UUID, ownCode: String) -> (accepted: Bool, code: String?) {
    guard !data.isEmpty, data.count <= 43, data.allSatisfy({
      (65...90).contains($0) || (97...122).contains($0) || (48...57).contains($0) || $0 == 95 || $0 == 45
    }) else { incoming.removeValue(forKey: device); return (false, nil) }
    var combined = incoming[device] ?? Data()
    combined.append(data)
    guard combined.count <= 43 else { incoming.removeValue(forKey: device); return (false, nil) }
    if combined.count < 43 { incoming[device] = combined; return (true, nil) }
    incoming.removeValue(forKey: device)
    guard let code = String(data: combined, encoding: .utf8), code != ownCode, Self.validCode(code) else { return (false, nil) }
    return (true, code)
  }
  mutating func remove(_ device: UUID) { incoming.removeValue(forKey: device) }
  mutating func clear() { incoming.removeAll() }
  static func chunks(_ code: String) -> [Data] {
    let bytes = Array(code.utf8)
    return stride(from: 0, to: bytes.count, by: 20).map { Data(bytes[$0..<min($0 + 20, bytes.count)]) }
  }
}

enum NearbyExchangePacket {
  static func encode(_ id: String, acknowledgement: Bool = false) -> Data? {
    guard let parsed = UUID(uuidString: id) else { return nil }
    var bytes = parsed.uuid
    return Data([acknowledgement ? 2 : 1]) + withUnsafeBytes(of: &bytes) { Data($0) }
  }
  static func decode(_ data: Data) -> (id: String, acknowledgement: Bool)? {
    guard data.count == 17, data.first == 1 || data.first == 2 else { return nil }
    let bytes = data.dropFirst().withUnsafeBytes { $0.loadUnaligned(as: uuid_t.self) }
    return (UUID(uuid: bytes).uuidString.lowercased(), data.first == 2)
  }
}
