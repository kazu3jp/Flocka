import assert from "node:assert/strict";
import { test } from "node:test";
import {
  readSnsEntry,
  withSnsLink,
  withoutSnsLink,
} from "../apps/mobile/src/features/profile/sns-entry";

test("a pasted profile URL is added as its service's handle", () => {
  assert.deepEqual(readSnsEntry("https://x.com/haru_dev"), {
    kind: "link",
    link: { platform: "x", value: "haru_dev" },
  });
  assert.deepEqual(readSnsEntry("  https://github.com/haru  "), {
    kind: "link",
    link: { platform: "github", value: "haru" },
  });
});

test("any other http(s) URL is the person's website", () => {
  assert.deepEqual(readSnsEntry("https://haru.example.com/works"), {
    kind: "link",
    link: { platform: "website", value: "https://haru.example.com/works" },
  });
});

test("a bare handle several services accept asks for the service", () => {
  const entry = readSnsEntry("haru");
  assert.equal(entry.kind, "choose");
  assert.ok(entry.kind === "choose" && entry.candidates.includes("x"));
  assert.ok(entry.kind === "choose" && entry.candidates.includes("github"));
  assert.deepEqual(readSnsEntry("haru", "github"), {
    kind: "link",
    link: { platform: "github", value: "haru" },
  });
});

test("a pick the text no longer fits is ignored", () => {
  // GitHub names allow no underscore, so the pick falls back to choosing.
  const entry = readSnsEntry("haru_dev", "github");
  assert.equal(entry.kind, "choose");
  assert.ok(entry.kind === "choose" && !entry.candidates.includes("github"));
});

test("empty text is nothing yet; unusable text says why", () => {
  assert.deepEqual(readSnsEntry("   "), { kind: "empty" });
  assert.equal(readSnsEntry("javascript:alert(1)").kind, "invalid");
  assert.equal(readSnsEntry("not a handle!").kind, "invalid");
});

test("adding replaces that service's link and keeps the services' order", () => {
  const links = withSnsLink(
    [
      { platform: "website", value: "https://example.com/" },
      { platform: "x", value: "old" },
    ],
    { platform: "x", value: "new" },
  );
  assert.deepEqual(links, [
    { platform: "x", value: "new" },
    { platform: "website", value: "https://example.com/" },
  ]);
  assert.deepEqual(withoutSnsLink(links, "x"), [
    { platform: "website", value: "https://example.com/" },
  ]);
});
