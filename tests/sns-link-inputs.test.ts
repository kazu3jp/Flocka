import assert from "node:assert/strict";
import { test } from "node:test";
import { snsPlatformOfProfileUrl } from "@flocka/domain";
import {
  readSnsInputs,
  snsInputsFromLinks,
} from "../apps/mobile/src/features/profile/sns-link-inputs";

test("a pasted profile URL names its service; handles and other URLs name none", () => {
  assert.equal(snsPlatformOfProfileUrl("https://x.com/flocka_app"), "x");
  assert.equal(
    snsPlatformOfProfileUrl("www.instagram.com/flocka.app/"),
    "instagram",
  );
  assert.equal(snsPlatformOfProfileUrl("@flocka_app"), null);
  assert.equal(snsPlatformOfProfileUrl("https://example.com/flocka"), null);
  assert.equal(snsPlatformOfProfileUrl("javascript:alert(1)"), null);
});

test("every filled SNS field becomes a link, in the services' order", () => {
  const inputs = snsInputsFromLinks([]);
  inputs.github = "kazu3jp";
  inputs.x = " https://x.com/flocka_app ";
  inputs.instagram = "@flocka.app";
  assert.deepEqual(readSnsInputs(inputs), {
    links: [
      { platform: "x", value: "flocka_app" },
      { platform: "instagram", value: "flocka.app" },
      { platform: "github", value: "kazu3jp" },
    ],
    errors: {},
  });
});

test("saved links fill their fields and read back unchanged", () => {
  const links = [
    { platform: "x", value: "flocka_app" },
    { platform: "line", value: "flocka01" },
  ] as const;
  const inputs = snsInputsFromLinks([...links]);
  assert.equal(inputs.x, "@flocka_app");
  assert.equal(inputs.line, "flocka01");
  assert.equal(inputs.instagram, "");
  assert.deepEqual(readSnsInputs(inputs).links, links);
});

test("an invalid field is reported, not dropped, and a URL in the wrong field names the right one", () => {
  const inputs = snsInputsFromLinks([]);
  inputs.instagram = "javascript:alert(1)";
  inputs.tiktok = "https://x.com/flocka_app";
  const { links, errors } = readSnsInputs(inputs);
  assert.deepEqual(links, []);
  assert.equal(
    errors.instagram,
    "Instagramのユーザー名またはURLを確認してください",
  );
  assert.equal(errors.tiktok, "XのURLです。Xの欄に入力してください");
});
