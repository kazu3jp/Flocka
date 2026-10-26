import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Builds a standalone release APK (JavaScript bundled, no Metro needed) that
// talks to the production API. Extra arguments go to Gradle, for example
// `npm run apk:android -- -PreactNativeArchitectures=arm64-v8a`.
const root = new URL("../", import.meta.url);
const mobile = fileURLToPath(new URL("apps/mobile/", root));
const readJson = (path) =>
  JSON.parse(readFileSync(new URL(path, root), "utf8"));
const isWindows = process.platform === "win32";

function productionApiUrl() {
  const url =
    process.env.EXPO_PUBLIC_API_URL ??
    readJson("apps/mobile/eas.json").build.base.env.EXPO_PUBLIC_API_URL;
  assert(url, "No EXPO_PUBLIC_API_URL in the environment or eas.json");
  const api = new URL(url);
  assert.equal(
    api.protocol,
    "https:",
    "A standalone APK requires an HTTPS API",
  );
  assert(
    !["localhost", "127.0.0.1", "[::1]", "10.0.2.2"].includes(api.hostname),
    "A standalone APK must not target a local test server",
  );
  return url;
}

// Windows needs a shell for npx and .bat files; one quoted command line keeps
// paths with spaces intact there.
function run(command, args, cwd, env) {
  const line = [command, ...args]
    .map((part) => (part.includes(" ") ? `"${part}"` : part))
    .join(" ");
  console.log(`\n> ${line}`);
  const result = isWindows
    ? spawnSync(line, { cwd, env, stdio: "inherit", shell: true })
    : spawnSync(command, args, { cwd, env, stdio: "inherit" });
  if (result.status !== 0)
    throw new Error(`${command} failed with exit code ${result.status}`);
}

const env = {
  ...process.env,
  CI: "1",
  NODE_ENV: "production",
  EXPO_PUBLIC_API_URL: productionApiUrl(),
};
console.log(`API: ${env.EXPO_PUBLIC_API_URL}`);

// android/ is generated (CNG). Prebuild may wipe and recreate an existing
// folder, so it only runs when the folder is missing; after changing native
// config, run `npx expo prebuild --platform android` yourself.
const android = new URL("apps/mobile/android/", root);
if (!existsSync(android))
  run(
    "npx",
    ["expo", "prebuild", "--platform", "android", "--no-install"],
    mobile,
    env,
  );
run(
  fileURLToPath(new URL(isWindows ? "gradlew.bat" : "gradlew", android)),
  [":app:assembleRelease", "--console=plain", ...process.argv.slice(2)],
  fileURLToPath(android),
  env,
);

const version = readJson("apps/mobile/app.json").expo.version;
const built = new URL(
  "apps/mobile/android/app/build/outputs/apk/release/app-release.apk",
  root,
);
mkdirSync(new URL("dist/", root), { recursive: true });
const output = new URL(`dist/flocka-${version}-release.apk`, root);
copyFileSync(built, output);
const sha256 = createHash("sha256").update(readFileSync(output)).digest("hex");
console.log(`\nAPK: ${fileURLToPath(output)}\nSHA-256: ${sha256}`);
