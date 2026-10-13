import assert from "node:assert/strict";
import { test } from "node:test";
import { createAuthRuntime } from "./helpers/auth-runtime";

test("push retries rejected destinations without resending accepted tickets, and checks receipts", async () => {
  const f = await createAuthRuntime();
  try {
    const player = await f.register("通知テスト");
    const tokens = [
      "ExponentPushToken[aaaaaaaaaa]",
      "ExponentPushToken[bbbbbbbbbb]",
    ];
    for (const token of tokens)
      await player.api.registerPushDevice(token, "ios");
    const now = new Date().toISOString();
    await f.db
      .prepare(
        "INSERT INTO notification_outbox(id, account_id, kind, resource_id, created_at, next_attempt_at) VALUES('push-test', ?, 'testimony', 'piece', ?, ?)",
      )
      .bind(player.player.id, now, now)
      .run();
    const cron = async () => {
      const response = await fetch(
        f.base +
          "/cdn-cgi/local/scheduled?cron=*/5%20*%20*%20*%20*&format=json",
      );
      assert.equal(response.status, 200, await response.clone().text());
    };
    f.push.tickets = [];
    await cron();
    assert.equal(
      (
        await f.db
          .prepare(
            "SELECT attempts FROM notification_outbox WHERE id = 'push-test'",
          )
          .first()
      )?.attempts,
      1,
    );
    await f.db
      .prepare(
        "UPDATE notification_outbox SET next_attempt_at = ?, attempts = 0 WHERE id = 'push-test'",
      )
      .bind(now)
      .run();
    f.push.calls.length = 0;
    f.push.tickets = [
      { status: "ok", id: "ticket-a" },
      { status: "error", details: { error: "MessageRateExceeded" } },
    ];
    await cron();
    const first = await f.db
      .prepare(
        "SELECT delivered_at, attempts FROM notification_outbox WHERE id = 'push-test'",
      )
      .first();
    assert.equal(first?.delivered_at, null);
    assert.equal(first?.attempts, 1);
    await f.db
      .prepare(
        "UPDATE notification_outbox SET next_attempt_at = ? WHERE id = 'push-test'",
      )
      .bind(now)
      .run();
    f.push.tickets = [{ status: "ok", id: "ticket-b" }];
    await cron();
    assert.deepEqual(
      f.push.calls
        .filter((call) => call.path === "send")
        .map((call) =>
          (call.body as { to: string }[]).map((message) => message.to),
        ),
      [tokens, [tokens[1]]],
    );
    assert.ok(
      (
        await f.db
          .prepare(
            "SELECT delivered_at FROM notification_outbox WHERE id = 'push-test'",
          )
          .first()
      )?.delivered_at,
    );
    await f.db
      .prepare("UPDATE push_receipts SET created_at = ?")
      .bind(new Date(Date.now() - 20 * 60_000).toISOString())
      .run();
    await f.db
      .prepare("UPDATE push_devices SET updated_at = ?")
      .bind(new Date(Date.now() - 21 * 60_000).toISOString())
      .run();
    f.push.receipts = {
      "ticket-a": { status: "ok" },
      "ticket-b": {
        status: "error",
        details: { error: "DeviceNotRegistered" },
      },
    };
    await cron();
    assert.equal(
      await f.db
        .prepare("SELECT token FROM push_devices WHERE token = ?")
        .bind(tokens[1])
        .first(),
      null,
    );
    const states = await f.db
      .prepare("SELECT state FROM push_deliveries ORDER BY token")
      .all<{ state: string }>();
    assert.deepEqual(
      states.results.map((row: { state: string }) => row.state),
      ["delivered", "failed"],
    );
    assert.equal(
      (
        await f.db
          .prepare("SELECT COUNT(*) AS count FROM push_receipts")
          .first()
      )?.count,
      0,
    );
    await f.db
      .prepare(
        "INSERT INTO notification_outbox(id, account_id, kind, resource_id, created_at, next_attempt_at) VALUES('logout-test', ?, 'testimony', 'piece', ?, ?)",
      )
      .bind(player.player.id, now, now)
      .run();
    f.push.status = 503;
    await cron();
    const beforeLogout = f.push.calls.length;
    await player.api.unregisterPushDevice(tokens[0]);
    await f.db
      .prepare(
        "UPDATE notification_outbox SET next_attempt_at = ? WHERE id = 'logout-test'",
      )
      .bind(now)
      .run();
    f.push.status = 200;
    await cron();
    assert.equal(
      f.push.calls.length,
      beforeLogout,
      "Unregistered devices must never receive a queued retry",
    );
    assert.equal(
      (
        await f.db
          .prepare(
            "SELECT error_code FROM push_deliveries WHERE outbox_id = 'logout-test'",
          )
          .first()
      )?.error_code,
      "Unregistered",
    );
  } finally {
    await f.runtime.dispose();
  }
});
