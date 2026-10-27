import assert from "node:assert/strict";
import { existsSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  mobile,
  productionApiUrl,
  publishToDist,
  readJson,
  root,
  run,
} from "./release-build.mjs";

// Builds a standalone release APK (JavaScript bundled, no Metro needed) that
// talks to the production API. Extra arguments go to Gradle, for example
// `npm run apk:android -- -PreactNativeArchitectures=arm64-v8a`.
const isWindows = process.platform === "win32";

// Android signs in with the native Google sheet only when the Web application
// client ID is embedded at build time; without it the button cannot work as
// intended, so the APK is not built.
function googleWebClientId() {
  const id =
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ??
    readJson("apps/mobile/eas.json").build.base.env
      .EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  assert(
    id,
    "No EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID in the environment or eas.json (see docs/authentication.md)",
  );
  assert.match(
    id.trim(),
    /^\d+-[a-z0-9]+\.apps\.googleusercontent\.com$/,
    "EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID must be a Google OAuth client ID",
  );
  return id.trim();
}

const env = {
  ...process.env,
  CI: "1",
  NODE_ENV: "production",
  EXPO_PUBLIC_API_URL: productionApiUrl(),
  EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID: googleWebClientId(),
};
console.log(`API: ${env.EXPO_PUBLIC_API_URL}`);
console.log(`Google client: ${env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID}`);

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
// EXPO_PUBLIC_* values are inlined when the JavaScript is bundled, but Gradle
// only tracks files: drop the old bundle so a changed value is never skipped.
rmSync(new URL("app/build/generated/assets/react/release/", android), {
  recursive: true,
  force: true,
});
run(
  fileURLToPath(new URL(isWindows ? "gradlew.bat" : "gradlew", android)),
  [":app:assembleRelease", "--console=plain", ...process.argv.slice(2)],
  fileURLToPath(android),
  env,
);

const apk = publishToDist(
  new URL("app/build/outputs/apk/release/app-release.apk", android),
  "release.apk",
);
console.log(`\nAPK: ${apk.path}\nSHA-256: ${apk.sha256}`);
