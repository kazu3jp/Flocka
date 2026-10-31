package jp.kazu3.flocka.nearby

import java.nio.ByteBuffer
import java.util.UUID

/** One message-type byte plus a UUID fits the minimum ATT payload (20 bytes). */
internal object NearbyExchangeSignal {
  fun encode(exchangeId: String, acknowledgement: Boolean = false): ByteArray {
    require(Regex("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$").matches(exchangeId))
    val id = UUID.fromString(exchangeId)
    return ByteBuffer.allocate(17).put(if (acknowledgement) 2.toByte() else 1.toByte()).putLong(id.mostSignificantBits).putLong(id.leastSignificantBits).array()
  }
  fun isAcknowledgement(bytes: ByteArray): Boolean = bytes.size == 17 && bytes[0] == 2.toByte()
  fun decode(bytes: ByteArray): String? {
    if (bytes.size != 17 || (bytes[0] != 1.toByte() && bytes[0] != 2.toByte())) return null
    val data = ByteBuffer.wrap(bytes, 1, 16)
    return UUID(data.long, data.long).toString()
  }
}
