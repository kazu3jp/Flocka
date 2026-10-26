import assert from "node:assert/strict";
import { test } from "node:test";
import { snsPlatformOfProfileUrl } from "@flocka/domain";
import {
  readSnsInputs,
  snsInputsFromLinks,
} from "../apps/mobile/src/features/profile/sns-link-inputs";

test("a pasted profile URL names its service; handles and other URLs name none", () => {
  assert.equal(snsPlatformOfProfileUrl("https://x.com/flocka_app"), "x");
  assert.equal(snsPlatformOfProfileUrl("zenn.dev/flocka/"), "zenn");
  assert.equal(
    snsPlatformOfProfileUrl("https://bsky.app/profile/flocka.bsky.social"),
    "bluesky",
  );
  assert.equal(snsPlatformOfProfileUrl("@flocka_app"), null);
  assert.equal(snsPlatformOfProfileUrl("https://example.com/flocka"), null);
  assert.equal(snsPlatformOfProfileUrl("javascript:alert(1)"), null);
});

test("every filled field becomes a link, in the services' order", () => {
  const inputs = snsInputsFromLinks([]);
  inputs.website = "flocka.dev";
  inputs.github = "kazu3jp";
  inputs.x = " https://x.com/flocka_app ";
  inputs.qiita = "@flocka";
  assert.deepEqual(readSnsInputs(inputs), {
    links: [
      { platform: "x", value: "flocka_app" },
      { platform: "github", value: "kazu3jp" },
      { platform: "qiita", value: "flocka" },
      { platform: "website", value: "https://flocka.dev/" },
    ],
    errors: {},
  });
});

test("saved links fill their fields and read back unchanged", () => {
  const links = [
    { platform: "x", value: "flocka_app" },
    { platform: "bluesky", value: "flocka.bsky.social" },
    { platform: "website", value: "https://flocka.dev/about" },
  ] as const;
  const inputs = snsInputsFromLinks([...links]);
  assert.equal(inputs.x, "@flocka_app");
  assert.equal(inputs.bluesky, "@flocka.bsky.social");
  assert.equal(inputs.website, "flocka.dev/about");
  assert.equal(inputs.zenn, "");
  assert.deepEqual(readSnsInputs(inputs).links, links);
});

test("an invalid field is reported, not dropped, and a URL in the wrong field names the right one", () => {
  const inputs = snsInputsFromLinks([]);
  inputs.zenn = "javascript:alert(1)";
  inputs.note = "https://x.com/flocka_app";
  inputs.website = "https://github.com/kazu3jp";
  const { links, errors } = readSnsInputs(inputs);
  assert.deepEqual(links, []);
  assert.equal(errors.zenn, "Zennのユーザー名またはURLを確認してください");
  assert.equal(errors.note, "XのURLです。Xの欄に入力してください");
  assert.equal(errors.website, "GitHubのURLです。GitHubの欄に入力してください");
});

test("a website that is not an http(s) address is reported", () => {
  const inputs = snsInputsFromLinks([]);
  inputs.website = "ftp://flocka.dev";
  assert.equal(
    readSnsInputs(inputs).errors.website,
    "WebサイトのURL（https://〜）を確認してください",
  );
});
