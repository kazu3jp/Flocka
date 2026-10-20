import assert from "node:assert/strict";
import { test } from "node:test";
import { ApiClientError } from "@flocka/api-client";
import {
  applySnapshot,
  buildPR,
  resolvePRDocument,
  fresh,
  inviteQR,
  parseInviteQR,
} from "@flocka/domain";
import { createAuthRuntime } from "./helpers/auth-runtime";

test("real player snapshots, private preferences, invitations, visibility and moderation synchronize", async () => {
  const f = await createAuthRuntime();
  try {
    const a = await f.register("ハル"),
      b = await f.register("ソラ"),
      c = await f.register("ミナト");
    await f.db
      .prepare("UPDATE auth_users SET terms_accepted = 0 WHERE id = ?")
      .bind(a.player.id)
      .run();
    await assert.rejects(
      a.api.createAccount(a.player.profile, a.player.self),
      (error) => error instanceof ApiClientError && error.status === 403,
    );
    await a.api.acceptTerms();
    assert.ok(
      (
        await f.db
          .prepare(
            "SELECT accepted_at FROM legal_acceptances WHERE account_id = ?",
          )
          .bind(a.player.id)
          .first()
      )?.accepted_at,
    );
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
    await b.api.approveExchange(exchange.id, "発表会", "メモを更新");
    assert.equal(
      (
        await f.db
          .prepare(
            "SELECT COUNT(*) AS count FROM notification_outbox WHERE kind = 'exchange' AND resource_id = ?",
          )
          .bind(exchange.id)
          .first()
      )?.count,
      2,
    );
    const piece = await b.api.sendScene(
      exchange.id,
      "impl",
      "動くアプリを最後まで作ってくれた",
    );
    assert.equal(
      (
        await f.db
          .prepare(
            "SELECT COUNT(*) AS count FROM notification_outbox WHERE kind = 'testimony' AND resource_id = ?",
          )
          .bind(piece.id)
          .first()
      )?.count,
      1,
    );
    const received = await a.api.getSnapshot();
    assert.equal(received.inbox[0].id, piece.id);
    assert.equal(
      applySnapshot(received, fresh()).proofs[0].exchangeId,
      exchange.id,
    );
    assert.equal(received.peers[0].profile.name, "ソラ");
    assert.equal((await b.api.getSnapshot()).sent[0].id, piece.id);
    await a.api.openTestimony(piece.id, "impl");
    await a.api.changeVisibility(piece.id, "public");
    assert.equal((await b.api.publicTestimonies(a.player.id)).items.length, 1);
    const additionalIds = Array.from({ length: 101 }, () =>
      crypto.randomUUID(),
    );
    await f.db.batch(
      additionalIds.map((id) =>
        f.db
          .prepare(
            `INSERT INTO testimonies(id, exchange_id, sender_id, recipient_id, kind, card, story, opened, visibility, created_at)
      SELECT ?, exchange_id, sender_id, recipient_id, kind, card, story, opened, visibility, created_at FROM testimonies WHERE id = ?`,
          )
          .bind(id, piece.id),
      ),
    );
    assert.equal(
      (await b.api.publicTestimonies(a.player.id)).items.length,
      102,
    );
    assert.equal((await a.api.getSnapshot()).inbox.length, 102);
    await b.api.block(a.player.id);
    assert.equal((await a.api.getSnapshot()).inbox.length, 0);
    await b.api.unblock(a.player.id);
    await f.db.batch(
      additionalIds.map((id) =>
        f.db.prepare("DELETE FROM testimonies WHERE id = ?").bind(id),
      ),
    );

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

test("decoration preferences and backups reject missing assets and invalid sticker layouts", async () => {
  const f = await createAuthRuntime();
  try {
    const owner = await f.register("装飾の検証");
    const initial = await owner.api.getSnapshot();
    const valid = {
      pattern: "dots",
      frame: "none",
      color: "rose",
      stickers: ["star"],
      layout: { star: { position: "br", size: 23, angle: 0 } },
    };
    const invalid = [
      { ...valid, pattern: "missing-pattern" },
      { ...valid, frame: "missing-frame" },
      { ...valid, color: "missing-color" },
      { ...valid, stickers: ["missing-sticker"] },
      { ...valid, stickers: ["star", "star"] },
      {
        ...valid,
        layout: { star: { position: "outside", size: 23, angle: 0 } },
      },
    ];
    for (const decoration of invalid) {
      await assert.rejects(
        owner.api.savePreferences(
          { ...initial.preferences.data, deco: { impl: decoration } },
          initial.preferences.revision,
        ),
        (error) => error instanceof ApiClientError && error.status === 422,
      );
      const snapshot = fresh();
      snapshot.profile = owner.player.profile;
      snapshot.deco.impl = decoration;
      await assert.rejects(
        owner.api.saveBackup(snapshot, null),
        (error) => error instanceof ApiClientError && error.status === 422,
      );
    }
    assert.equal(
      (await owner.api.getSnapshot()).preferences.revision,
      initial.preferences.revision,
    );
    await assert.rejects(
      owner.api.getBackup(),
      (error) => error instanceof ApiClientError && error.status === 404,
    );
    const saved = await owner.api.savePreferences(
      { ...initial.preferences.data, deco: { impl: valid } },
      initial.preferences.revision,
    );
    assert.equal(saved.data.deco.impl.layout?.star.angle, 0);
  } finally {
    await f.runtime.dispose();
  }
});

test("saved PR evidence survives stronger cards and becomes unverified when withdrawn", async () => {
  const runtime = await createAuthRuntime();
  try {
    const owner = await runtime.register("下書きの持ち主");
    await owner.api.updateProfile(owner.player.profile, ["focus", "idea"]);
    const peers = await Promise.all([
      runtime.register("仲間一"),
      runtime.register("仲間二"),
      runtime.register("仲間三"),
    ]);
    const exchanges: string[] = [];
    for (const peer of peers) {
      const invite = await owner.api.createInvite();
      const exchange = await peer.api.startExchange(invite.code);
      await owner.api.approveExchange(exchange.id, "発表会", "共同作業");
      await peer.api.approveExchange(exchange.id, "発表会", "共同作業");
      exchanges.push(exchange.id);
    }
    for (const index of [0, 1]) {
      const piece = await peers[index].api.sendScene(
        exchanges[index],
        "bridge",
        "みんなの意見をまとめた場面",
      );
      await owner.api.openTestimony(piece.id, "skip");
    }
    const initial = await owner.api.getSnapshot();
    const generated = buildPR(applySnapshot(initial, fresh()))!;
    const source = { card: generated.card.key, pieceIds: generated.pieceIds };
    await owner.api.savePreferences(
      {
        ...initial.preferences.data,
        prDraft: "編集して保存した本文",
        prDraftSource: source,
      },
      initial.preferences.revision,
    );
    for (const [index, peer] of peers.entries()) {
      const piece = await peer.api.sendScene(
        exchanges[index],
        "impl",
        "動く形まで実装した場面",
      );
      await owner.api.openTestimony(piece.id, "skip");
    }
    const saved = applySnapshot(await owner.api.getSnapshot(), fresh());
    assert.equal(buildPR(saved)!.card.key, "impl");
    assert.equal(saved.prDraft, "編集して保存した本文");
    assert.deepEqual(saved.prDraftSource, source);
    assert.equal(resolvePRDocument(saved).document!.card.key, "bridge");
    assert.deepEqual(
      resolvePRDocument(saved).document!.sources,
      generated.sources,
    );
    await owner.api.changeVisibility(source.pieceIds[0], "hidden");
    assert.equal(
      resolvePRDocument(applySnapshot(await owner.api.getSnapshot(), fresh()))
        .sourceKnown,
      false,
    );
  } finally {
    await runtime.runtime.dispose();
  }
});

test("moderation paging does not skip requests after earlier ones are resolved", async () => {
  const f = await createAuthRuntime();
  try {
    const owner = await f.register("ハル"),
      sender = await f.register("ソラ"),
      admin = await f.register("ミナト");
    const invite = await owner.api.createInvite();
    const exchange = await sender.api.startExchange(invite.code);
    await owner.api.approveExchange(exchange.id, "発表会", "同じチーム");
    await sender.api.approveExchange(exchange.id, "発表会", "同じチーム");
    const piece = await sender.api.sendScene(
      exchange.id,
      "impl",
      "動くアプリを最後まで作ってくれた",
    );
    const ids = Array.from({ length: 52 }, () => crypto.randomUUID()).sort();
    // Equal timestamps for the first pair exercise the id tie-breaker.
    const at = (index: number) =>
      new Date(
        Date.UTC(2026, 0, 1, 0, 0, Math.max(0, index - 1)),
      ).toISOString();
    await f.db.batch(
      ids.map((id, index) =>
        f.db
          .prepare(
            "INSERT INTO moderation_requests(id, account_id, testimony_id, kind, reason, created_at) VALUES (?, ?, ?, 'report', ?, ?)",
          )
          .bind(id, owner.player.id, piece.id, `理由${index}`, at(index)),
      ),
    );
    // Changing admins restarts the runtime, so it follows the direct inserts.
    await f.setAdmins([admin.player.id]);
    const first = await admin.api.pendingModeration();
    assert.deepEqual(
      first.items.map((item) => item.id),
      ids.slice(0, 50),
    );
    assert.deepEqual(first.next, { at: at(49), id: ids[49] });
    await admin.api.resolveModeration(ids[0], "reviewed", "確認しました");
    const second = await admin.api.pendingModeration(first.next);
    assert.deepEqual(
      second.items.map((item) => item.id),
      ids.slice(50),
    );
    assert.equal(second.next, null);
    await assert.rejects(
      admin.api.pendingModeration({ at: at(1), id: "not-a-uuid" }),
      (error) => error instanceof ApiClientError && error.status === 422,
    );
  } finally {
    await f.runtime.dispose();
  }
});
