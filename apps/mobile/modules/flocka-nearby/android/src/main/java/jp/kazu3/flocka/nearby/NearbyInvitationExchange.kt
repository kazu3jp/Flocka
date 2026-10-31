package jp.kazu3.flocka.nearby

/** Invitation-only payloads on one BLE link; profiles still come from the authenticated API. */
internal class NearbyInvitationExchange(private val ownCode: String) {
  private val incoming = mutableMapOf<String, ByteArray>()
  private val codePattern = Regex("^[A-Za-z0-9_-]{43}$")

  data class Receipt(val accepted: Boolean, val code: String? = null)

  init { require(codePattern.matches(ownCode)) }

  fun peerCode(bytes: ByteArray): String? = bytes.toString(Charsets.UTF_8)
    .takeIf { it != ownCode && codePattern.matches(it) }

  /** 20-byte writes fit the minimum ATT MTU (23), without prepared/long writes. */
  fun replyChunks(): List<ByteArray> = ownCode.chunked(20).map { it.toByteArray(Charsets.UTF_8) }

  /** Each acknowledged write appends one chunk; only a full, valid code discovers the sender. */
  fun receive(deviceId: String, bytes: ByteArray): Receipt {
    if (bytes.isEmpty() || bytes.size > 43 || bytes.any { byte ->
        val char = byte.toInt().toChar()
        char !in 'A'..'Z' && char !in 'a'..'z' && char !in '0'..'9' && char != '_' && char != '-'
      }) {
      incoming.remove(deviceId)
      return Receipt(false)
    }
    val combined = (incoming[deviceId] ?: byteArrayOf()) + bytes
    if (combined.size > 43) { incoming.remove(deviceId); return Receipt(false) }
    if (combined.size < 43) { incoming[deviceId] = combined; return Receipt(true) }
    incoming.remove(deviceId)
    val code = peerCode(combined) ?: return Receipt(false)
    return Receipt(true, code)
  }

  fun disconnected(deviceId: String) { incoming.remove(deviceId) }
  fun clear() { incoming.clear() }
}
