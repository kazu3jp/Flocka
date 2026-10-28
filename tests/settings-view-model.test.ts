import assert from "node:assert/strict";
import { test } from "node:test";
import {
  RECEIVING_SWITCHES,
  canWithdrawRequest,
  requestStatusLabel,
} from "../apps/mobile/src/features/profile/settings-view-model";

test("three receiving switches, each with a one-line hint", () => {
  assert.equal(RECEIVING_SWITCHES.length, 3);
  for (const { hint } of RECEIVING_SWITCHES) assert.ok(hint.length > 0);
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
