import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { transformSync } from "@babel/core";

const root = new URL("../../", import.meta.url);
const output = new URL(".generated/", import.meta.url);
await mkdir(output, { recursive: true });
const certificate = spawnSync(
  "openssl",
  [
    "req",
    "-x509",
    "-newkey",
    "rsa:2048",
    "-sha256",
    "-days",
    "1",
    "-nodes",
    "-subj",
    "/CN=127.0.0.1",
    "-addext",
    "subjectAltName=IP:127.0.0.1",
    "-keyout",
    fileURLToPath(new URL("tls.key", output)),
    "-out",
    fileURLToPath(new URL("tls.crt", output)),
  ],
  { encoding: "utf8" },
);
if (certificate.error || certificate.status !== 0) {
  const reason =
    certificate.error?.message ??
    (certificate.stderr.trim() || `exit status ${certificate.status}`);
  throw new Error(
    `Could not create the loopback-only VRT certificate with openssl: ${reason}`,
  );
}
// The reference executes the exact React 18 distributions used by the source.
for (const [name, hash] of [
  [
    "react-18.3.1.js",
    "28348fef6cb0ed8b2ceeb22deaf824428fd13875d84c73d38f77dd216fc24e7f",
  ],
  [
    "react-dom-18.3.1.js",
    "f9044a5e9c39db8bb1a204dff924e526ec0a621e695bb69de1035811be8709e4",
  ],
]) {
  const bytes = await readFile(new URL(`vendor/${name}`, import.meta.url));
  if (createHash("sha256").update(bytes).digest("hex") !== hash)
    throw new Error(`Reference runtime changed: ${name}`);
}
let reference = await readFile(
  new URL("design/flocka-v2-blue-prototype.html", root),
  "utf8",
);
const jsx = reference.match(
  /<script type="text\/babel">([\s\S]*?)<\/script>/,
)?.[1];
if (!jsx) throw new Error("Reference JSX is missing");
const compiled = transformSync(jsx, {
  configFile: false,
  babelrc: false,
  plugins: ["@babel/plugin-transform-react-jsx"],
})?.code;
if (!compiled) throw new Error("Could not compile the reference JSX");
reference = reference.replace(/<link[^>]+https:\/\/fonts\.[^>]+>/g, "");
reference = reference
  .replace(
    "https://unpkg.com/react@18.3.1/umd/react.development.js",
    "/reference/vendor/react-18.3.1.js",
  )
  .replace(
    "https://unpkg.com/react-dom@18.3.1/umd/react-dom.development.js",
    "/reference/vendor/react-dom-18.3.1.js",
  )
  .replace(/<script src="https:\/\/unpkg.com\/@babel[^<]+<\/script>/, "")
  .replace(
    /<script type="text\/babel">[\s\S]*?<\/script>/,
    () => `<script>${compiled}</script>`,
  )
  .replace(
    "</head>",
    `<style>
    @font-face {font-family:'Dela Gothic One';src:url('/reference/fonts/display.ttf');font-weight:400}
    @font-face {font-family:'Zen Kaku Gothic New';src:url('/reference/fonts/body.ttf');font-weight:500}
    @font-face {font-family:'Zen Kaku Gothic New';src:url('/reference/fonts/bold.ttf');font-weight:700}
  </style></head>`,
  );
await writeFile(new URL("reference.html", output), reference);
// On Windows npm is npm.cmd, which Node does not spawn without a shell.
// When started through npm, run the same npm CLI with the current Node binary;
// otherwise let cmd.exe resolve npm.cmd (the arguments are fixed literals).
const npmArguments = [
  "run",
  "export:web",
  "-w",
  "@flocka/mobile",
  "--",
  "--output-dir",
  "dist-vrt",
];
const npmCli = process.env.npm_execpath;
const [npmCommand, npmCommandArguments] = npmCli
  ? [process.execPath, [npmCli, ...npmArguments]]
  : ["npm", npmArguments];
const result = spawnSync(npmCommand, npmCommandArguments, {
  cwd: root,
  shell: !npmCli && process.platform === "win32",
  stdio: "inherit",
  env: {
    ...process.env,
    EXPO_PUBLIC_API_URL: "https://127.0.0.1:9012",
    CI: "1",
  },
});
if (result.error) {
  console.error(`Could not run ${npmCommand}: ${result.error.message}`);
  process.exit(1);
}
if (result.status !== 0) process.exit(result.status ?? 1);
