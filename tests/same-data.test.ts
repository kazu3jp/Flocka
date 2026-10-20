import assert from "node:assert/strict";
import { test } from "node:test";
import {
  keepIfSame,
  sameData,
} from "../apps/mobile/src/features/sync/same-data";

test("an unchanged sync keeps the rendered state reference", () => {
  const previous = {
    profile: { name: "あおい", avatar: { type: "motif", motif: "rocket" } },
    connections: [{ peerId: "p1", status: "accepted", vibe: undefined }],
  };
  const next = JSON.parse(JSON.stringify(previous));
  assert.equal(keepIfSame(previous, next), previous);
});

test("any changed, added or removed value replaces the state", () => {
  const base = { list: [1, 2], nested: { text: "a" } };
  assert.equal(
    sameData(base, { list: [1, 2, 3], nested: { text: "a" } }),
    false,
  );
  assert.equal(sameData(base, { list: [1, 2], nested: { text: "b" } }), false);
  assert.equal(
    sameData(base, { list: [1, 2], nested: { text: "a" }, more: 0 }),
    false,
  );
  assert.equal(sameData({ list: [] }, { list: {} }), false);
  assert.equal(sameData({ value: null }, { value: 0 }), false);
  const next = { list: [1, 2], nested: { text: "b" } };
  assert.equal(keepIfSame(base, next), next);
});
