import assert from "node:assert/strict";
import { existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  mobile,
  productionApiUrl,
  publishToDist,
  root,
  run,
} from "./release-build.mjs";

// Builds a standalone Release IPA (JavaScript bundled, no Metro needed) that
// talks to the production API. It is left unsigned: AltStore, or another
// installer, signs it with the person's Apple ID when installing. Runs on a
// Mac with Xcode and CocoaPods. Extra arguments go to xcodebuild.
assert.equal(process.platform, "darwin", "An iOS build needs macOS with Xcode");

// iOS signs in with Google through the browser, so unlike the APK the Google
// client ID is not required here.
const env = {
  ...process.env,
  CI: "1",
  NODE_ENV: "production",
  EXPO_PUBLIC_API_URL: productionApiUrl(),
};
console.log(`API: ${env.EXPO_PUBLIC_API_URL}`);

// ios/ is generated (CNG). Prebuild may wipe and recreate an existing folder,
// so it only runs when the folder is missing; after changing native config,
// run `npx expo prebuild --platform ios` yourself.
const ios = new URL("apps/mobile/ios/", root);
if (!existsSync(ios))
  run("npx", ["expo", "prebuild", "--platform", "ios"], mobile, env);
else if (!existsSync(new URL("Pods/", ios)))
  run("pod", ["install"], fileURLToPath(ios), env);

const workspace = readdirSync(ios).find((name) =>
  name.endsWith(".xcworkspace"),
);
assert(workspace, "No .xcworkspace in apps/mobile/ios");
const scheme = workspace.replace(/\.xcworkspace$/, "");

// A fresh archive every time: EXPO_PUBLIC_* values are inlined when the
// JavaScript is bundled, so an old archive could carry stale values.
const build = new URL("build/", ios);
const archive = new URL(`${scheme}.xcarchive/`, build);
rmSync(archive, { recursive: true, force: true });
run(
  "xcodebuild",
  [
    "-workspace",
    workspace,
    "-scheme",
    scheme,
    "-configuration",
    "Release",
    "-destination",
    "generic/platform=iOS",
    "-archivePath",
    fileURLToPath(archive).replace(/\/$/, ""),
    "archive",
    "CODE_SIGNING_ALLOWED=NO",
    "CODE_SIGNING_REQUIRED=NO",
    "CODE_SIGN_IDENTITY=",
    ...process.argv.slice(2),
  ],
  fileURLToPath(ios),
  env,
);

// An IPA is a zip holding Payload/<App>.app.
const staging = new URL("ipa/", build);
rmSync(staging, { recursive: true, force: true });
mkdirSync(new URL("Payload/", staging), { recursive: true });
const apps = new URL("Products/Applications/", archive);
const app = readdirSync(apps).find((name) => name.endsWith(".app"));
assert(app, "The archive contains no .app");
run(
  "ditto",
  [
    fileURLToPath(new URL(app, apps)),
    fileURLToPath(new URL(`Payload/${app}`, staging)),
  ],
  fileURLToPath(build),
  env,
);
run("zip", ["-qry", `${scheme}.ipa`, "Payload"], fileURLToPath(staging), env);

const ipa = publishToDist(
  new URL(`${scheme}.ipa`, staging),
  "release-unsigned.ipa",
);
console.log(`\nIPA: ${ipa.path}\nSHA-256: ${ipa.sha256}`);
