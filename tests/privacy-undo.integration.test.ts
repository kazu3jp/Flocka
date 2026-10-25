import assert from "node:assert/strict";
import { test } from "node:test";
import { ApiClientError } from "@flocka/api-client";
import { createAuthRuntime } from "./helpers/auth-runtime";

test("legacy privacy data migrates and stale undo cannot overwrite newer visibility or blocks", async () => {
  const f = await createAuthRuntime({
    throughMigration: "0008_deletion_write_guards.sql",
  });
  try {
    // Independent of the privacy columns under test: the API reads accounts.sns_links_json.
    await f.applyMigration("0012_sns_links.sql");
    const owner = await f.register("受け取り手"),
      peer = await f.register("贈り手");
    const invitation = await owner.api.createInvite();
    const exchange = await peer.api.startExchange(invitation.code);
    await peer.api.approveExchange(exchange.id, "学内の交流会", "作品の紹介");
    await owner.api.approveExchange(exchange.id, "学内の交流会", "作品の紹介");
    const piece = await peer.api.sendImpression(
      exchange.id,
      "bridge",
      "分かりやすい",
      "みんなの意見を整理してくれた",
    );
    await f.db
      .prepare(
        "INSERT INTO blocks(account_id, blocked_id, created_at) VALUES(?, ?, ?)",
      )
      .bind(owner.player.id, peer.player.id, new Date().toISOString())
      .run();
    await f.applyMigration("0009_privacy_undo.sql");
    const legacy = await f.db
      .prepare(
        "SELECT mutation_id FROM blocks WHERE account_id = ? AND blocked_id = ?",
      )
      .bind(owner.player.id, peer.player.id)
      .first<{ mutation_id: string }>();
    assert.equal(legacy!.mutation_id.length, 32);
    assert.equal(
      (await owner.api.block(peer.player.id)).undoToken,
      null,
      "an existing block must not acquire another action's undo",
    );
    await owner.api.unblock(peer.player.id);
    const original = (await owner.api.getTestimonies()).items[0];
    assert.equal(original.visibilityRevision, 1);
    await Promise.all([
      owner.api.openTestimony(piece.id, "skip"),
      owner.api.changeVisibility(
        piece.id,
        "public",
        original.visibilityRevision,
      ),
    ]);
    const opened = (await owner.api.getTestimonies()).items[0];
    assert.equal(opened.opened, true);
    assert.equal(opened.visibility, "public");
    assert.equal(opened.visibilityRevision, 2);
    await owner.api.changeVisibility(piece.id, "hidden", 2);
    const backToPublic = await owner.api.changeVisibility(
      piece.id,
      "public",
      3,
    );
    assert.equal(backToPublic.visibilityRevision, 4);
    await assert.rejects(
      owner.api.changeVisibility(piece.id, "private", 2),
      (error) =>
        error instanceof ApiClientError && error.code === "VISIBILITY_CONFLICT",
    );
    assert.equal(
      (await owner.api.getTestimonies()).items[0].visibility,
      "public",
    );
    await assert.rejects(
      peer.api.changeVisibility(piece.id, "private", 4),
      (error) => error instanceof ApiClientError && error.status === 404,
    );
    const restored = await owner.api.changeVisibility(piece.id, "private", 4);
    assert.equal(restored.visibilityRevision, 5);

    const first = await owner.api.block(peer.player.id);
    assert.ok(first.undoToken);
    await owner.api.unblock(peer.player.id, first.undoToken!);
    const second = await owner.api.block(peer.player.id);
    assert.ok(second.undoToken);
    assert.notEqual(first.undoToken, second.undoToken);
    await assert.rejects(
      owner.api.unblock(peer.player.id, first.undoToken!),
      (error) =>
        error instanceof ApiClientError && error.code === "BLOCK_CONFLICT",
    );
    assert.ok((await owner.api.getSnapshot()).blocked.includes(peer.player.id));
    await owner.api.unblock(peer.player.id, second.undoToken!);
    assert.equal(
      (await owner.api.getSnapshot()).blocked.includes(peer.player.id),
      false,
    );
  } finally {
    await f.runtime.dispose();
  }
});
