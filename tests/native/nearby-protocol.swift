import Foundation

@main struct NearbyProtocolTests {
  static func main() {
    let id = "00112233-4455-4677-8899-aabbccddeeff"
    for ack in [false, true] {
      let data = NearbyExchangePacket.encode(id, acknowledgement: ack)!
      precondition(data.count == 17)
      precondition(NearbyExchangePacket.decode(data)?.id == id)
      precondition(NearbyExchangePacket.decode(data)?.acknowledgement == ack)
      precondition(data.map { String(format: "%02x", $0) }.joined() == "\(ack ? "02" : "01")00112233445546778899aabbccddeeff")
    }
    precondition(NearbyExchangePacket.decode(Data()) == nil)
    precondition(NearbyExchangePacket.decode(Data(repeating: 1, count: 18)) == nil)
    precondition(NearbyExchangePacket.decode(Data([3] + Array(repeating: 0, count: 16))) == nil)
    precondition(NearbyExchangePacket.encode("invalid") == nil)
    let own = String(repeating: "B", count: 43), peer = String(repeating: "A", count: 43)
    let device = UUID()
    let chunks = NearbyInvitationBuffer.chunks(peer)
    precondition(chunks.map(\.count) == [20, 20, 3])
    var buffer = NearbyInvitationBuffer()
    precondition(buffer.receive(chunks[0], from: device, ownCode: own).code == nil)
    precondition(buffer.receive(chunks[1], from: device, ownCode: own).code == nil)
    precondition(buffer.receive(chunks[2], from: device, ownCode: own).code == peer)
    precondition(!buffer.receive(Data(own.utf8), from: device, ownCode: own).accepted)
    precondition(!buffer.receive(Data("!".utf8), from: device, ownCode: own).accepted)
    _ = buffer.receive(chunks[0], from: device, ownCode: own)
    buffer.remove(device)
    precondition(buffer.receive(chunks[1], from: device, ownCode: own).code == nil)
    buffer.clear()
    print("Nearby protocol: packet interoperability, validation and invitation chunks passed")
  }
}
