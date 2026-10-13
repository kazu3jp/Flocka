import assert from "node:assert/strict";
import { test } from "node:test";
import { ApiClientError } from "@flocka/api-client";
import { inviteQR, parseInviteQR } from "@flocka/domain";
import { createAuthRuntime } from "./helpers/auth-runtime";

test("real player snapshots, private preferences, invitations, visibility and moderation synchronize", async () => {
  const f = await createAuthRuntime();
  try {
    const a = await f.register("ハル"),
      b = await f.register("ソラ"),
      c = await f.register("ミナト");
    const first = await a.api.getSnapshot();
    assert.equal(first.player.id, a.player.id);
    assert.equal(first.inbox.length, 0);
    assert.equal(first.exchanges.length, 0);
    const prefs = {
      ...first.preferences.data,
      showcase: ["impl"],
      prDraft: "自分の下書き",
    };
    const saved = await a.api.savePreferences(
      prefs,
      first.preferences.revision,
    );
    assert.equal(saved.revision, first.preferences.revision + 1);
    await assert.rejects(
      a.api.savePreferences(prefs, first.preferences.revision),
      (error) => error instanceof ApiClientError && error.status === 409,
    );
    assert.equal((await b.api.getSnapshot()).preferences.data.prDraft, null);
    const invite = await a.api.createInvite();
    assert.equal(parseInviteQR(inviteQR(invite.code)), invite.code);
    assert.equal((await b.api.previewInvite(invite.code)).id, a.player.id);
    const exchange = await b.api.startExchange(invite.code);
    await a.api.approveExchange(exchange.id, "発表会", "同じチーム");
    await b.api.approveExchange(exchange.id, "発表会", "同じチーム");
    const piece = await b.api.sendScene(
      exchange.id,
      "impl",
      "動くアプリを最後まで作ってくれた",
    );
    const received = await a.api.getSnapshot();
    assert.equal(received.inbox[0].id, piece.id);
    assert.equal(received.peers[0].profile.name, "ソラ");
    assert.equal((await b.api.getSnapshot()).sent[0].id, piece.id);
    await a.api.openTestimony(piece.id, "impl");
    await a.api.changeVisibility(piece.id, "public");
    assert.equal((await b.api.publicTestimonies(a.player.id)).items.length, 1);
    await assert.rejects(
      c.api.publicTestimonies(a.player.id),
      (error) => error instanceof ApiClientError && error.status === 403,
    );
    await a.api.changeVisibility(piece.id, "private");
    assert.equal((await b.api.publicTestimonies(a.player.id)).items.length, 0);
    const request = await a.api.requestModeration(
      piece.id,
      "report",
      "不適切な内容",
    );
    assert.equal((await a.api.getSnapshot()).requests[0].id, request.id);
    await a.api.withdrawRequest(request.id);
    assert.equal((await a.api.getSnapshot()).requests[0].withdrawn, true);
    await assert.rejects(
      a.api.pendingModeration(),
      (error) => error instanceof ApiClientError && error.status === 403,
    );
    await a.api.registerPushDevice("ExponentPushToken[abcdefghij]", "ios");
    await a.api.unregisterPushDevice("ExponentPushToken[abcdefghij]");
    await f.setAdmins([c.player.id]);
    const second = await a.api.requestModeration(piece.id, "deletion");
    assert.equal((await c.api.pendingModeration()).items[0].id, second.id);
    const resolutions = await Promise.allSettled([
      c.api.resolveModeration(second.id, "removed", "規約に違反しています"),
      c.api.resolveModeration(second.id, "removed", "重複対応"),
    ]);
    assert.equal(
      resolutions.filter((result) => result.status === "fulfilled").length,
      1,
    );
    assert.equal(
      (
        await (
          await f.runtime.getD1Database("DB")
        )
          .prepare(
            "SELECT COUNT(*) AS count FROM moderation_audit WHERE request_id = ?",
          )
          .bind(second.id)
          .first()
      )?.count,
      1,
    );
    assert.equal((await c.api.pendingModeration()).items.length, 0);
    const after = await a.api.getSnapshot();
    assert.equal(after.inbox.length, 0);
    assert.equal(
      after.requests.find((item) => item.id === second.id)?.status,
      "removed",
    );
    await a.api.block(b.player.id);
    assert.equal((await a.api.getSnapshot()).inbox.length, 0);
    await a.api.unblock(b.player.id);
    await b.api.cancelExchange(exchange.id);
    assert.equal((await a.api.getSnapshot()).exchanges[0].status, "cancelled");
  } finally {
    await f.runtime.dispose();
  }
});
