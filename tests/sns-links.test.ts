import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createAccountSchema,
  normalizeSnsHandle,
  profileSchema,
  snsLinkDisplay,
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
  ["github", "https://github.com/kazu3jp", "kazu3jp"],
  ["github", "kazu3jp", "kazu3jp"],
  ["zenn", "https://zenn.dev/flocka", "flocka"],
  ["zenn", "@flocka", "flocka"],
  ["qiita", "https://qiita.com/flocka-app", "flocka-app"],
  ["note", "note.com/flocka_app/", "flocka_app"],
  ["bluesky", "@Flocka.bsky.social", "flocka.bsky.social"],
  ["bluesky", "flocka", "flocka.bsky.social"],
  ["bluesky", "https://bsky.app/profile/flocka.dev", "flocka.dev"],
  ["website", "flocka.dev", "https://flocka.dev/"],
  ["website", "https://www.flocka.dev/about", "https://www.flocka.dev/about"],
  ["website", "http://flocka.dev/", "http://flocka.dev/"],
];

test("handles, the service's own profile URLs and websites normalize to one value", () => {
  for (const [platform, input, value] of accepted)
    assert.equal(normalizeSnsHandle(platform, input), value, input);
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
    ["github", "-bad"],
    ["github", "bad-"],
    ["github", "a".repeat(40)],
    ["github", "https://github.com/orgs"],
    ["zenn", "https://zenn.dev/articles"],
    ["zenn", "https://zenn.dev/flocka/articles/abc"],
    ["qiita", "https://qiita.com/items"],
    ["note", "https://x.com/flocka_app"],
    ["bluesky", "https://bsky.app/search"],
    ["bluesky", "bad_name.bsky.social"],
    ["website", "javascript:alert(1)"],
    ["website", "data:text/html,hi"],
    ["website", "ftp://flocka.dev"],
    ["website", "https://user:pass@flocka.dev"],
    ["website", "https://flocka.dev:8443"],
    ["website", "http://localhost/"],
    ["website", "https://127.0.0.1/"],
    ["website", "https://github.com/kazu3jp"],
    ["website", `https://flocka.dev/${"a".repeat(300)}`],
    ["x", `https://x.com/${"a".repeat(300)}`],
  ];
  for (const [platform, input] of rejected)
    assert.equal(normalizeSnsHandle(platform, input), null, input);
});

test("opened URLs are rebuilt from a fixed https template, or the canonical website", () => {
  assert.equal(
    snsLinkUrl({ platform: "x", value: "flocka_app" }),
    "https://x.com/flocka_app",
  );
  assert.equal(
    snsLinkUrl({ platform: "bluesky", value: "flocka.bsky.social" }),
    "https://bsky.app/profile/flocka.bsky.social",
  );
  assert.equal(
    snsLinkUrl({ platform: "website", value: "https://flocka.dev/" }),
    "https://flocka.dev/",
  );
  // Stale or tampered cached values never produce a URL.
  assert.equal(snsLinkUrl({ platform: "x", value: "@flocka_app" }), null);
  assert.equal(snsLinkUrl({ platform: "x", value: "javascript:1" }), null);
  assert.equal(
    snsLinkUrl({ platform: "website", value: "javascript:alert(1)" }),
    null,
  );
  assert.equal(snsLinkUrl({ platform: "website", value: "flocka.dev" }), null);
  assert.equal(
    snsLinkUrl({ platform: "evil" as SnsPlatform, value: "flocka" }),
    null,
  );
  for (const platform of ["x", "zenn", "qiita", "note", "github"] as const)
    assert.match(
      snsLinkUrl({ platform, value: "abc" })!,
      /^https:\/\/(x\.com|zenn\.dev|qiita\.com|note\.com|github\.com)\/abc$/,
    );
});

test("a website shows without https:// and reads back to the same URL", () => {
  for (const value of [
    "https://flocka.dev/",
    "https://flocka.dev/about/",
    "https://flocka.dev/a?b=1#c",
    "http://flocka.dev/",
  ]) {
    const shown = snsLinkDisplay({ platform: "website", value });
    assert.equal(normalizeSnsHandle("website", shown), value, shown);
  }
  assert.equal(
    snsLinkDisplay({ platform: "website", value: "https://flocka.dev/" }),
    "flocka.dev",
  );
});

test("stored links must be canonical, unique per service and limited", () => {
  assert.equal(
    snsLinkSchema.safeParse({ platform: "x", value: "flocka_app" }).success,
    true,
  );
  for (const link of [
    { platform: "x", value: "https://x.com/flocka_app" },
    { platform: "x", value: "@flocka_app" },
    { platform: "x", value: "flocka_app", url: "https://evil.example" },
    { platform: "instagram", value: "flocka" },
    { platform: "website", value: "flocka.dev" },
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
      ["x", "github", "zenn", "qiita", "note", "x", "github", "zenn"].map(
        (platform) => ({ platform, value: "abcd" }),
      ),
    ).success,
    false,
  );
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
