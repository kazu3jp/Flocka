import assert from "node:assert/strict";
import { createServer } from "node:http";
import { test } from "node:test";
import {
  ApiClientError,
  FlockaApiClient,
  sessionFailureKind,
} from "@flocka/api-client";
import { fresh, preferencesOf, type Preferences } from "@flocka/domain";
import {
  authErrorMessage,
  parseRetryAfter,
} from "../apps/mobile/src/features/auth/auth-error-message";
import {
  planCachedPreferences,
  readPreferenceSyncMark,
} from "../apps/mobile/src/features/sync/cached-preferences";
import {
  backupSnapshotOf,
  withRestoredPreferences,
} from "../apps/mobile/src/features/sync/backup-snapshot";
import { parsePendingTokens } from "../apps/mobile/src/features/notifications/pending-tokens";

const defaults = preferencesOf(fresh());
const edited: Preferences = { ...defaults, prDraft: "ローカルの下書き" };
const serverCopy: Preferences = { ...defaults, prDraft: "サーバーの下書き" };

test("auth rate limits are shown in Japanese with the server's wait", () => {
  assert.equal(parseRetryAfter("42"), 42);
  assert.equal(parseRetryAfter("1.2"), 2);
  for (const value of [null, "", "soon", "-3", "0"])
    assert.equal(parseRetryAfter(value), null);
  const limited = {
    status: 429,
    message: "Too many requests. Please try again later.",
  };
  assert.match(authErrorMessage(limited, 42), /42秒ほど待って/);
  assert.match(authErrorMessage(limited), /時間をおいて再試行/);
  assert.doesNotMatch(authErrorMessage(limited), /Too many/);
  assert.equal(
    authErrorMessage({ status: 401, code: "INVALID_EMAIL_OR_PASSWORD" }),
    "メールアドレスまたはパスワードを確認してください",
  );
});

test("only signed-out, switched or deleting accounts count as session failures", () => {
  assert.equal(
    sessionFailureKind(new ApiClientError(401, "UNAUTHORIZED", "")),
    "signed-out",
  );
  assert.equal(
    sessionFailureKind(new ApiClientError(401, "ACCOUNT_CHANGED", "")),
    "signed-out",
  );
  assert.equal(
    sessionFailureKind(new ApiClientError(403, "ACCOUNT_DELETION_PENDING", "")),
    "account-deleting",
  );
  for (const error of [
    new ApiClientError(403, "EMAIL_NOT_VERIFIED", ""),
    new ApiClientError(404, "PLAYER_NOT_FOUND", ""),
    new ApiClientError(0, "NETWORK_ERROR", ""),
    new Error("UNAUTHORIZED"),
  ])
    assert.equal(sessionFailureKind(error), null);
});

test("the API client reports a rejected session before throwing it", async () => {
  const server = createServer((request, response) => {
    const status = request.url === "/v1/me" ? 401 : 409;
    response.writeHead(status, { "Content-Type": "application/json" }).end(
      JSON.stringify({
        error: {
          code: status === 401 ? "UNAUTHORIZED" : "BACKUP_CONFLICT",
          message: "x",
        },
      }),
    );
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const reported: string[] = [];
  const api = new FlockaApiClient(
    `http://127.0.0.1:${address.port}`,
    { onSessionFailure: (error) => reported.push(error.code) },
    true,
  );
  try {
    await assert.rejects(api.getMe(), { code: "UNAUTHORIZED" });
    await assert.rejects(api.getBackup(), { code: "BACKUP_CONFLICT" });
    assert.deepEqual(reported, ["UNAUTHORIZED"]);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test("unsaved preferences are resent only on the revision they were based on", () => {
  const mark = { revision: 4, saved: serverCopy };
  assert.deepEqual(
    planCachedPreferences({
      cached: edited,
      onboarded: true,
      mark,
      server: { data: serverCopy, revision: 4 },
      defaults,
    }),
    { kind: "upload", data: edited, revision: 4, legacy: false },
  );
  // The server moved on while this device was signed out: compare, never overwrite.
  assert.deepEqual(
    planCachedPreferences({
      cached: edited,
      onboarded: true,
      mark,
      server: { data: { ...serverCopy, prDraft: "別の端末" }, revision: 5 },
      defaults,
    }),
    { kind: "conflict", local: edited },
  );
  // Saved edits that the server already replaced are not offered again.
  assert.deepEqual(
    planCachedPreferences({
      cached: serverCopy,
      onboarded: true,
      mark,
      server: { data: edited, revision: 5 },
      defaults,
    }),
    { kind: "none" },
  );
  assert.deepEqual(
    planCachedPreferences({
      cached: edited,
      onboarded: false,
      mark,
      server: { data: serverCopy, revision: 4 },
      defaults,
    }),
    { kind: "none" },
  );
});

test("a cache without a sync mark is only offered to an untouched server record", () => {
  assert.deepEqual(
    planCachedPreferences({
      cached: edited,
      onboarded: true,
      mark: null,
      server: { data: defaults, revision: 1 },
      defaults,
    }),
    { kind: "upload", data: edited, revision: 1, legacy: true },
  );
  assert.deepEqual(
    planCachedPreferences({
      cached: edited,
      onboarded: true,
      mark: null,
      server: { data: serverCopy, revision: 2 },
      defaults,
    }),
    { kind: "none" },
  );
  assert.equal(readPreferenceSyncMark("{broken"), null);
  assert.equal(readPreferenceSyncMark('{"revision":"1","saved":{}}'), null);
  assert.deepEqual(
    readPreferenceSyncMark(JSON.stringify({ revision: 2, saved: defaults })),
    { revision: 2, saved: defaults },
  );
});

test("backups leave the photo to the avatar store and restore the PR source", () => {
  const state = fresh();
  state.profile.avatar = {
    type: "photo",
    color: "#fff",
    motif: "rocket",
    photo: "data:image/png;base64," + "A".repeat(1_000),
  };
  const snapshot = backupSnapshotOf(state);
  assert.equal("photo" in snapshot.profile.avatar, false);
  assert.equal(snapshot.profile.avatar.type, "photo");
  assert.ok(state.profile.avatar.photo, "the live state keeps its photo");

  const saved = fresh();
  saved.prDraft = "復元する下書き";
  saved.prDraftSource = { card: "lead", pieceIds: ["p1"] };
  const current = fresh();
  current.prDraftSource = { card: "other", pieceIds: ["p9"] };
  const restored = withRestoredPreferences(current, saved);
  assert.equal(restored.prDraft, "復元する下書き");
  assert.deepEqual(restored.prDraftSource, saved.prDraftSource);
});

test("pending push unregisters read only distinct token strings", () => {
  assert.deepEqual(parsePendingTokens(null), []);
  assert.deepEqual(parsePendingTokens("{broken"), []);
  assert.deepEqual(parsePendingTokens('{"a":1}'), []);
  assert.deepEqual(parsePendingTokens('["t1", "", 3, "t1", "t2"]'), [
    "t1",
    "t2",
  ]);
});
