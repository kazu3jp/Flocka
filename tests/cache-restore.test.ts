import assert from "node:assert/strict";
import { test } from "node:test";
import {
  fresh,
  initNav,
  navForRelaunch,
  restoreCachedNav,
  restoreCachedState,
  validNav,
} from "@flocka/domain";

test("a corrupt device cache starts fresh instead of blocking startup", () => {
  for (const raw of [
    "{broken",
    "null",
    "42",
    '"text"',
    '{"schemaVersion":2}',
    '{"schemaVersion":1,"profile":null}',
  ])
    assert.deepEqual(restoreCachedState(raw), fresh());
  assert.deepEqual(restoreCachedState(null), fresh());
  const saved = { ...fresh(), onboarded: true };
  assert.deepEqual(restoreCachedState(JSON.stringify(saved)), saved);
});

test("a corrupt navigation cache restarts at the tab roots", () => {
  for (const raw of [
    "{broken",
    "null",
    "[]",
    '{"tab":"toString","stacks":{}}',
    '{"tab":"find","stacks":null}',
    '{"tab":"find","stacks":{"find":[null],"exchange":[{"id":"exchange"}],"pr":[{"id":"pr"}]}}',
    '{"tab":"find","stacks":{"find":[{"id":"deck","params":null}],"exchange":[{"id":"exchange"}],"pr":[{"id":"pr"}]}}',
    '{"tab":"find","stacks":{"find":[{"id":"deck","params":{"key":1}}],"exchange":[{"id":"exchange"}],"pr":[{"id":"pr"}]}}',
  ])
    assert.deepEqual(restoreCachedNav(raw), initNav());
  assert.deepEqual(restoreCachedNav(null), initNav());
  const saved = initNav();
  saved.tab = "exchange";
  saved.stacks.exchange.push({ id: "confirm", params: { cid: "c1" } });
  assert.deepEqual(restoreCachedNav(JSON.stringify(saved)), saved);
});

test("a relaunch opens the deck and restarts exchange at the player card", () => {
  const saved = initNav();
  saved.tab = "exchange";
  saved.stacks.find.push({ id: "card", params: { key: "impl" } });
  saved.stacks.exchange.push({ id: "confirm", params: { cid: "c1" } });
  const restored = navForRelaunch(JSON.stringify(saved));
  assert.equal(restored.tab, "find");
  assert.deepEqual(restored.stacks.find, [{ id: "deck" }]);
  assert.deepEqual(restored.stacks.exchange, [{ id: "exchange" }]);
  assert.deepEqual(navForRelaunch(null), initNav());
  assert.deepEqual(navForRelaunch("{broken"), initNav());
});

test("navigation validation never throws on malformed entries", () => {
  assert.equal(validNav({ tab: "find", stacks: { find: [null] } }), false);
  assert.equal(validNav({ tab: 1, stacks: initNav().stacks }), false);
  assert.equal(validNav({ tab: "find", stacks: "deck" }), false);
});

test("a retired card drops only its own cached entries", () => {
  const saved = {
    ...fresh(),
    onboarded: true,
    self: ["impl", "retired"],
    showcase: ["retired", "impl"],
    resp: { impl: "agree", retired: "disagree" },
    deco: {
      retired: {
        pattern: "dots",
        frame: "none",
        stickers: [],
        color: "original",
      },
    },
    prDraft: "手で書いた下書き",
    prDraftSource: { card: "retired", pieceIds: ["a", "b"] },
  };
  const restored = restoreCachedState(JSON.stringify(saved));
  assert.equal(restored.onboarded, true);
  assert.deepEqual(restored.self, ["impl"]);
  assert.deepEqual(restored.showcase, ["impl"]);
  assert.deepEqual(restored.resp, { impl: "agree" });
  assert.deepEqual(restored.deco, {});
  assert.equal(restored.prDraft, "手で書いた下書き");
  assert.equal(restored.prDraftSource, null);
});
