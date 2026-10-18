import assert from "node:assert/strict";
import { createServer, type RequestListener } from "node:http";
import { setImmediate } from "node:timers/promises";
import { test } from "node:test";
import { ApiClientError, FlockaApiClient } from "@flocka/api-client";

async function serve(handler: RequestListener) {
  const server = createServer(handler);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Missing test server address");
  return {
    server,
    base: `http://127.0.0.1:${address.port}`,
    close: async () => {
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}

async function rejects(
  operation: Promise<unknown>,
  status: number,
  code: string,
  message: string,
) {
  await assert.rejects(
    operation,
    (error) =>
      error instanceof ApiClientError &&
      error.status === status &&
      error.code === code &&
      error.message === message,
  );
}

test("HTTP client rejects malformed responses without exposing schema or gateway details", async () => {
  const service = await serve((request, response) => {
    const mode = request.url!.split("/")[1];
    if (mode === "network") {
      request.socket.destroy();
      return;
    }
    if (mode === "html") {
      response
        .writeHead(503, { "Content-Type": "text/html" })
        .end("<html>internal gateway trace</html>");
      return;
    }
    if (mode === "mime") {
      response.writeHead(200, { "Content-Type": "text/html" });
      response.flushHeaders();
      response.write("unexpected image response");
      return;
    }
    if (mode === "image") {
      response
        .writeHead(200, { "Content-Type": "image/png" })
        .end("not an image");
      return;
    }
    response.setHeader("Content-Type", "application/json");
    if (mode === "json") {
      response.end("internal invalid JSON");
      return;
    }
    if (mode === "shape") {
      response.end(JSON.stringify({ internal_schema: "profile.avatar.type" }));
      return;
    }
    response.writeHead(mode === "input" ? 422 : 409).end(
      JSON.stringify({
        error: {
          code: mode === "input" ? "INVALID_INPUT" : "VISIBILITY_CONFLICT",
          message:
            mode === "input"
              ? "profile.avatar.type: Invalid enum value"
              : "公開範囲が更新されています",
        },
      }),
    );
  });
  try {
    const client = (mode: string) =>
      new FlockaApiClient(`${service.base}/${mode}`, {}, true);
    const invalid = "APIの応答を読み込めませんでした。もう一度お試しください";
    await rejects(client("json").getMe(), 200, "INVALID_RESPONSE", invalid);
    await rejects(client("shape").getMe(), 200, "INVALID_RESPONSE", invalid);
    await rejects(client("html").getMe(), 503, "INVALID_RESPONSE", invalid);
    await rejects(client("mime").getAvatar(), 200, "INVALID_RESPONSE", invalid);
    await rejects(
      client("image").getAvatar(),
      200,
      "INVALID_RESPONSE",
      invalid,
    );
    await rejects(
      client("network").getMe(),
      0,
      "NETWORK_ERROR",
      "APIに接続できません。接続先と通信環境を確認してください",
    );
    await rejects(
      client("input").getMe(),
      422,
      "INVALID_INPUT",
      "入力内容を確認して、もう一度お試しください",
    );
    await rejects(
      client("conflict").getMe(),
      409,
      "VISIBILITY_CONFLICT",
      "公開範囲が更新されています",
    );
    await rejects(
      new FlockaApiClient(
        service.base,
        {
          cookie: async () => {
            throw new Error("private keychain detail");
          },
        },
        true,
      ).getMe(),
      0,
      "AUTH_STORAGE",
      "認証情報を読み込めませんでした。もう一度お試しください",
    );
  } finally {
    await service.close();
  }
});

test(
  "request deadline covers stalled JSON, image bodies and credentials without starting a late request",
  { timeout: 25_000 },
  async () => {
    const requests: string[] = [];
    const service = await serve((request, response) => {
      requests.push(request.url!);
      const image = request.url!.includes("/avatar");
      response.writeHead(200, {
        "Content-Type": image ? "image/png" : "application/json",
      });
      response.flushHeaders();
      response.write(
        image ? Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]) : "{",
      );
      // Deliberately keep the body open after headers, using a real HTTP socket.
    });
    let release!: (cookie: string) => void;
    const cookie = new Promise<string>((resolve) => {
      release = resolve;
    });
    const cleanup = setTimeout(() => {
      service.server.closeAllConnections();
      release("late-test-session");
    }, 20_000);
    try {
      const reader = new FlockaApiClient(service.base, {}, true);
      const waiting = new FlockaApiClient(
        `${service.base}/late`,
        { cookie: () => cookie },
        true,
      );
      const results = await Promise.allSettled([
        reader.getMe(),
        reader.getAvatar(),
        waiting.getMe(),
      ]);
      for (const result of results) {
        assert.equal(result.status, "rejected");
        if (result.status === "rejected") {
          assert.ok(result.reason instanceof ApiClientError);
          assert.equal(result.reason.code, "TIMEOUT");
        }
      }
      release("late-test-session");
      await setImmediate();
      assert.equal(
        requests.some((path) => path.startsWith("/late/")),
        false,
      );
      assert.equal(requests.length, 2);
    } finally {
      clearTimeout(cleanup);
      release("late-test-session");
      await service.close();
    }
  },
);
