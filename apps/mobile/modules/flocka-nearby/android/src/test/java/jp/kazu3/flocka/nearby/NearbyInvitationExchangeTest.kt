package jp.kazu3.flocka.nearby

import org.junit.Assert.*
import org.junit.Test

class NearbyInvitationExchangeTest {
  private val alice = "A".repeat(43)
  private val bob = "B".repeat(43)
  private val carol = "C".repeat(43)

  @Test fun oneDiscoveryIdentifiesBothPhonesOnTheSameLink() {
    val a = NearbyInvitationExchange(alice)
    val b = NearbyInvitationExchange(bob)
    // Only A scans/connects and reads B's existing characteristic.
    assertEquals(bob, a.peerCode(bob.toByteArray()))
    val chunks = a.replyChunks()
    assertEquals(listOf(20, 20, 3), chunks.map { it.size })
    val received = chunks.map { b.receive("alice-device", it) }
    assertTrue(received.all { it.accepted })
    assertNull(received[0].code)
    assertNull(received[1].code)
    assertEquals(alice, received[2].code)
    // No B-side scan/second connection is needed; repeated encounters still refresh visibility.
    assertEquals(alice, chunks.map { b.receive("alice-device", it) }.last().code)
  }

  @Test fun interleavedSendersCannotMixTheirInvitationChunks() {
    val b = NearbyInvitationExchange(bob)
    val aChunks = NearbyInvitationExchange(alice).replyChunks()
    val cChunks = NearbyInvitationExchange(carol).replyChunks()
    for (index in 0..1) {
      assertNull(b.receive("a", aChunks[index]).code)
      assertNull(b.receive("c", cChunks[index]).code)
    }
    assertEquals(alice, b.receive("a", aChunks.last()).code)
    assertEquals(carol, b.receive("c", cChunks.last()).code)
  }

  @Test fun disconnectAndSessionStopDiscardIncompleteInvitations() {
    val b = NearbyInvitationExchange(bob)
    val chunks = NearbyInvitationExchange(alice).replyChunks()
    b.receive("a", chunks[0])
    b.disconnected("a")
    assertNull(b.receive("a", chunks[1]).code)
    b.clear()
    assertNull(b.receive("a", chunks[2]).code)
    b.clear()
    assertEquals(alice, chunks.map { b.receive("a", it) }.last().code)
  }

  @Test fun invalidAndOversizedWritesAreRejectedAndDiscardPartialData() {
    val b = NearbyInvitationExchange(bob)
    val chunks = NearbyInvitationExchange(alice).replyChunks()
    for (invalid in listOf(byteArrayOf(), "!".toByteArray(), "あ".toByteArray(), "A".repeat(44).toByteArray())) {
      b.receive("a", chunks[0])
      assertFalse(b.receive("a", invalid).accepted)
      assertNull(b.receive("a", chunks[1]).code)
      b.clear()
    }
    b.receive("a", "A".repeat(30).toByteArray())
    assertFalse(b.receive("a", "A".repeat(20).toByteArray()).accepted)
    assertEquals(alice, chunks.map { b.receive("a", it) }.last().code)
  }

  @Test fun ownOrMalformedCodesNeverBecomePeers() {
    val b = NearbyInvitationExchange(bob)
    assertNull(b.peerCode(bob.toByteArray()))
    assertNull(b.peerCode("A".repeat(42).toByteArray()))
    assertFalse(b.receive("self", bob.toByteArray()).accepted)
    val valid = "aA0_-".repeat(8) + "xY9"
    assertEquals(valid, b.peerCode(valid.toByteArray()))
    assertEquals(valid, b.receive("valid", valid.toByteArray()).code)
  }
}
