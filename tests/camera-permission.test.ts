import assert from "node:assert/strict";
import { test } from "node:test";
import {
  CAMERA_PERMISSION_COPY,
  cameraPermissionView,
  shouldAutoRequestCamera,
  type CameraPermissionInput,
} from "../apps/mobile/src/features/exchange/camera-permission";

const base: CameraPermissionInput = {
  status: "undetermined",
  canAskAgain: true,
  requestFailed: false,
  requesting: false,
};
const view = (c: Partial<CameraPermissionInput>) =>
  cameraPermissionView({ ...base, ...c });

test("unread permission is checking, never granted", () => {
  assert.equal(view({ status: null }), "checking");
});
test("undetermined asks, granted shows the camera", () => {
  assert.equal(view({}), "request");
  assert.equal(view({ status: "granted" }), "granted");
});
test("an answer in flight is checking", () => {
  assert.equal(view({ requesting: true }), "checking");
});
test("denied can retry only while the system will still ask", () => {
  assert.equal(view({ status: "denied", canAskAgain: true }), "retry");
  assert.equal(view({ status: "denied", canAskAgain: false }), "settings");
});
test("a failed request is an error, not granted and not silent", () => {
  assert.equal(view({ requestFailed: true }), "error");
  assert.equal(
    view({ status: "denied", canAskAgain: false, requestFailed: true }),
    "error",
  );
});
test("only the first undetermined look asks automatically", () => {
  assert.equal(shouldAutoRequestCamera("request", false), true);
  assert.equal(shouldAutoRequestCamera("request", true), false);
  for (const v of [
    "checking",
    "retry",
    "settings",
    "error",
    "granted",
  ] as const)
    assert.equal(shouldAutoRequestCamera(v, false), false);
});
test("every non-camera view has Japanese copy and settings has a button", () => {
  assert.ok(CAMERA_PERMISSION_COPY.settings.button);
  assert.equal(CAMERA_PERMISSION_COPY.checking.button, null);
});
