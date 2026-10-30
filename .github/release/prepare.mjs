import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  copyFileSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const workspaces = [
  "apps/mobile",
  "apps/api",
  "packages/domain",
  "packages/api-client",
];
const directories = [
  "apps/mobile/src",
  "apps/mobile/assets",
  "apps/mobile/modules",
  "apps/mobile/plugins",
  "apps/api/src",
  "apps/api/migrations",
  "packages/domain/src",
  "packages/api-client/src",
  "assets/readme",
];
const files = [
  ".nvmrc",
  "README.md",
  "package.json",
  "package-lock.json",
  ...workspaces.flatMap((workspace) => [
    `${workspace}/package.json`,
    `${workspace}/tsconfig.json`,
  ]),
  "apps/mobile/app.json",
  "apps/mobile/eas.json",
  "apps/mobile/google-services.json",
  "apps/api/wrangler.jsonc",
  "apps/api/worker-configuration.d.ts",
  "tools/build-apk.mjs",
  "tools/build-ipa.mjs",
  "tools/release-build.mjs",
];
const automation = [
  ".github/workflows/prepare-release.yml",
  ".github/release/prepare.mjs",
  ".github/release/README.md",
];
const json = (root, path) =>
  JSON.parse(readFileSync(resolve(root, path), "utf8"));
const writeJson = (root, path, value) =>
  writeFileSync(resolve(root, path), JSON.stringify(value, null, 2) + "\n");
const versionParts = (value) => {
  assert(
    /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(value),
    "Use a stable version such as 1.0.1, without v",
  );
  return value.split(".").map(BigInt);
};
const compareVersions = (left, right) => {
  const a = versionParts(left),
    b = versionParts(right);
  for (let index = 0; index < 3; index++) {
    if (a[index] !== b[index]) return a[index] > b[index] ? 1 : -1;
  }
  return 0;
};

/** Build only the runtime tree. The caller installs its fresh lockfile and validates before pushing. */
export function prepareRelease(sourceDirectory, targetDirectory, version) {
  const source = realpathSync(sourceDirectory),
    target = realpathSync(targetDirectory);
  assert(
    source !== target &&
      !target.startsWith(source + "/") &&
      !source.startsWith(target + "/"),
    "Use separate source and release checkouts",
  );
  for (const checkout of [source, target]) {
    assert.equal(
      execFileSync("git", ["-C", checkout, "rev-parse", "--show-toplevel"], {
        encoding: "utf8",
      }).trim(),
      checkout,
      "Use a Git checkout root",
    );
  }
  versionParts(version);
  const current = json(target, "apps/mobile/app.json").expo.version;
  assert(
    compareVersions(version, current) > 0,
    "The version must be newer than release",
  );
  for (const workspace of ["", ...workspaces]) {
    const path = workspace ? `${workspace}/package.json` : "package.json";
    assert(
      compareVersions(version, json(source, path).version) >= 0,
      "The version must not downgrade dev packages",
    );
  }
  assert(
    compareVersions(
      version,
      json(source, "apps/mobile/app.json").expo.version,
    ) >= 0,
    "The version must not downgrade the dev app",
  );
  const tracked = execFileSync("git", ["-C", source, "ls-files", "-z"], {
    encoding: "utf8",
  })
    .split("\0")
    .filter(Boolean);
  const selected = tracked.filter(
    (path) =>
      files.includes(path) ||
      directories.some((directory) => path.startsWith(directory + "/")),
  );
  for (const path of files)
    assert(selected.includes(path), `Required release file missing: ${path}`);
  // Validate every source file before touching the separate release checkout.
  for (const path of selected)
    assert(
      lstatSync(resolve(source, path)).isFile(),
      `Release files must be regular files: ${path}`,
    );
  for (const path of [...directories, ...files])
    rmSync(resolve(target, path), { recursive: true, force: true });
  for (const path of selected) {
    mkdirSync(dirname(resolve(target, path)), { recursive: true });
    copyFileSync(resolve(source, path), resolve(target, path));
  }
  const rootPackage = json(target, "package.json");
  rootPackage.workspaces = workspaces;
  rootPackage.devDependencies = Object.fromEntries(
    Object.entries(rootPackage.devDependencies ?? {}).filter(([name]) =>
      ["@babel/core", "typescript", "@types/node"].includes(name),
    ),
  );
  const rootScripts = [
    "dev:api",
    "db:migrate",
    "ios",
    "android",
    "export:web",
    "export:native",
    "build:api",
    "apk:android",
    "ipa:ios",
  ];
  rootPackage.scripts = Object.fromEntries(
    Object.entries(rootPackage.scripts).filter(([name]) =>
      rootScripts.includes(name),
    ),
  );
  rootPackage.scripts.typecheck = "npm run typecheck --workspaces --if-present";
  rootPackage.scripts.validate =
    "npm run typecheck && npm run build:api && npm run export:native";
  writeJson(target, "package.json", rootPackage);
  const mobile = json(target, "apps/mobile/package.json");
  mobile.scripts = Object.fromEntries(
    Object.entries(mobile.scripts).filter(([name]) =>
      ["android", "ios", "export:web", "export:native", "typecheck"].includes(
        name,
      ),
    ),
  );
  mobile.devDependencies = Object.fromEntries(
    Object.entries(mobile.devDependencies ?? {}).filter(([name]) =>
      ["@types/node", "@types/react", "typescript"].includes(name),
    ),
  );
  writeJson(target, "apps/mobile/package.json", mobile);
  for (const workspace of ["", ...workspaces]) {
    const path = workspace ? `${workspace}/package.json` : "package.json";
    const manifest = json(target, path);
    manifest.version = version;
    writeJson(target, path, manifest);
  }
  const app = json(target, "apps/mobile/app.json");
  app.expo.version = version;
  writeJson(target, "apps/mobile/app.json", app);
  const lock = json(target, "package-lock.json");
  lock.version = version;
  for (const workspace of ["", ...workspaces]) {
    assert(
      lock.packages[workspace],
      `Missing lockfile workspace: ${workspace}`,
    );
    lock.packages[workspace].version = version;
  }
  writeJson(target, "package-lock.json", lock);
  // Keep the trusted release automation even though dev is the runtime source.
  const controller = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
  for (const path of automation) {
    if (resolve(controller, path) === resolve(target, path)) continue;
    mkdirSync(dirname(resolve(target, path)), { recursive: true });
    copyFileSync(resolve(controller, path), resolve(target, path));
  }
  console.log(
    `Prepared ${selected.length} runtime files for ${current} -> ${version}`,
  );
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  assert.equal(
    process.argv.length,
    5,
    "Usage: node prepare.mjs SOURCE_CHECKOUT RELEASE_CHECKOUT VERSION",
  );
  prepareRelease(...process.argv.slice(2));
}
