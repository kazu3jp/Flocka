import { createServer } from "node:https";
import { readFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { createAuthRuntime } from "../../tests/helpers/auth-runtime";
import { seedScenario } from "./seed";

const root = resolve(fileURLToPath(new URL("../../", import.meta.url)));
const runtime = await createAuthRuntime({
  port: 9010,
  webOrigin: "https://127.0.0.1:9012",
  authURL: "https://127.0.0.1:9012",
});
const mime: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript",
  ".css": "text/css",
  ".ttf": "font/ttf",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".json": "application/json",
};
const fonts: Record<string, string> = {
  "display.ttf":
    "@expo-google-fonts/dela-gothic-one/400Regular/DelaGothicOne_400Regular.ttf",
  "body.ttf":
    "@expo-google-fonts/zen-kaku-gothic-new/500Medium/ZenKakuGothicNew_500Medium.ttf",
  "bold.ttf":
    "@expo-google-fonts/zen-kaku-gothic-new/700Bold/ZenKakuGothicNew_700Bold.ttf",
};
const fixtures = new Map<string, ReturnType<typeof seedScenario>>();
const tls = {
  key: await readFile(resolve(root, "tools/vrt/.generated/tls.key")),
  cert: await readFile(resolve(root, "tools/vrt/.generated/tls.crt")),
};
const server = createServer(tls, async (request, response) => {
  try {
    const url = new URL(request.url ?? "/", "https://127.0.0.1:9012");
    if (
      url.pathname.startsWith("/api/auth/") ||
      url.pathname.startsWith("/v1/") ||
      url.pathname === "/auth/config"
    ) {
      const chunks: Buffer[] = [];
      let bytesReceived = 0;
      for await (const chunk of request) {
        const buffer = Buffer.from(chunk);
        bytesReceived += buffer.length;
        if (bytesReceived > 5 * 1024 * 1024) {
          response.writeHead(413).end("VRT request too large");
          return;
        }
        chunks.push(buffer);
      }
      const headers = new Headers();
      for (const [name, value] of Object.entries(request.headers))
        if (value && !["host", "connection", "content-length"].includes(name))
          headers.set(name, Array.isArray(value) ? value.join(",") : value);
      const upstream = await fetch(runtime.base + url.pathname + url.search, {
        method: request.method,
        headers,
        body: chunks.length ? Buffer.concat(chunks) : undefined,
        redirect: "manual",
      });
      response.statusCode = upstream.status;
      for (const [name, value] of upstream.headers)
        if (
          ![
            "set-cookie",
            "content-encoding",
            "content-length",
            "transfer-encoding",
          ].includes(name)
        )
          response.setHeader(name, value);
      if (upstream.headers.getSetCookie().length)
        response.setHeader("Set-Cookie", upstream.headers.getSetCookie());
      response.end(Buffer.from(await upstream.arrayBuffer()));
      return;
    }
    if (url.pathname === "/__vrt/ready") {
      response.end("ready");
      return;
    }
    if (url.pathname === "/__vrt/mailbox" && request.method === "GET") {
      const recipient = z.string().email().parse(url.searchParams.get("to"));
      response.setHeader("Content-Type", "application/json");
      response.end(
        JSON.stringify(
          runtime.emails.filter((email) => email.to.includes(recipient)),
        ),
      );
      return;
    }
    if (url.pathname === "/__vrt/fixture" && request.method === "POST") {
      const scenario = z
        .enum(["onboarding", "empty", "collected"])
        .parse(url.searchParams.get("scenario"));
      if (!fixtures.has(scenario))
        fixtures.set(scenario, seedScenario(runtime, scenario));
      const fixture = await fixtures.get(scenario);
      response.setHeader("Content-Type", "application/json");
      response.end(JSON.stringify(fixture));
      return;
    }
    let file: string;
    if (url.pathname === "/reference/")
      file = resolve(root, "tools/vrt/.generated/reference.html");
    else if (url.pathname.startsWith("/reference/vendor/"))
      file = resolve(
        root,
        "tools/vrt/vendor",
        url.pathname.slice("/reference/vendor/".length),
      );
    else if (url.pathname.startsWith("/reference/fonts/")) {
      const name = url.pathname.slice("/reference/fonts/".length);
      if (!fonts[name]) {
        response.writeHead(404).end();
        return;
      }
      file = resolve(root, "node_modules", fonts[name]);
    } else if (url.pathname.startsWith("/reference/"))
      file = resolve(root, "design", url.pathname.slice("/reference/".length));
    else
      file = resolve(
        root,
        "apps/mobile/dist-vrt",
        "." + decodeURIComponent(url.pathname),
      );
    if (!file.startsWith(root + sep)) {
      response.writeHead(403).end();
      return;
    }
    let bytes: Buffer;
    try {
      bytes = await readFile(file);
    } catch {
      if (url.pathname.startsWith("/reference/") || extname(file)) {
        response.writeHead(404).end();
        return;
      }
      file = resolve(root, "apps/mobile/dist-vrt/index.html");
      bytes = await readFile(file);
    }
    response.setHeader(
      "Content-Type",
      mime[extname(file)] ?? "application/octet-stream",
    );
    response.setHeader("Cache-Control", "no-store");
    response.end(bytes);
  } catch (error) {
    console.error(error instanceof Error ? error.message : "VRT fixture error");
    response.writeHead(500).end("VRT setup failed");
  }
});
server.listen(9012, "127.0.0.1");
const stop = async () => {
  server.close();
  await runtime.runtime.dispose();
  process.exit(0);
};
process.once("SIGTERM", () => {
  void stop();
});
process.once("SIGINT", () => {
  void stop();
});
