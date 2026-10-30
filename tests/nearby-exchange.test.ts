import assert from "node:assert/strict";
import { test } from "node:test";
import { fresh, type RemoteExchange } from "@flocka/domain";
import { createNearbyExchange } from "../apps/mobile/src/features/exchange/nearby-exchange";

const id = "00112233-4455-4677-8899-aabbccddeeff";
const signal = { code: "peer-code", exchangeId: id };
const exchange: RemoteExchange = {
  id,
  status: "pending",
  myApproved: false,
  peerApproved: false,
  peer: {
    id: "peer",
    profile: fresh().profile,
    self: [],
    avatarAvailable: false,
  },
  context: { place: "", trigger: "" },
  createdAt: "2026-10-31T00:00:00Z",
};
const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((yes) => {
    resolve = yes;
  });
  return { promise, resolve };
};
function setup(
  overrides: Partial<Parameters<typeof createNearbyExchange>[0]> = {},
) {
  const calls: string[] = [];
  const coordinator = createNearbyExchange({
    create: async () => {
      calls.push("save");
      return exchange;
    },
    notify: async (code, actualId) => {
      assert.equal(code, signal.code);
      assert.equal(actualId, id);
      calls.push("ble");
    },
    peerId: async () => {
      calls.push("peer");
      return "peer";
    },
    get: async (actualId) => {
      assert.equal(actualId, id);
      calls.push("get");
      return exchange;
    },
    refresh: async () => {
      calls.push("refresh");
    },
    open: (actualId) => {
      assert.equal(actualId, id);
      calls.push("open");
    },
    ...overrides,
  });
  return { calls, coordinator };
}

test("nearby start saves first, waits for BLE delivery, then syncs and opens", async () => {
  const gate = deferred();
  const s = setup({
    notify: async () => {
      s.calls.push("ble");
      await gate.promise;
    },
  });
  const pending = s.coordinator.start(signal.code);
  await new Promise<void>((yes) => setImmediate(yes));
  assert.deepEqual(s.calls, ["save", "ble"]);
  gate.resolve();
  await pending;
  assert.deepEqual(s.calls, ["save", "ble", "refresh", "open"]);
});

test("a failed server write never sends a BLE success signal", async () => {
  const s = setup({
    create: async () => {
      throw new Error("server failed");
    },
  });
  await assert.rejects(s.coordinator.start(signal.code), /server failed/);
  assert.deepEqual(s.calls, []);
});

test("a failed notification leaves a retryable saved exchange and does not navigate", async () => {
  let fail = true;
  const s = setup({
    notify: async () => {
      if (fail) throw new Error("disconnected");
      s.calls.push("ble");
    },
  });
  await assert.rejects(s.coordinator.start(signal.code), /保存されましたが/);
  assert.deepEqual(s.calls, ["save"]);
  fail = false;
  await s.coordinator.start(signal.code);
  assert.deepEqual(s.calls, ["save", "save", "ble", "refresh", "open"]);
});

test("a BLE signal verifies server membership and refreshes before opening, only once", async () => {
  const s = setup();
  await Promise.all([
    s.coordinator.receive(signal),
    s.coordinator.receive(signal),
  ]);
  assert.deepEqual(s.calls, ["peer", "get", "refresh", "open"]);
});

test("a forged or cancelled exchange signal cannot open a screen", async () => {
  for (const response of [
    { ...exchange, peer: { ...exchange.peer, id: "another" } },
    { ...exchange, id: "another-id" },
    { ...exchange, status: "cancelled" as const },
  ]) {
    const s = setup({ get: async () => response });
    await assert.rejects(s.coordinator.receive(signal), /確認できません/);
    assert.deepEqual(s.calls, ["peer"]);
  }
});

test("failed verification or sync stays retryable without treating BLE as proof of success", async () => {
  for (const step of ["get", "refresh"] as const) {
    let fail = true;
    const s = setup({
      [step]: async () => {
        if (fail) throw new Error("offline");
        if (step === "get") return exchange;
      },
    } as Partial<Parameters<typeof createNearbyExchange>[0]>);
    await assert.rejects(s.coordinator.receive(signal), /offline/);
    assert.ok(!s.calls.includes("open"));
    fail = false;
    await s.coordinator.receive(signal);
    assert.equal(s.calls.filter((call) => call === "open").length, 1);
  }
});

test("leaving during an async read or write prevents late notifications and navigation", async () => {
  const gate = deferred();
  const s = setup({
    create: async () => {
      await gate.promise;
      return exchange;
    },
  });
  const pending = s.coordinator.start(signal.code);
  await new Promise<void>((yes) => setImmediate(yes));
  s.coordinator.dispose();
  gate.resolve();
  await pending;
  assert.deepEqual(s.calls, []);
  const readGate = deferred();
  const receiver = setup({
    get: async () => {
      await readGate.promise;
      return exchange;
    },
  });
  const reading = receiver.coordinator.receive(signal);
  await new Promise<void>((yes) => setImmediate(yes));
  receiver.coordinator.dispose();
  readGate.resolve();
  await reading;
  assert.deepEqual(receiver.calls, ["peer"]);
});

test("simultaneous starts and incoming signals serialize without double navigation", async () => {
  const s = setup();
  await Promise.all([
    s.coordinator.start(signal.code),
    s.coordinator.receive(signal),
  ]);
  assert.deepEqual(s.calls, ["save", "ble", "refresh", "open"]);
});
