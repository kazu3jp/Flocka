package jp.kazu3.flocka.nearby

import org.junit.Assert.*
import org.junit.Test

class NearbyExchangeSignalTest {
  private val id = "00112233-4455-4677-8899-aabbccddeeff"
  @Test fun signalAndAcknowledgementFitMinimumMtuAndRoundTrip() {
    for (ack in listOf(false, true)) {
      val bytes = NearbyExchangeSignal.encode(id, ack)
      assertEquals(17, bytes.size)
      assertEquals(id, NearbyExchangeSignal.decode(bytes))
      assertEquals(ack, NearbyExchangeSignal.isAcknowledgement(bytes))
      assertEquals("${if (ack) "02" else "01"}00112233445546778899aabbccddeeff", bytes.joinToString("") { "%02x".format(it) })
    }
  }
  @Test fun malformedPacketsAndIdsAreRejected() {
    val packet = NearbyExchangeSignal.encode(id)
    for (data in listOf(byteArrayOf(), packet.copyOf(16), packet + byteArrayOf(0), packet.copyOf().also { it[0] = 3 })) assertNull(NearbyExchangeSignal.decode(data))
    try { NearbyExchangeSignal.encode("not-an-exchange"); fail("invalid UUID accepted") } catch (_: IllegalArgumentException) { }
  }
}
