import assert from "node:assert/strict";
import { test } from "node:test";
import {
  RECEIVING_SWITCHES,
  canWithdrawRequest,
  describeVisibility,
  hasUnsavedSettings,
  requestStatusLabel,
} from "../apps/mobile/src/features/profile/settings-view-model";

const on = { allowVibe: true, allowProof: true, onlyConnected: true };

test("the summary follows the saved switches", () => {
  const lines = describeVisibility({
    settings: { ...on, allowProof: false },
    snsLinkCount: 0,
    blockedCount: 0,
  });
  const value = (key: string) => lines.find((l) => l.key === key)?.value;
  assert.equal(value("vibe"), "受け取る");
  assert.equal(value("proof"), "受け取らない");
  assert.equal(value("sender"), "交換が成立した人だけ");
  assert.match(value("profile")!, /SNS未登録/);
  assert.equal(value("blocked"), "いません");
});

test("the summary counts SNS links and blocked people, never says public", () => {
  const lines = describeVisibility({
    settings: on,
    snsLinkCount: 2,
    blockedCount: 3,
  });
  const text = lines.map((l) => l.value).join("\n");
  assert.match(text, /SNS 2件/);
  assert.match(text, /3人/);
  assert.match(text, /交換した人にだけ/);
});

test("turning off onlyConnected does not claim strangers can send", () => {
  const sender = describeVisibility({
    settings: { ...on, onlyConnected: false },
    snsLinkCount: 0,
    blockedCount: 0,
  }).find((l) => l.key === "sender")!;
  assert.match(sender.value, /交換が成立した人だけ/);
});

test("unsaved changes are any differing switch", () => {
  assert.equal(hasUnsavedSettings(on, { ...on }), false);
  assert.equal(hasUnsavedSettings(on, { ...on, onlyConnected: false }), true);
  assert.equal(RECEIVING_SWITCHES.length, 3);
});

test("request status labels and withdrawal", () => {
  const base = { pieceId: "p", at: "2026-01-01" };
  assert.equal(requestStatusLabel({ ...base, status: "pending" }), "受付済み");
  assert.equal(requestStatusLabel({ ...base, status: "removed" }), "削除済み");
  assert.equal(requestStatusLabel({ ...base, status: "rejected" }), "対応なし");
  assert.equal(requestStatusLabel({ ...base, status: "reviewed" }), "確認済み");
  assert.equal(
    requestStatusLabel({ ...base, status: "pending", withdrawn: true }),
    "取り下げ済み",
  );
  assert.equal(canWithdrawRequest({ ...base, status: "pending" }), true);
  assert.equal(
    canWithdrawRequest({ ...base, status: "pending", withdrawn: true }),
    false,
  );
  assert.equal(canWithdrawRequest({ ...base, status: "removed" }), false);
});
