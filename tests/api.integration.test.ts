import { readFileSync } from "node:fs";
import { createAuthRuntime } from "./helpers/auth-runtime";
import assert from "node:assert/strict";
import { test } from "node:test";
import { ApiClientError, FlockaApiClient } from "@flocka/api-client";
import { demoState } from "@flocka/domain";

test("Workers, D1, R2 and the typed client perform authenticated real operations", async () => {
  const { runtime, base, register } = await createAuthRuntime();
  try {
    const anonymous = new FlockaApiClient(base, undefined, true);
    const [sessionA, sessionB, sessionC] = await Promise.all([
      register("プレイヤーA"),
      register("プレイヤーB"),
      register("プレイヤーC"),
    ]);
    const a = sessionA.api,
      b = sessionB.api,
      c = sessionC.api;
    assert.equal((await a.getMe()).id, sessionA.player.id);
    await assert.rejects(
      anonymous.getMe(),
      (error) => error instanceof ApiClientError && error.status === 401,
    );
    const blockedOrigin = await fetch(base + "/health", {
      headers: { Origin: "https://untrusted.example" },
    });
    assert.equal(blockedOrigin.status, 403);

    const invite = await a.createInvite(),
      exchange = await b.startExchange(invite.code);
    assert.equal(exchange.status, "pending");
    assert.equal(exchange.peer.id, sessionA.player.id);
    assert.equal((await b.startExchange(invite.code)).id, exchange.id);
    await assert.rejects(
      c.startExchange(invite.code),
      (error) => error instanceof ApiClientError && error.status === 409,
    );
    await assert.rejects(
      b.sendImpression(
        exchange.id,
        "bridge",
        "分かりやすい",
        "説明が分かりやすかった",
      ),
      (error) => error instanceof ApiClientError && error.status === 409,
    );
    const approvedB = await b.approveExchange(
      exchange.id,
      "学内ハッカソン",
      "同じチームで開発",
    );
    assert.equal(approvedB.status, "pending");
    assert.equal(approvedB.myApproved, true);
    await assert.rejects(
      c.approveExchange(exchange.id, "場所", "きっかけ"),
      (error) => error instanceof ApiClientError && error.status === 404,
    );
    const approvedA = await a.approveExchange(
      exchange.id,
      "Aだけの場所メモ",
      "Aだけのきっかけ",
    );
    assert.equal(approvedA.status, "accepted");
    assert.equal(
      (await b.getExchanges()).items[0].context.place,
      "学内ハッカソン",
    );
    assert.equal(
      (await a.getTestimonies()).items.length,
      0,
      "acceptance must not fabricate an envelope",
    );

    const testimony = await b.sendImpression(
      exchange.id,
      "bridge",
      "分かりやすい",
      "説明が分かりやすかった",
    );
    const inbox = await a.getTestimonies();
    assert.equal(inbox.items.length, 1);
    assert.equal(inbox.items[0].opened, false);
    assert.equal(inbox.items[0].fromId, sessionB.player.id);
    await assert.rejects(
      b.sendImpression(exchange.id, "bridge", "分かりやすい", "別の印象"),
      (error) => error instanceof ApiClientError && error.status === 409,
    );
    await assert.rejects(
      c.openTestimony(testimony.id, "bridge"),
      (error) => error instanceof ApiClientError && error.status === 404,
    );
    assert.equal((await a.openTestimony(testimony.id, "focus")).guess, "focus");
    assert.equal(
      (await a.openTestimony(testimony.id, "bridge")).guess,
      "focus",
    );
    const request = async (
      cookie: string,
      path: string,
      method = "POST",
      value?: unknown,
    ) =>
      fetch(base + path, {
        method,
        headers: {
          Cookie: cookie,
          ...(value ? { "Content-Type": "application/json" } : {}),
        },
        body: value ? JSON.stringify(value) : undefined,
      });
    assert.equal(
      (
        await request(sessionA.cookie, "/v1/me/settings", "PUT", {
          allowVibe: true,
          allowProof: false,
          onlyConnected: true,
        })
      ).status,
      200,
    );
    await assert.rejects(
      b.sendScene(exchange.id, "bridge", "登壇後、図を描いて説明してくれた"),
      (error) => error instanceof ApiClientError && error.status === 403,
    );
    assert.equal(
      (
        await request(sessionA.cookie, "/v1/blocks", "POST", {
          playerId: sessionB.player.id,
        })
      ).status,
      200,
    );
    assert.equal((await a.getTestimonies()).items.length, 0);
    assert.equal((await a.getExchanges()).items.length, 0);
    await request(
      sessionA.cookie,
      "/v1/blocks/" + sessionB.player.id,
      "DELETE",
    );
    assert.equal((await a.getTestimonies()).items.length, 1);

    const snapshot = demoState(),
      first = await a.saveBackup(snapshot, null);
    assert.equal(first.revision, 1);
    await assert.rejects(
      b.getBackup(),
      (error) => error instanceof ApiClientError && error.status === 404,
    );
    await assert.rejects(
      a.saveBackup(snapshot, null),
      (error) => error instanceof ApiClientError && error.status === 409,
    );
    const second = await a.saveBackup(snapshot, first.revision);
    assert.equal(second.revision, 2);
    assert.equal(
      (await a.getTestimonies()).items.length,
      1,
      "client backups must not inject received testimonies",
    );

    const bytes = readFileSync(
      new URL("../apps/mobile/assets/favicon.png", import.meta.url),
    );
    const photo = "data:image/png;base64," + bytes.toString("base64"),
      avatarKey = await a.uploadAvatar(photo);
    assert.equal(await a.getAvatar(), photo);
    snapshot.profile.avatar.type = "photo";
    snapshot.profile.avatar.photo = photo;
    const withPhoto = await a.saveBackup(snapshot, second.revision, avatarKey);
    assert.equal(withPhoto.snapshot.profile.avatar.photo, undefined);
    assert.equal(await a.getAvatar(true), photo);
    await assert.rejects(
      b.getAvatar(),
      (error) => error instanceof ApiClientError && error.status === 404,
    );
    await assert.rejects(
      b.saveBackup(snapshot, null, avatarKey),
      (error) => error instanceof ApiClientError && error.status === 422,
    );
    const newerKey = await a.uploadAvatar(
      "data:image/png;base64," +
        Buffer.concat([bytes, Buffer.from("different")]).toString("base64"),
    );
    await assert.rejects(
      a.saveBackup(snapshot, second.revision, newerKey),
      (error) => error instanceof ApiClientError && error.status === 409,
    );
    assert.equal(
      await a.getAvatar(true),
      photo,
      "failed writes must preserve the photo of the last successful backup",
    );
    const invalid = await fetch(base + "/v1/me/avatar", {
      method: "PUT",
      headers: {
        Cookie: sessionA.cookie,
        "Content-Type": "image/jpeg",
      },
      body: "not an image",
    });
    assert.equal(invalid.status, 422);
    const oversized = await fetch(base + "/v1/me/avatar", {
      method: "PUT",
      headers: {
        Cookie: sessionA.cookie,
        "Content-Type": "image/jpeg",
      },
      body: new Uint8Array(1024 * 1024 + 1),
    });
    assert.equal(oversized.status, 413);
    assert.equal(
      (
        await request(sessionC.cookie, "/v1/moderation", "POST", {
          pieceId: testimony.id,
          kind: "report",
          reason: "その他",
        })
      ).status,
      404,
    );
    assert.equal(
      (
        await request(sessionA.cookie, "/v1/moderation", "POST", {
          pieceId: testimony.id,
          kind: "report",
          reason: "その他",
        })
      ).status,
      201,
    );
  } finally {
    await runtime.dispose();
  }
});
