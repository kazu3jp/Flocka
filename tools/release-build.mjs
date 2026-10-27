import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, mkdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Shared by the standalone APK and IPA builds: both bundle the JavaScript and
// talk to the production API, so they read and check the same settings.
export const root = new URL("../", import.meta.url);
export const mobile = fileURLToPath(new URL("apps/mobile/", root));
export const readJson = (path) =>
  JSON.parse(readFileSync(new URL(path, root), "utf8"));
const isWindows = process.platform === "win32";

export function productionApiUrl() {
  const url =
    process.env.EXPO_PUBLIC_API_URL ??
    readJson("apps/mobile/eas.json").build.base.env.EXPO_PUBLIC_API_URL;
  assert(url, "No EXPO_PUBLIC_API_URL in the environment or eas.json");
  const api = new URL(url);
  assert.equal(
    api.protocol,
    "https:",
    "A standalone build requires an HTTPS API",
  );
  assert(
    !["localhost", "127.0.0.1", "[::1]", "10.0.2.2"].includes(api.hostname),
    "A standalone build must not target a local test server",
  );
  return url;
}

// Windows needs a shell for npx and .bat files; one quoted command line keeps
// paths with spaces intact there.
export function run(command, args, cwd, env) {
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

/** Copies a finished build to dist/ under a versioned name and prints its hash. */
export function publishToDist(built, suffix) {
  const version = readJson("apps/mobile/app.json").expo.version;
  mkdirSync(new URL("dist/", root), { recursive: true });
  const output = new URL(`dist/flocka-${version}-${suffix}`, root);
  copyFileSync(built, output);
  const sha256 = createHash("sha256")
    .update(readFileSync(output))
    .digest("hex");
  return { path: fileURLToPath(output), sha256 };
}
