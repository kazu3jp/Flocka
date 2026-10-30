import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
  existsSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";

const script = resolve(".github/release/prepare.mjs");
const workspaces = [
  "apps/mobile",
  "apps/api",
  "packages/domain",
  "packages/api-client",
];
const put = (root: string, path: string, value: string | object) => {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(
    join(root, path),
    typeof value === "string" ? value : JSON.stringify(value),
  );
};
const read = (root: string, path: string) =>
  JSON.parse(readFileSync(join(root, path), "utf8"));
function fixture() {
  const directory = mkdtempSync(join(tmpdir(), "flocka-release-test-"));
  const source = join(directory, "source"),
    target = join(directory, "target");
  for (const root of [source, target]) {
    mkdirSync(root);
    execFileSync("git", ["init", "--quiet", root]);
    put(root, "apps/mobile/app.json", { expo: { version: "1.0.0" } });
  }
  for (const workspace of ["", ...workspaces]) {
    const path = workspace ? `${workspace}/package.json` : "package.json";
    put(source, path, {
      name: workspace || "flocka",
      version: "1.0.0",
      scripts: {
        typecheck: "tsc --noEmit",
        lint: "eslint",
        "export:native": "export-native",
        "export:web": "export-web",
      },
      devDependencies: {
        typescript: "6.0.3",
        eslint: "9.39.5",
        "@types/react": "19",
      },
    });
    if (workspace) put(source, `${workspace}/tsconfig.json`, {});
  }
  put(source, "package-lock.json", {
    version: "1.0.0",
    packages: Object.fromEntries(
      ["", ...workspaces].map((workspace) => [workspace, { version: "1.0.0" }]),
    ),
  });
  for (const path of [
    ".nvmrc",
    "README.md",
    "apps/mobile/eas.json",
    "apps/mobile/google-services.json",
    "apps/api/wrangler.jsonc",
    "apps/api/worker-configuration.d.ts",
    "tools/build-apk.mjs",
    "tools/build-ipa.mjs",
    "tools/release-build.mjs",
    "apps/api/src/new.ts",
    "packages/domain/src/new.ts",
    "docs/private.md",
    "tests/dev-only.ts",
    "design/source.html",
  ])
    put(source, path, "fixture");
  put(source, "apps/mobile/.env.local", "untracked-local-setting");
  put(target, "apps/api/src/removed.ts", "old-runtime-file");
  put(target, ".gitignore", "release-only-ignore");
  execFileSync("git", ["-C", source, "add", ".", ":!apps/mobile/.env.local"]);
  const run = (version: string) =>
    spawnSync(process.execPath, [script, source, target, version], {
      encoding: "utf8",
    });
  return {
    source,
    target,
    run,
    dispose: () => rmSync(directory, { recursive: true, force: true }),
  };
}

test("manual release copies runtime files, propagates deletions and updates every version", () => {
  const f = fixture();
  try {
    const result = f.run("1.0.1");
    assert.equal(result.status, 0, result.stderr);
    assert.ok(existsSync(join(f.target, "apps/api/src/new.ts")));
    assert.ok(!existsSync(join(f.target, "apps/api/src/removed.ts")));
    for (const path of ["docs", "tests", "design", "apps/mobile/.env.local"])
      assert.ok(!existsSync(join(f.target, path)), path);
    for (const workspace of ["", ...workspaces]) {
      assert.equal(
        read(f.target, workspace ? `${workspace}/package.json` : "package.json")
          .version,
        "1.0.1",
      );
      assert.equal(
        read(f.target, "package-lock.json").packages[workspace].version,
        "1.0.1",
      );
    }
    assert.equal(read(f.target, "apps/mobile/app.json").expo.version, "1.0.1");
    assert.equal(read(f.target, "package-lock.json").version, "1.0.1");
    assert.deepEqual(read(f.target, "package.json").workspaces, workspaces);
    assert.equal(
      read(f.target, "package.json").devDependencies.eslint,
      undefined,
    );
    assert.equal(
      read(f.target, "apps/mobile/package.json").scripts.lint,
      undefined,
    );
    assert.equal(
      readFileSync(join(f.target, ".gitignore"), "utf8"),
      "release-only-ignore",
    );
    assert.ok(
      existsSync(join(f.target, ".github/workflows/prepare-release.yml")),
    );
    assert.equal(read(f.source, "package.json").version, "1.0.0");
  } finally {
    f.dispose();
  }
});

test("invalid or regressive release versions are refused before changing the candidate", () => {
  const f = fixture();
  try {
    for (const version of [
      "1.0.0",
      "0.9.9",
      "v1.0.1",
      "1.0.1-beta",
      "1.0.1;echo bad",
      "01.0.1",
    ]) {
      assert.notEqual(f.run(version).status, 0, version);
      assert.ok(existsSync(join(f.target, "apps/api/src/removed.ts")));
    }
    put(f.source, "apps/api/package.json", { version: "2.0.0" });
    assert.notEqual(f.run("1.0.1").status, 0);
    assert.ok(existsSync(join(f.target, "apps/api/src/removed.ts")));
  } finally {
    f.dispose();
  }
});

test("release preparation rejects symlinks before touching release files", () => {
  const f = fixture();
  try {
    symlinkSync("../package.json", join(f.source, "apps/api/src/link.ts"));
    execFileSync("git", ["-C", f.source, "add", "apps/api/src/link.ts"]);
    const result = f.run("1.0.1");
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /regular files/);
    assert.ok(existsSync(join(f.target, "apps/api/src/removed.ts")));
  } finally {
    f.dispose();
  }
});
