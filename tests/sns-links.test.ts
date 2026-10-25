import assert from "node:assert/strict";
import { test } from "node:test";
import {
  collectSnsLinks,
  createAccountSchema,
  normalizeSnsHandle,
  profileSchema,
  snsLinkSchema,
  snsLinkUrl,
  snsLinksSchema,
  type SnsPlatform,
} from "@flocka/domain";

const accepted: [SnsPlatform, string, string][] = [
  ["x", "@flocka_app", "flocka_app"],
  ["x", "https://twitter.com/flocka_app", "flocka_app"],
  ["x", "https://x.com/flocka_app/", "flocka_app"],
  ["x", "x.com/flocka_app", "flocka_app"],
  ["instagram", "https://www.instagram.com/flocka.app/", "flocka.app"],
  ["tiktok", "https://www.tiktok.com/@flocka", "flocka"],
  ["tiktok", "@flocka", "flocka"],
  ["youtube", "https://www.youtube.com/@flocka-app", "flocka-app"],
  ["github", "https://github.com/kazu3jp", "kazu3jp"],
  ["github", "kazu3jp", "kazu3jp"],
  ["line", "https://line.me/ti/p/~flocka01", "flocka01"],
  ["line", "https://line.me/R/ti/p/~flocka01", "flocka01"],
  ["line", "~flocka01", "flocka01"],
];

test("handles and the platform's own profile URLs normalize to one handle", () => {
  for (const [platform, input, handle] of accepted)
    assert.equal(normalizeSnsHandle(platform, input), handle, input);
});

test("dangerous schemes, other hosts and non-profile paths are rejected", () => {
  const rejected: [SnsPlatform, string][] = [
    ["x", "javascript:alert(1)"],
    ["x", "JaVaScRiPt:alert(1)"],
    ["x", "data:text/html,<script>alert(1)</script>"],
    ["x", "file:///etc/passwd"],
    ["x", "flocka://exchange?code=x"],
    ["x", "https://evil.example/flocka_app"],
    ["x", "https://x.com.evil.example/flocka_app"],
    ["x", "https://user:pass@x.com/flocka_app"],
    ["x", "https://x.com:8443/flocka_app"],
    ["x", "https://x.com/flocka_app/status/1"],
    ["x", "https://x.com/home"],
    ["x", "https://twitter.com/intent/tweet"],
    ["x", "@name with space"],
    ["x", "name\nnewline"],
    ["x", "a".repeat(16)],
    ["x", ""],
    ["x", "   "],
    ["instagram", "https://www.instagram.com/p/abc"],
    ["instagram", "https://x.com/flocka_app"],
    ["github", "-bad"],
    ["github", "bad-"],
    ["github", "a".repeat(40)],
    ["github", "https://github.com/orgs"],
    ["tiktok", "https://www.tiktok.com/flocka"],
    ["youtube", "https://www.youtube.com/watch?v=abc"],
    ["line", "https://line.me/ti/p/flocka01"],
    ["line", "abc"],
    ["x", `https://x.com/${"a".repeat(300)}`],
  ];
  for (const [platform, input] of rejected)
    assert.equal(normalizeSnsHandle(platform, input), null, input);
});

test("opened URLs are rebuilt from a fixed https template", () => {
  assert.equal(
    snsLinkUrl({ platform: "x", value: "flocka_app" }),
    "https://x.com/flocka_app",
  );
  assert.equal(
    snsLinkUrl({ platform: "tiktok", value: "flocka" }),
    "https://www.tiktok.com/@flocka",
  );
  assert.equal(
    snsLinkUrl({ platform: "line", value: "flocka01" }),
    "https://line.me/ti/p/~flocka01",
  );
  // Stale or tampered cached values never produce a URL.
  assert.equal(snsLinkUrl({ platform: "x", value: "@flocka_app" }), null);
  assert.equal(snsLinkUrl({ platform: "x", value: "javascript:1" }), null);
  assert.equal(
    snsLinkUrl({ platform: "evil" as SnsPlatform, value: "flocka" }),
    null,
  );
  for (const platform of ["x", "instagram", "github"] as const)
    assert.match(
      snsLinkUrl({ platform, value: "abc" })!,
      /^https:\/\/(x\.com|www\.instagram\.com|github\.com)\/abc$/,
    );
});

test("stored links must be canonical, unique per platform and limited", () => {
  assert.equal(
    snsLinkSchema.safeParse({ platform: "x", value: "flocka_app" }).success,
    true,
  );
  for (const link of [
    { platform: "x", value: "https://x.com/flocka_app" },
    { platform: "x", value: "@flocka_app" },
    { platform: "x", value: "flocka_app", url: "https://evil.example" },
    { platform: "mastodon", value: "flocka" },
  ])
    assert.equal(snsLinkSchema.safeParse(link).success, false);
  assert.equal(
    snsLinksSchema.safeParse([
      { platform: "x", value: "a" },
      { platform: "x", value: "b" },
    ]).success,
    false,
  );
  assert.equal(
    snsLinksSchema.safeParse(
      ["x", "instagram", "tiktok", "youtube", "github", "line", "x"].map(
        (platform) => ({ platform, value: "abcd" }),
      ),
    ).success,
    false,
  );
});

test("editor text becomes ordered links; invalid text is reported per platform", () => {
  const result = collectSnsLinks({
    github: "https://github.com/kazu3jp",
    x: "  @flocka_app ",
    instagram: "javascript:alert(1)",
    tiktok: "   ",
  });
  assert.deepEqual(result.links, [
    { platform: "x", value: "flocka_app" },
    { platform: "github", value: "kazu3jp" },
  ]);
  assert.deepEqual(Object.keys(result.errors), ["instagram"]);
});

test("profiles without SNS links stay valid, and updates may omit the field", () => {
  const base = {
    name: "ハルカ",
    role: "",
    interests: [],
    avatar: { type: "initial", color: "#fff", motif: "rocket" },
    links: { github: "" },
  };
  assert.deepEqual(profileSchema.parse(base).snsLinks, []);
  const update = createAccountSchema.parse({
    profile: base,
    self: ["impl", "focus"],
  });
  assert.equal(update.profile.snsLinks, undefined);
});
