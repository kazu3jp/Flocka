import assert from "node:assert/strict";
import { test } from "node:test";
import {
  NEARBY_TIPS_AFTER_MS,
  isScanning,
  nearbyCopy,
  nearbyStatus,
  showsNearbyTips,
  type NearbyStatusInput,
} from "../apps/mobile/src/features/exchange/nearby-status";

const live: NearbyStatusInput = {
  supported: true,
  hasModule: true,
  starting: false,
  ready: true,
  error: false,
  peerCount: 0,
  focused: true,
};
const status = (changes: Partial<NearbyStatusInput>) =>
  nearbyStatus({ ...live, ...changes });

test("web and builds without the native module are unsupported", () => {
  assert.equal(status({ supported: false }), "unsupported");
  assert.equal(status({ hasModule: false }), "unsupported");
  assert.equal(
    status({ supported: false, ready: false, error: true }),
    "unsupported",
  );
});

test("scanning is only shown once it is really ready", () => {
  assert.equal(status({ ready: false, starting: true }), "preparing");
  assert.equal(status({ ready: true }), "searching");
  assert.equal(status({ ready: true, peerCount: 2 }), "found");
  // Peers that are still listed never turn a stopped scan into a live one.
  assert.equal(
    status({ ready: false, starting: false, peerCount: 2 }),
    "paused",
  );
});

test("a radio error blocks, and onReady after it recovers the search", () => {
  assert.equal(status({ error: true, ready: false }), "blocked");
  assert.equal(status({ error: true, ready: true, peerCount: 1 }), "blocked");
  assert.equal(status({ error: false, ready: true }), "searching");
});

test("a screen that is not focused or a stopped radio is paused", () => {
  assert.equal(status({ focused: false }), "paused");
  assert.equal(status({ focused: false, peerCount: 3 }), "paused");
  assert.equal(status({ ready: false, starting: false }), "paused");
  assert.equal(status({ focused: false, error: true }), "blocked");
});

test("only searching and found animate", () => {
  const scanning = (
    [
      "unsupported",
      "preparing",
      "searching",
      "found",
      "paused",
      "blocked",
    ] as const
  ).filter(isScanning);
  assert.deepEqual(scanning, ["searching", "found"]);
});

test("copy names the real state and the count", () => {
  assert.equal(nearbyCopy("searching", 0).label, "近くの人を探しています…");
  assert.equal(nearbyCopy("found", 2).label, "2人見つかりました");
  assert.equal(nearbyCopy("found", 2).spoken, "探索中、2人見つかりました");
  assert.match(nearbyCopy("paused", 0).label, /一時停止/);
  assert.equal(nearbyCopy("blocked", 0).hint, "");
});

test("tips appear only after a quiet stretch of live searching", () => {
  assert.equal(showsNearbyTips("searching", NEARBY_TIPS_AFTER_MS - 1), false);
  assert.equal(showsNearbyTips("searching", NEARBY_TIPS_AFTER_MS), true);
  assert.equal(showsNearbyTips("found", NEARBY_TIPS_AFTER_MS * 2), false);
  assert.equal(showsNearbyTips("blocked", NEARBY_TIPS_AFTER_MS * 2), false);
  assert.equal(showsNearbyTips("paused", NEARBY_TIPS_AFTER_MS * 2), false);
});
