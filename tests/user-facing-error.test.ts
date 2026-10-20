import assert from "node:assert/strict";
import { test } from "node:test";
import { ApiClientError } from "@flocka/api-client";
import {
  OFFLINE_MESSAGE,
  UserFacingError,
  userFacingError,
} from "../apps/mobile/src/features/sync/user-facing-error";

test("only copy written for the user reaches the screen", () => {
  assert.equal(
    userFacingError(
      new ApiClientError(404, "INVITE_EXPIRED", "交換コードが期限切れです"),
      "fallback",
    ),
    "交換コードが期限切れです",
  );
  assert.equal(
    userFacingError(new UserFacingError("写真がありません"), "fallback"),
    "写真がありません",
  );
  assert.equal(
    userFacingError(new TypeError("Network request failed"), "fallback"),
    OFFLINE_MESSAGE,
  );
  assert.equal(
    userFacingError(
      new Error("SQLITE_FULL: database or disk is full"),
      "保存失敗",
    ),
    "保存失敗",
  );
  assert.equal(userFacingError("raw", "保存失敗"), "保存失敗");
});
