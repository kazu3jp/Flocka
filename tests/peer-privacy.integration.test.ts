import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { ApiClientError } from "@flocka/api-client";
import { createAuthRuntime } from "./helpers/auth-runtime";

type Runtime = Awaited<ReturnType<typeof createAuthRuntime>>;
type Player = Awaited<ReturnType<Runtime["register"]>>;

async function connect(owner: Player, guest: Player): Promise<string> {
  const invite = await owner.api.createInvite();
  const exchange = await guest.api.startExchange(invite.code);
  await owner.api.approveExchange(exchange.id, "交流会", "同じ机");
  await guest.api.approveExchange(exchange.id, "交流会", "同じ机");
  return exchange.id;
}
const rejectsWith = (code: string) => (error: unknown) =>
  error instanceof ApiClientError && error.code === code;
const rejectsWithStatus = (status: number) => (error: unknown) =>
  error instanceof ApiClientError && error.status === status;
const photo =
  "data:image/png;base64," +
  readFileSync(
    new URL("../apps/mobile/assets/favicon.png", import.meta.url),
  ).toString("base64");

test("blocks in either direction and cancellation stop sharing a peer's live profile", async () => {
  const f = await createAuthRuntime();
  try {
    const a = await f.register("見られる人"),
      b = await f.register("交換相手"),
      c = await f.register("保留の相手");
    await a.api.uploadAvatar(photo);
    const exchangeId = await connect(a, b);
    const synced = await b.api.getSnapshot();
    assert.deepEqual(
      synced.exchanges.map((item) => item.id),
      [exchangeId],
    );
    assert.ok(synced.peers.some((peer) => peer.id === a.player.id));
    assert.equal(await b.api.peerAvatar(a.player.id), photo);

    const hiddenFrom = async (viewer: Player, peer: Player) => {
      const snapshot = await viewer.api.getSnapshot();
      assert.equal(snapshot.exchanges.length, 0);
      assert.equal((await viewer.api.getExchanges()).items.length, 0);
      await assert.rejects(
        viewer.api.getExchange(exchangeId),
        rejectsWithStatus(404),
      );
      await assert.rejects(
        viewer.api.peerAvatar(peer.player.id),
        rejectsWithStatus(404),
      );
      await assert.rejects(
        viewer.api.publicTestimonies(peer.player.id),
        rejectsWithStatus(404),
      );
      return snapshot;
    };
    // a blocks b: b no longer receives a's profile; a keeps names for its block list.
    await a.api.block(b.player.id);
    const blockedSide = await hiddenFrom(b, a);
    assert.equal(
      blockedSide.peers.some((peer) => peer.id === a.player.id),
      false,
    );
    const blockerSide = await hiddenFrom(a, b);
    assert.deepEqual(blockerSide.blocked, [b.player.id]);
    assert.ok(blockerSide.peers.some((peer) => peer.id === b.player.id));
    await assert.rejects(
      b.api.cancelExchange(exchangeId),
      rejectsWith("EXCHANGE_BLOCKED"),
    );
    await a.api.unblock(b.player.id);
    // b blocks a: the same rule applies in the other direction.
    await b.api.block(a.player.id);
    const otherSide = await hiddenFrom(a, b);
    assert.equal(
      otherSide.peers.some((peer) => peer.id === b.player.id),
      false,
    );
    await b.api.unblock(a.player.id);
    assert.equal((await b.api.getSnapshot()).exchanges.length, 1);

    // A pending exchange never serves the photo; a cancelled one hides the profile.
    const invite = await a.api.createInvite();
    const pending = await c.api.startExchange(invite.code);
    assert.equal(pending.status, "pending");
    await assert.rejects(c.api.peerAvatar(a.player.id), rejectsWithStatus(404));
    const cancelled = await c.api.cancelExchange(pending.id);
    assert.equal(cancelled.status, "cancelled");
    await assert.rejects(
      c.api.cancelExchange(pending.id),
      rejectsWith("EXCHANGE_CANCELLED"),
    );
    await assert.rejects(
      c.api.approveExchange(pending.id, "交流会", "同じ机"),
      rejectsWith("EXCHANGE_CANCELLED"),
    );
    const afterCancel = await c.api.getSnapshot();
    assert.equal(afterCancel.exchanges.length, 0);
    assert.equal(
      afterCancel.peers.some((peer) => peer.id === a.player.id),
      false,
    );
    await assert.rejects(c.api.getExchange(pending.id), rejectsWithStatus(404));
    assert.equal((await a.api.getInviteStatus(invite.code)).exchange, null);
    // Removing an accepted connection stays possible, once.
    const removed = await b.api.cancelExchange(exchangeId);
    assert.equal(removed.status, "cancelled");
    assert.equal(removed.peer.id, a.player.id);
    await assert.rejects(b.api.peerAvatar(a.player.id), rejectsWithStatus(404));
    assert.equal((await b.api.getSnapshot()).exchanges.length, 0);
  } finally {
    await f.runtime.dispose();
  }
});

test("public testimonies expose only public fields and follow viewer blocks", async () => {
  const f = await createAuthRuntime();
  try {
    const owner = await f.register("公開する人"),
      viewer = await f.register("見る人"),
      sender = await f.register("贈った人");
    await connect(owner, viewer);
    const fromSender = await connect(owner, sender);
    const pieces = [
      await sender.api.sendScene(fromSender, "impl", "最後まで実装した場面"),
      await sender.api.sendScene(fromSender, "impl", "テストを書き切った場面"),
    ];
    for (const piece of pieces) {
      await owner.api.openTestimony(piece.id, "impl");
      await owner.api.changeVisibility(piece.id, "public");
    }
    const raw = await fetch(
      `${f.base}/v1/players/${owner.player.id}/public?page=0`,
      { headers: { Cookie: viewer.cookie } },
    );
    assert.equal(raw.status, 200);
    const body = (await raw.json()) as { items: Record<string, unknown>[] };
    assert.equal(body.items.length, 2);
    for (const item of body.items)
      assert.deepEqual(Object.keys(item).sort(), [
        "card",
        "createdAt",
        "giver",
        "id",
        "kind",
        "label",
        "story",
        "text",
      ]);
    assert.equal(body.items[0].giver, body.items[1].giver);
    assert.equal(JSON.stringify(body).includes(sender.player.id), false);

    const visible = async () =>
      (await viewer.api.publicTestimonies(owner.player.id)).items.length;
    assert.equal(await visible(), 2);
    await viewer.api.block(sender.player.id);
    assert.equal(await visible(), 0);
    await viewer.api.unblock(sender.player.id);
    await sender.api.block(viewer.player.id);
    assert.equal(await visible(), 0);
    await sender.api.unblock(viewer.player.id);
    assert.equal(await visible(), 2);
  } finally {
    await f.runtime.dispose();
  }
});

test("scene memos are limited per pair, and each accepted memo notifies once", async () => {
  const f = await createAuthRuntime();
  try {
    const recipient = await f.register("受け取る人"),
      sender = await f.register("贈る人");
    const exchangeId = await connect(recipient, sender);
    for (let index = 0; index < 5; index += 1)
      await sender.api.sendScene(
        exchangeId,
        "impl",
        `${index + 1}回目に見た実装の場面`,
      );
    await assert.rejects(
      sender.api.sendScene(exchangeId, "impl", "6回目に見た実装の場面"),
      rejectsWith("PROOF_LIMIT"),
    );
    assert.equal(
      (
        await f.db
          .prepare(
            "SELECT COUNT(*) AS count FROM notification_outbox WHERE kind = 'testimony' AND account_id = ?",
          )
          .bind(recipient.player.id)
          .first<{ count: number }>()
      )?.count,
      5,
    );
    // The receiving setting is part of the insert condition, not only a pre-check.
    await recipient.api.saveSettings({
      allowVibe: false,
      allowProof: true,
      onlyConnected: true,
    });
    await assert.rejects(
      sender.api.sendImpression(exchangeId, "bridge", "丁寧", "説明が丁寧"),
      rejectsWith("RECEIVING_DISABLED"),
    );
  } finally {
    await f.runtime.dispose();
  }
});

test("sync keyset cursor does not skip rows removed during paging and keeps page numbers working", async () => {
  const f = await createAuthRuntime();
  try {
    const recipient = await f.register("たくさん届く人"),
      sender = await f.register("たくさん贈る人");
    const exchangeId = await connect(recipient, sender);
    const seed = await sender.api.sendScene(
      exchangeId,
      "impl",
      "最初に見た実装の場面",
    );
    const start = Date.parse("2026-01-01T00:00:00.000Z");
    await f.db.batch(
      Array.from({ length: 149 }, (_, index) =>
        f.db
          .prepare(
            `INSERT INTO testimonies(id, exchange_id, sender_id, recipient_id, kind, card, story, created_at)
            SELECT ?, exchange_id, sender_id, recipient_id, kind, card, story, ? FROM testimonies WHERE id = ?`,
          )
          .bind(
            crypto.randomUUID(),
            new Date(start + index * 1000).toISOString(),
            seed.id,
          ),
      ),
    );
    const sync = (query: string) =>
      fetch(`${f.base}/v1/sync?${query}`, {
        headers: { Cookie: recipient.cookie },
      });
    const first = (await (await sync("page=0")).json()) as {
      nextPage: number | null;
      nextCursor: string | null;
      inbox: { id: string }[];
    };
    assert.equal(first.inbox.length, 100);
    assert.equal(first.nextPage, 1);
    assert.ok(first.nextCursor);
    // Remove rows already delivered on the first page.
    await f.db.batch(
      first.inbox
        .slice(0, 10)
        .map((item) =>
          f.db
            .prepare("UPDATE testimonies SET removed_at = ? WHERE id = ?")
            .bind(new Date().toISOString(), item.id),
        ),
    );
    const continued = (await (
      await sync(`cursor=${encodeURIComponent(first.nextCursor)}`)
    ).json()) as {
      nextPage: number | null;
      nextCursor: string | null;
      inbox: { id: string }[];
    };
    assert.equal(continued.inbox.length, 50, "keyset paging skips nothing");
    assert.equal(continued.nextCursor, null);
    assert.equal(continued.nextPage, null);
    // Older clients still page by number (and see the known offset shift).
    const legacy = (await (await sync("page=1")).json()) as {
      inbox: { id: string }[];
    };
    assert.equal(legacy.inbox.length, 40);
    assert.equal((await sync("cursor=not-a-cursor")).status, 422);
    assert.equal((await recipient.api.getSnapshot()).inbox.length, 140);
  } finally {
    await f.runtime.dispose();
  }
});
