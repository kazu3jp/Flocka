import assert from "node:assert/strict";
import { test } from "node:test";
import { createNearbyRadioSession } from "../apps/mobile/src/features/exchange/nearby-radio-session";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
const flush = () => new Promise<void>((resolve) => setImmediate(resolve));
const granted = { granted: true, canAskAgain: true };

function setup(
  overrides: {
    requestPermissions?: () => Promise<typeof granted>;
    start?: () => Promise<void>;
    stop?: () => Promise<void>;
  } = {},
  foreground = true,
) {
  const calls: string[] = [];
  const readiness: boolean[] = [];
  const errors: unknown[] = [];
  const session = createNearbyRadioSession(
    {
      requestPermissions: () => {
        calls.push("permissions");
        return overrides.requestPermissions?.() ?? Promise.resolve(granted);
      },
      start: () => {
        calls.push("start");
        return overrides.start?.() ?? Promise.resolve();
      },
      stop: () => {
        calls.push("stop");
        return overrides.stop?.() ?? Promise.resolve();
      },
      onStarting: (value) => calls.push(`starting:${value}`),
      onReady: (value) => readiness.push(value),
      onDenied: (value) => errors.push(value),
      onError: (error) => errors.push(error),
    },
    foreground,
  );
  return { session, calls, readiness, errors };
}

test("Android permission activity does not recursively request permission on return", async () => {
  const permission = deferred<typeof granted>();
  const s = setup({ requestPermissions: () => permission.promise });
  s.session.start();
  await flush();
  s.session.background();
  s.session.foreground();
  s.session.foreground();
  assert.equal(s.calls.filter((call) => call === "permissions").length, 1);
  assert.ok(!s.calls.includes("stop"));
  permission.resolve(granted);
  await flush();
  assert.equal(s.calls.filter((call) => call === "start").length, 1);
  assert.deepEqual(s.readiness, [false, true]);
  s.session.dispose();
  await flush();
});

test("a permission result received in the background waits for foreground", async () => {
  const permission = deferred<typeof granted>();
  const s = setup({ requestPermissions: () => permission.promise });
  s.session.start();
  await flush();
  s.session.background();
  permission.resolve(granted);
  await flush();
  assert.ok(!s.calls.includes("start"));
  s.session.foreground();
  await flush();
  assert.equal(s.calls.filter((call) => call === "start").length, 1);
  s.session.dispose();
  await flush();
});

test("a denied permission is not retried after the permission activity returns", async () => {
  const permission = deferred<typeof granted>();
  const s = setup({ requestPermissions: () => permission.promise });
  s.session.start();
  await flush();
  s.session.background();
  s.session.foreground();
  const denied = { granted: false, canAskAgain: false };
  permission.resolve(denied);
  await flush();
  assert.deepEqual(s.errors, [denied]);
  assert.ok(!s.calls.includes("start"));
  assert.equal(s.calls.filter((call) => call === "permissions").length, 1);
});

test("a cancelled start cannot report ready, and a restart waits for native stop", async () => {
  const start = deferred<void>();
  const stopped = deferred<void>();
  let attempt = 0;
  const s = setup({
    start: () => (++attempt === 1 ? start.promise : Promise.resolve()),
    stop: () => stopped.promise,
  });
  s.session.start();
  await flush();
  s.session.background();
  s.session.foreground();
  start.reject({ code: "CANCELLED" });
  await flush();
  assert.equal(attempt, 1);
  assert.ok(!s.readiness.includes(true));
  stopped.resolve();
  await flush();
  assert.equal(attempt, 2);
  assert.deepEqual(s.errors, []);
  assert.equal(s.readiness.at(-1), true);
  s.session.dispose();
  await flush();
});

test("a late native success or ready event in the background cannot mark scanning live", async () => {
  const started = deferred<void>();
  const s = setup({ start: () => started.promise });
  s.session.start();
  await flush();
  s.session.background();
  s.session.ready();
  started.resolve();
  await flush();
  assert.ok(!s.readiness.includes(true));
  s.session.dispose();
});

test("leaving during a permission request cannot start Bluetooth afterward", async () => {
  const permission = deferred<typeof granted>();
  const s = setup({ requestPermissions: () => permission.promise });
  s.session.start();
  await flush();
  s.session.dispose();
  permission.resolve(granted);
  await flush();
  assert.ok(!s.calls.includes("start"));
  assert.ok(!s.readiness.includes(true));
});

test("a screen restored in the background starts only when foregrounded", async () => {
  const s = setup({}, false);
  s.session.start();
  await flush();
  assert.deepEqual(s.calls, []);
  s.session.foreground();
  await flush();
  assert.equal(s.readiness.at(-1), true);
  s.session.dispose();
  await flush();
});

test("a native startup failure stays an error, not successful scanning or a retry loop", async () => {
  const error = { code: "BLUETOOTH_FAILED" };
  const s = setup({ start: () => Promise.reject(error) });
  s.session.start();
  await flush();
  assert.deepEqual(s.errors, [error]);
  assert.ok(!s.readiness.includes(true));
  assert.equal(s.calls.filter((call) => call === "start").length, 1);
  s.session.dispose();
  await flush();
});
