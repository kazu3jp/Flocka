import { ApiClientError } from "@flocka/api-client";
import { symmetricEncrypt } from "better-auth/crypto";
import assert from "node:assert/strict";
import { test } from "node:test";
import { fresh, applySnapshot } from "@flocka/domain";
import { createAuthRuntime } from "./helpers/auth-runtime";

function deletionLink(emails: { subject: string; text: string }[]) {
  const mail = emails
    .slice()
    .reverse()
    .find((mail) => mail.subject === "Flocka：アカウント削除の確認");
  assert.ok(mail);
  const link = /https?:\/\/[^\s]+/.exec(mail.text)?.[0];
  assert.ok(link);
  return new URL(link);
}

test("verified deletion erases D1, R2 and mirrored peer data without deleting unrelated accounts", async () => {
  const f = await createAuthRuntime();
  try {
    const a = await f.register("削除する人"),
      b = await f.register("残る人"),
      c = await f.register("別の人");
    const invite = await a.api.createInvite();
    const exchange = await b.api.startExchange(invite.code);
    await a.api.approveExchange(exchange.id, "発表会", "同じ班");
    await b.api.approveExchange(exchange.id, "発表会", "同じ班");
    const piece = await a.api.sendScene(
      exchange.id,
      "impl",
      "最後まで動くものを実装した場面",
    );
    await b.api.requestModeration(piece.id, "report", "その他");
    const snapshot = fresh();
    snapshot.profile = b.player.profile;
    snapshot.connections = [
      {
        id: exchange.id,
        peerId: a.player.id,
        status: "accepted",
        myApproved: true,
        vibe: null,
        later: false,
        context: { place: "発表会", trigger: "同じ班" },
      },
    ];
    snapshot.proofs = applySnapshot(await b.api.getSnapshot(), fresh()).proofs;
    const second = await a.api.sendScene(
      exchange.id,
      "impl",
      "別の場面で見た共同作業の記録",
    );
    snapshot.prDraft = "削除される証言に基づく下書き";
    snapshot.prDraftSource = { card: "impl", pieceIds: [piece.id, second.id] };
    const preferences = await b.api.getSnapshot();
    await b.api.savePreferences(
      {
        ...preferences.preferences.data,
        prDraft: snapshot.prDraft,
        prDraftSource: snapshot.prDraftSource,
      },
      preferences.preferences.revision,
    );
    snapshot.blocked = [a.player.id, c.player.id];
    await b.api.saveBackup(snapshot, null);
    const { AVATARS: bucket } = await f.runtime.getBindings<{
      AVATARS: {
        put(key: string, value: string): Promise<unknown>;
        get(key: string): Promise<unknown>;
        list(options: {
          prefix: string;
        }): Promise<{ objects: { key: string }[] }>;
      };
    }>();
    await bucket.put(`avatars/${a.player.id}/current`, "photo");
    await bucket.put(`avatars/${a.player.id}/old-backup`, "old photo");
    await bucket.put(`avatars/${b.player.id}/keep`, "keep photo");
    await a.api.acceptTerms();
    await a.api.registerPushDevice("ExponentPushToken[deletiontest]", "ios");
    const request = await f.auth(
      "/delete-user",
      { callbackURL: "http://localhost:8081/delete-account" },
      a.cookie,
      a.ip,
    );
    assert.equal(request.status, 200, await request.text());
    const link = deletionLink(f.emails),
      token = link.searchParams.get("token");
    assert.ok(token);
    assert.equal(link.pathname, "/delete-account");
    assert.ok(
      await f.db
        .prepare("SELECT 1 FROM auth_users WHERE id = ?")
        .bind(a.player.id)
        .first(),
      "requesting mail must not delete",
    );
    const scanner = await f.auth(
      `/delete-user/callback?token=${token}`,
      undefined,
      a.cookie,
      a.ip,
    );
    assert.equal(scanner.status, 405);
    const wrong = await f.auth(
      "/delete-user",
      { token: "wrong-token" },
      a.cookie,
      a.ip,
    );
    assert.equal(wrong.status, 404);
    const confirm = await f.auth("/delete-user", { token }, a.cookie, a.ip);
    assert.equal(confirm.status, 200, await confirm.text());
    for (const table of ["accounts", "auth_users"])
      assert.equal(
        await f.db
          .prepare(`SELECT 1 FROM ${table} WHERE id = ?`)
          .bind(a.player.id)
          .first(),
        null,
      );
    for (const table of ["auth_sessions", "auth_accounts"])
      assert.equal(
        await f.db
          .prepare(`SELECT 1 FROM ${table} WHERE user_id = ?`)
          .bind(a.player.id)
          .first(),
        null,
      );
    assert.equal(
      (await bucket.list({ prefix: `avatars/${a.player.id}/` })).objects.length,
      0,
    );
    assert.ok(await bucket.get(`avatars/${b.player.id}/keep`));
    assert.equal(
      await f.db
        .prepare("SELECT 1 FROM testimonies WHERE id = ?")
        .bind(piece.id)
        .first(),
      null,
    );
    assert.equal(
      await f.db
        .prepare("SELECT 1 FROM exchanges WHERE id = ?")
        .bind(exchange.id)
        .first(),
      null,
    );
    assert.equal(
      await f.db
        .prepare("SELECT 1 FROM moderation_requests WHERE testimony_id = ?")
        .bind(piece.id)
        .first(),
      null,
    );
    assert.equal(
      await f.db
        .prepare(
          "SELECT 1 FROM notification_outbox WHERE resource_id IN (?, ?)",
        )
        .bind(piece.id, exchange.id)
        .first(),
      null,
    );
    assert.equal(
      await f.db.prepare("SELECT 1 FROM account_deletions").first(),
      null,
    );
    const backup = await b.api.getBackup();
    assert.equal(backup.revision, 2);
    assert.equal(backup.snapshot.connections.length, 0);
    assert.equal(backup.snapshot.proofs.length, 0);
    assert.equal(backup.snapshot.prDraft, null);
    assert.equal(backup.snapshot.prDraftSource, undefined);
    assert.equal(
      (await b.api.getSnapshot()).preferences.data.prDraftSource,
      undefined,
    );
    assert.deepEqual(backup.snapshot.blocked, [c.player.id]);
    const staleBackup = await b.api.saveBackup(snapshot, backup.revision);
    assert.equal(staleBackup.revision, 3);
    assert.equal(
      JSON.stringify(staleBackup.snapshot).includes(a.player.id),
      false,
      "a stale device cannot restore deleted peer references",
    );
    assert.equal(staleBackup.snapshot.prDraft, null);
    assert.equal(staleBackup.snapshot.prDraftSource, undefined);
    const currentPreferences = (await b.api.getSnapshot()).preferences;
    await assert.rejects(
      b.api.savePreferences(
        {
          ...currentPreferences.data,
          prDraft: snapshot.prDraft,
          prDraftSource: snapshot.prDraftSource,
        },
        currentPreferences.revision,
      ),
      (error) =>
        error instanceof ApiClientError &&
        error.code === "PR_SOURCE_UNAVAILABLE",
    );
    assert.equal(
      (await b.api.getSnapshot()).preferences.revision,
      currentPreferences.revision,
    );
    const metadataOnly = {
      ...fresh(),
      profile: b.player.profile,
      prDraft: snapshot.prDraft,
      prDraftSource: snapshot.prDraftSource,
    };
    const cleaned = await b.api.saveBackup(metadataOnly, staleBackup.revision);
    assert.equal(cleaned.snapshot.prDraft, null);
    assert.equal(cleaned.snapshot.prDraftSource, undefined);
    assert.equal((await b.api.getSnapshot()).exchanges.length, 0);
    assert.equal((await c.api.getSnapshot()).player.id, c.player.id);
    const stale = await f.auth(
      "/get-session",
      undefined,
      a.cookie,
      "192.0.2.200",
    );
    assert.equal(await stale.json(), null);
    const login = await f.auth(
      "/sign-in/email",
      { email: a.email, password: a.password },
      undefined,
      "192.0.2.201",
    );
    assert.equal(login.status, 401);
  } finally {
    await f.runtime.dispose();
  }
});

test("deletion confirmation requires the matching logged-in account, unexpired token and allowed return URL", async () => {
  const f = await createAuthRuntime();
  try {
    const a = await f.authenticate("本人"),
      b = await f.authenticate("別人");
    assert.equal(
      (
        await f.auth(
          "/delete-user",
          { callbackURL: "https://attacker.test/delete-account" },
          a.cookie,
          a.ip,
        )
      ).status,
      403,
    );
    f.mailStatus.value = 422;
    const failedMail = await f.auth(
      "/delete-user",
      { callbackURL: "http://localhost:8081/delete-account" },
      a.cookie,
      a.ip,
    );
    assert.equal(failedMail.status, 502);
    f.mailStatus.value = 200;
    const sent = await f.auth(
      "/delete-user",
      { callbackURL: "http://localhost:8081/delete-account" },
      a.cookie,
      "192.0.2.210",
    );
    assert.equal(sent.status, 200, await sent.text());
    const token = deletionLink(f.emails).searchParams.get("token");
    assert.equal(
      (await f.auth("/delete-user", { token }, undefined, "192.0.2.211"))
        .status,
      401,
    );
    assert.equal(
      (await f.auth("/delete-user", { token }, b.cookie, b.ip)).status,
      404,
    );
    // Better Auth consumes a token even on an account mismatch. A new email is required.
    const resend = await f.auth(
      "/delete-user",
      { callbackURL: "http://localhost:8081/delete-account" },
      a.cookie,
      "192.0.2.212",
    );
    assert.equal(resend.status, 200);
    const expired = deletionLink(f.emails).searchParams.get("token");
    await f.db
      .prepare(
        "UPDATE auth_verifications SET expires_at = 0 WHERE identifier = ?",
      )
      .bind(`delete-account-${expired}`)
      .run();
    assert.equal(
      (
        await f.auth(
          "/delete-user",
          { token: expired },
          a.cookie,
          "192.0.2.213",
        )
      ).status,
      404,
    );
    assert.equal(
      await f.db.prepare("SELECT 1 FROM account_deletions").first(),
      null,
    );
  } finally {
    await f.runtime.dispose();
  }
});

test("provider failure remains pending, disables all sessions and recovers through the cron", async () => {
  const f = await createAuthRuntime({ appleCredentials: true });
  try {
    const a = await f.register("連携アカウント");
    const now = Date.now();
    await f.db
      .prepare(
        "INSERT INTO auth_accounts(id, account_id, provider_id, user_id, access_token, refresh_token, created_at, updated_at) VALUES('apple-account', 'apple-subject', 'apple', ?, 'test-access', 'test-refresh', ?, ?)",
      )
      .bind(a.player.id, now, now)
      .run();
    await a.api.registerPushDevice("ExponentPushToken[deletionpending]", "ios");
    const sent = await f.auth(
      "/delete-user",
      { callbackURL: "http://localhost:8081/delete-account" },
      a.cookie,
      a.ip,
    );
    assert.equal(sent.status, 200);
    f.revocations.status = 503;
    const response = await f.auth(
      "/delete-user",
      { token: deletionLink(f.emails).searchParams.get("token") },
      a.cookie,
      a.ip,
    );
    assert.equal(response.status, 503, await response.clone().text());
    assert.equal((await response.json()).code, "ACCOUNT_DELETION_PENDING");
    assert.ok(
      await f.db
        .prepare("SELECT 1 FROM account_deletions WHERE account_id = ?")
        .bind(a.player.id)
        .first(),
    );
    assert.equal(
      await f.db
        .prepare("SELECT 1 FROM auth_sessions WHERE user_id = ?")
        .bind(a.player.id)
        .first(),
      null,
    );
    assert.equal(
      await f.db
        .prepare("SELECT 1 FROM push_devices WHERE account_id = ?")
        .bind(a.player.id)
        .first(),
      null,
    );
    const login = await f.auth(
      "/sign-in/email",
      { email: a.email, password: a.password },
      undefined,
      "192.0.2.214",
    );
    assert.equal(login.status, 403);
    assert.equal((await login.json()).code, "ACCOUNT_DELETION_PENDING");
    await assert.rejects(
      f.db
        .prepare(
          "UPDATE auth_accounts SET access_token = 'new-token' WHERE id = 'apple-account'",
        )
        .run(),
      /ACCOUNT_DELETION_PENDING/,
    );
    await assert.rejects(
      f.db
        .prepare(
          "INSERT INTO auth_sessions(id, token, user_id, expires_at, created_at, updated_at) VALUES('racing-session', 'racing-token', ?, ?, ?, ?)",
        )
        .bind(a.player.id, now + 3600000, now, now)
        .run(),
      /ACCOUNT_DELETION_PENDING/,
    );
    assert.equal(f.revocations.calls.length, 1);
    const request = new URLSearchParams(f.revocations.calls[0].body);
    assert.equal(request.get("client_id"), "test-apple-client");
    assert.equal(request.get("client_secret"), "test-apple-secret");
    assert.equal(request.get("token"), "test-refresh");
    assert.equal(request.get("token_type_hint"), "refresh_token");
    f.revocations.status = 200;
    await f.db
      .prepare(
        "UPDATE account_deletions SET retry_after = '2000-01-01T00:00:00.000Z'",
      )
      .run();
    const cron = await fetch(
      f.base + "/cdn-cgi/local/scheduled?cron=*/5%20*%20*%20*%20*&format=json",
    );
    assert.equal(cron.status, 200, await cron.text());
    assert.equal(f.revocations.calls.length, 2);
    assert.equal(
      await f.db.prepare("SELECT 1 FROM account_deletions").first(),
      null,
    );
    assert.equal(
      await f.db
        .prepare("SELECT 1 FROM auth_users WHERE id = ?")
        .bind(a.player.id)
        .first(),
      null,
    );
    assert.equal(
      await f.db
        .prepare("SELECT 1 FROM accounts WHERE id = ?")
        .bind(a.player.id)
        .first(),
      null,
    );
  } finally {
    await f.runtime.dispose();
  }
});

test("avatar deletion drains multiple real R2 pages before claiming completion", async () => {
  const f = await createAuthRuntime();
  try {
    const a = await f.register("写真を削除");
    const { AVATARS: bucket } = await f.runtime.getBindings<{
      AVATARS: {
        put(key: string, value: string): Promise<unknown>;
        list(options: {
          prefix: string;
        }): Promise<{ objects: { key: string }[] }>;
      };
    }>();
    for (let start = 0; start < 501; start += 50)
      await Promise.all(
        Array.from({ length: Math.min(50, 501 - start) }, (_, index) =>
          bucket.put(`avatars/${a.player.id}/${start + index}`, "image"),
        ),
      );
    assert.equal(
      (
        await f.auth(
          "/delete-user",
          { callbackURL: "http://localhost:8081/delete-account" },
          a.cookie,
          a.ip,
        )
      ).status,
      200,
    );
    const response = await f.auth(
      "/delete-user",
      { token: deletionLink(f.emails).searchParams.get("token") },
      a.cookie,
      a.ip,
    );
    assert.equal(response.status, 503);
    assert.equal((await response.json()).code, "ACCOUNT_DELETION_PENDING");
    assert.equal(
      (await bucket.list({ prefix: `avatars/${a.player.id}/` })).objects.length,
      1,
    );
    assert.ok(
      await f.db
        .prepare("SELECT 1 FROM accounts WHERE id = ?")
        .bind(a.player.id)
        .first(),
    );
    await f.db
      .prepare(
        "UPDATE account_deletions SET retry_after = '2000-01-01T00:00:00.000Z'",
      )
      .run();
    const cron = await fetch(
      f.base + "/cdn-cgi/local/scheduled?cron=*/5%20*%20*%20*%20*&format=json",
    );
    assert.equal(cron.status, 200, await cron.text());
    assert.equal(
      (await bucket.list({ prefix: `avatars/${a.player.id}/` })).objects.length,
      0,
    );
    assert.equal(
      await f.db.prepare("SELECT 1 FROM account_deletions").first(),
      null,
    );
    assert.equal(
      await f.db
        .prepare("SELECT 1 FROM auth_users WHERE id = ?")
        .bind(a.player.id)
        .first(),
      null,
    );
  } finally {
    await f.runtime.dispose();
  }
});

test("accounts without a completed profile can delete themselves, and missing provider tokens require reauthentication", async () => {
  const f = await createAuthRuntime();
  try {
    const a = await f.authenticate("登録途中");
    const now = Date.now();
    const user = await f.db
      .prepare("SELECT id FROM auth_users WHERE email = ?")
      .bind(a.email)
      .first<{ id: string }>();
    assert.ok(user);
    await f.db
      .prepare(
        "INSERT INTO auth_accounts(id, account_id, provider_id, user_id, created_at, updated_at) VALUES('missing-token', 'apple-subject', 'apple', ?, ?, ?)",
      )
      .bind(user.id, now, now)
      .run();
    assert.equal(
      (
        await f.auth(
          "/delete-user",
          { callbackURL: "flocka://delete-account" },
          a.cookie,
          a.ip,
        )
      ).status,
      200,
    );
    const message = f.emails.at(-1)!;
    const token = /flocka:\/\/delete-account\?token=([^\s]+)/.exec(
      message.text,
    )?.[1];
    assert.ok(token);
    const response = await f.auth("/delete-user", { token }, a.cookie, a.ip);
    assert.equal(response.status, 400);
    assert.equal(
      (await response.json()).code,
      "PROVIDER_REAUTHENTICATION_REQUIRED",
    );
    assert.equal(
      await f.db.prepare("SELECT 1 FROM account_deletions").first(),
      null,
    );
    assert.ok(
      (
        await (
          await f.auth("/get-session", undefined, a.cookie, "192.0.2.215")
        ).json()
      ).user,
    );
    // Remove this test-only linkage to exercise the auth-only deletion path.
    await f.db
      .prepare("DELETE FROM auth_accounts WHERE id = 'missing-token'")
      .run();
    assert.equal(
      (
        await f.auth(
          "/delete-user",
          { callbackURL: "http://localhost:8081/delete-account" },
          a.cookie,
          "192.0.2.216",
        )
      ).status,
      200,
    );
    const confirm = await f.auth(
      "/delete-user",
      { token: deletionLink(f.emails).searchParams.get("token") },
      a.cookie,
      "192.0.2.217",
    );
    assert.equal(confirm.status, 200, await confirm.text());
    assert.equal(
      await f.db
        .prepare("SELECT 1 FROM auth_users WHERE id = ?")
        .bind(user.id)
        .first(),
      null,
    );
  } finally {
    await f.runtime.dispose();
  }
});

test("Google revocation decrypts Better Auth tokens and recognizes only an already-invalid token", async () => {
  const f = await createAuthRuntime();
  try {
    const a = await f.register("Google連携");
    const { BETTER_AUTH_SECRET: secret } = await f.runtime.getBindings<{
      BETTER_AUTH_SECRET: string;
    }>();
    const encrypted = await symmetricEncrypt({
      key: secret,
      data: "test-google-refresh",
    });
    const now = Date.now();
    await f.db
      .prepare(
        "INSERT INTO auth_accounts(id, account_id, provider_id, user_id, refresh_token, created_at, updated_at) VALUES('google-account', 'google-subject', 'google', ?, ?, ?, ?)",
      )
      .bind(a.player.id, encrypted, now, now)
      .run();
    f.revocations.status = 400;
    f.revocations.error = "invalid_request";
    assert.equal(
      (
        await f.auth(
          "/delete-user",
          { callbackURL: "http://localhost:8081/delete-account" },
          a.cookie,
          a.ip,
        )
      ).status,
      200,
    );
    const confirm = await f.auth(
      "/delete-user",
      { token: deletionLink(f.emails).searchParams.get("token") },
      a.cookie,
      a.ip,
    );
    assert.equal(confirm.status, 503);
    assert.equal(
      new URLSearchParams(f.revocations.calls[0].body).get("token"),
      "test-google-refresh",
    );
    assert.ok(await f.db.prepare("SELECT 1 FROM account_deletions").first());
    f.revocations.error = "invalid_token";
    await f.db
      .prepare(
        "UPDATE account_deletions SET retry_after = '2000-01-01T00:00:00.000Z'",
      )
      .run();
    const cron = await fetch(
      f.base + "/cdn-cgi/local/scheduled?cron=*/5%20*%20*%20*%20*&format=json",
    );
    assert.equal(cron.status, 200, await cron.text());
    assert.equal(
      await f.db.prepare("SELECT 1 FROM account_deletions").first(),
      null,
    );
    assert.equal(
      await f.db
        .prepare("SELECT 1 FROM auth_users WHERE id = ?")
        .bind(a.player.id)
        .first(),
      null,
    );
  } finally {
    await f.runtime.dispose();
  }
});
