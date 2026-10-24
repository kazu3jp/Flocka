import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import {
  DEFAULT_MODELS,
  FIXTURES,
  parseArgs,
  requestFor,
} from "../tools/eval-pr-ai.mjs";

const run = (args: string[], env: Record<string, string>) =>
  spawnSync(
    process.execPath,
    ["--import", "tsx", "tools/eval-pr-ai.mjs", ...args],
    {
      encoding: "utf8",
      env: {
        ...process.env,
        CLOUDFLARE_ACCOUNT_ID: "",
        CLOUDFLARE_API_TOKEN: "",
        ...env,
      },
    },
  );

test("eval tool refuses to call the API without credentials", () => {
  const result = run([], {});
  assert.equal(result.status, 1);
  assert.match(result.stderr, /CLOUDFLARE_ACCOUNT_ID/);
  assert.match(result.stderr, /実行しません/);
});

test("eval tool dry run prints the server prompts and calls nothing", () => {
  const result = run(["--dry-run"], {});
  assert.equal(result.status, 0, result.stderr);
  for (const fixture of FIXTURES)
    assert.ok(result.stdout.includes(fixture.texts[0]));
  assert.match(result.stdout, /<testimonies>/);
  for (const model of DEFAULT_MODELS) assert.ok(result.stdout.includes(model));
});

test("eval tool arguments and requests", () => {
  assert.deepEqual(parseArgs(["--models", "@cf/a/b, @cf/c/d"]).models, [
    "@cf/a/b",
    "@cf/c/d",
  ]);
  assert.throws(() => parseArgs(["--nope"]));
  assert.equal(FIXTURES.length, 3);
  const request = requestFor(FIXTURES[0]);
  assert.equal(request.max_completion_tokens, 600);
  assert.equal(request.messages.length, 2);
});
