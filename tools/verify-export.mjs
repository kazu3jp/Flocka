import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const outputDirectory = fileURLToPath(
  new URL("../apps/mobile/dist/", import.meta.url),
);
const expectedURL = process.env.EXPO_PUBLIC_API_URL;
assert(
  expectedURL,
  "Set EXPO_PUBLIC_API_URL before verifying a production export",
);
const api = new URL(expectedURL);
assert.equal(api.protocol, "https:", "Production exports require an HTTPS API");
assert(
  !["localhost", "127.0.0.1", "[::1]"].includes(api.hostname),
  "Production exports must not target a local test server",
);

function verifyBundle(platform, relativePath) {
  assert.equal(
    typeof relativePath,
    "string",
    `${platform}: current bundle path is missing`,
  );
  const root = resolve(outputDirectory);
  const path = resolve(root, relativePath.replace(/^\//, ""));
  assert(
    path.startsWith(root + sep),
    `${platform}: bundle path is outside the export`,
  );
  const bytes = readFileSync(path);
  assert(
    bytes.includes(Buffer.from(expectedURL)),
    `${platform}: configured API URL is missing from the current bundle`,
  );
  assert(
    !bytes.includes(Buffer.from("https://127.0.0.1:9012")),
    `${platform}: VRT API URL leaked into the production bundle`,
  );
  console.log(
    `${platform}: current bundle targets the configured production API`,
  );
}

const platform = process.argv[2];
if (platform === "web") {
  const html = readFileSync(resolve(outputDirectory, "index.html"), "utf8");
  const entry = html.match(
    /src="(\/_expo\/static\/js\/web\/entry-[^"\s]+\.js)"/,
  )?.[1];
  verifyBundle("web", entry);
} else if (platform === "native") {
  const metadata = JSON.parse(
    readFileSync(resolve(outputDirectory, "metadata.json"), "utf8"),
  );
  for (const nativePlatform of ["android", "ios"])
    verifyBundle(
      nativePlatform,
      metadata.fileMetadata?.[nativePlatform]?.bundle,
    );
} else {
  throw new Error("Usage: npm run verify:export -- web|native");
}
