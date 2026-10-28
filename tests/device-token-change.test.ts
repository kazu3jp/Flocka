import assert from "node:assert/strict";
import { test } from "node:test";
import { createDeviceTokenChangeFilter } from "../apps/mobile/src/features/notifications/device-token-change";

test("a token reported again after registering is not a change", () => {
  const filter = createDeviceTokenChangeFilter();
  filter.remember("device-a");
  assert.equal(filter.changed("device-a"), false);
  assert.equal(filter.changed("device-a"), false);
});

test("a rotated token is a change once", () => {
  const filter = createDeviceTokenChangeFilter();
  filter.remember("device-a");
  assert.equal(filter.changed("device-b"), true);
  assert.equal(filter.changed("device-b"), false);
});

test("the first report before any registration is a change", () => {
  const filter = createDeviceTokenChangeFilter();
  assert.equal(filter.changed("device-a"), true);
  assert.equal(filter.changed("device-a"), false);
});
