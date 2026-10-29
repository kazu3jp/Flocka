import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import {
  Miniflare,
  Response as TestResponse,
  type Request as TestRequest,
} from "miniflare";
import { FlockaApiClient } from "@flocka/api-client";
import { fresh } from "@flocka/domain";
import { z } from "zod";
import { testClientAddress } from "./client-address";

const emailSchema = z.object({
  from: z.string(),
  to: z
    .union([z.string(), z.array(z.string())])
    .transform((value) => (typeof value === "string" ? [value] : value)),
  subject: z.string(),
  text: z.string(),
  html: z.string(),
});
export type TestEmail = z.infer<typeof emailSchema>;
/** Scripted answer of the fake Workers AI binding for one call. */
export type FakeAiScript = {
  result?: unknown;
  error?: string;
  delayMs?: number;
};
/** Entrypoint behind the AI binding: it forwards every run() to the test's script. */
const FAKE_AI_WORKER = `
import { WorkerEntrypoint } from "cloudflare:workers";
export default class extends WorkerEntrypoint {
  async run(model, inputs) {
    const response = await this.env.CONTROL.fetch("http://control/run", {
      method: "POST",
      body: JSON.stringify({ model, inputs }),
    });
    const script = await response.json();
    if (script.delayMs) await new Promise((resolve) => setTimeout(resolve, script.delayMs));
    if (script.error) throw new Error(script.error);
    return script.result;
  }
}`;
const quotesIn = (inputs: unknown) => {
  const { messages } = inputs as { messages: { content: string }[] };
  return [
    ...messages[1].content.matchAll(
      /<testimony index="\d+">(.*?)<\/testimony>/gs,
    ),
  ].map((match) => match[1]);
};
/** A valid OpenAI-style answer with sentence-level evidence metadata. */
export const goodAiResult = (inputs: unknown, completionTokens = 300) => ({
  choices: [
    {
      message: {
        role: "assistant",
        content: JSON.stringify({
          claims: quotesIn(inputs)
            .slice(0, 2)
            .map((quote, index) => ({
              sentence:
                index === 0
                  ? `仲間から「${quote}」と言われました。`
                  : `また、「${quote}」という言葉ももらいました。`,
              sourceIndexes: [index + 1],
              quotes: [quote],
            })),
        }),
      },
    },
  ],
  usage: { prompt_tokens: 1200, completion_tokens: completionTokens },
});
const goodGroundingResult = (inputs: unknown) => ({
  answers: Object.fromEntries(
    Object.keys(
      (inputs as { questions: Record<string, unknown> }).questions,
    ).map((key) => [key, 0.99]),
  ),
});
export const TEST_GOOGLE_CLIENT_ID =
  "test-web-client.apps.googleusercontent.com";
const b64url = (value: Buffer | string) =>
  Buffer.from(value).toString("base64url");
/** A Google-shaped signing key: the fake JWKS endpoint publishes only its public half. */
function createGoogleKey(kid: string) {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
  });
  return {
    kid,
    jwk: {
      ...publicKey.export({ format: "jwk" }),
      kid,
      alg: "RS256",
      use: "sig",
    },
    sign(
      claims: Record<string, unknown>,
      header: Record<string, unknown> = {},
    ) {
      const signingInput = `${b64url(JSON.stringify({ alg: "RS256", kid, typ: "JWT", ...header }))}.${b64url(JSON.stringify(claims))}`;
      return `${signingInput}.${b64url(sign("RSA-SHA256", Buffer.from(signingInput), privateKey))}`;
    },
  };
}
export async function createAuthRuntime(
  input: {
    port?: number;
    webOrigin?: string;
    authURL?: string;
    appleCredentials?: boolean;
    googleCredentials?: boolean;
    infrastructure?: boolean;
    throughMigration?: string;
  } = {},
) {
  // Load the CLI only when creating a runtime. Static named-import analysis
  // otherwise parses Wrangler's entire CLI bundle during ESLint's export checks.
  const { unstable_splitSqlQuery: splitSqlQuery } = await import("wrangler");
  const webOrigin = input.webOrigin ?? "http://localhost:8081";
  const emails: TestEmail[] = [],
    mailStatus = { value: 200 };
  const revocations = {
    calls: [] as { url: string; body: string }[],
    status: 200,
    error: "invalid_token",
  };
  const infrastructureCalls: string[] = [];
  // Stands in for Google: its key set, token endpoint and the ID token it returns.
  const googleKey = createGoogleKey("test-google-key");
  const google = {
    key: googleKey,
    otherKey: createGoogleKey("test-google-key"),
    certsStatus: 200,
    tokenStatus: 200,
    /** ID token the fake token endpoint hands back for an authorization code. */
    codeIdToken: "",
    calls: [] as string[],
    /** Claims of a valid ID token for this app's web client. */
    claims(overrides: Record<string, unknown> = {}) {
      const now = Math.floor(Date.now() / 1000);
      return {
        iss: "https://accounts.google.com",
        aud: TEST_GOOGLE_CLIENT_ID,
        azp: "android-client.apps.googleusercontent.com",
        sub: "google-subject-1",
        email: "google.user@example.test",
        email_verified: true,
        name: "Google User",
        iat: now,
        exp: now + 3600,
        ...overrides,
      };
    },
  };
  const push = {
    calls: [] as { path: string; body: unknown }[],
    status: 200,
    tickets: [] as unknown[],
    receipts: {} as Record<string, unknown>,
  };
  const ai = {
    calls: [] as { model: string; inputs: unknown }[],
    script: ((inputs: unknown): FakeAiScript => ({
      result: goodAiResult(inputs),
    })) as (inputs: unknown) => FakeAiScript,
    groundingScript: ((inputs: unknown): FakeAiScript => ({
      result: goodGroundingResult(inputs),
    })) as (inputs: unknown) => FakeAiScript,
  };
  const options = {
    host: "127.0.0.1",
    unsafeTriggerHandlers: true,
    port: input.port ?? 0,
    workers: [
      {
        config: {
          name: "flocka-test",
          compatibilityDate: "2026-10-13",
          compatibilityFlags: ["nodejs_compat"],
          manifest: {
            mainModule: "index.js",
            modules: {
              "index.js": {
                type: "esm",
                contents: readFileSync(
                  new URL("../../apps/api/dist/index.js", import.meta.url),
                  "utf8",
                ),
              },
            },
          },
          env: {
            ...(input.infrastructure
              ? {
                  BETTER_AUTH_API_KEY: {
                    type: "json" as const,
                    value: "test-infra-key-never-sent",
                  },
                }
              : {}),
            ...(input.googleCredentials
              ? {
                  GOOGLE_CLIENT_ID: {
                    type: "json" as const,
                    value: TEST_GOOGLE_CLIENT_ID,
                  },
                  GOOGLE_CLIENT_SECRET: {
                    type: "json" as const,
                    value: "test-google-secret",
                  },
                }
              : {}),
            ...(input.appleCredentials
              ? {
                  APPLE_CLIENT_ID: {
                    type: "json" as const,
                    value: "test-apple-client",
                  },
                  APPLE_CLIENT_SECRET: {
                    type: "json" as const,
                    value: "test-apple-secret",
                  },
                }
              : {}),
            DB: { type: "d1", id: "test-flocka" },
            AI: { type: "worker" as const, worker: "flocka-ai-fake" },
            PR_AI_TIMEOUT_MS: { type: "json" as const, value: "1500" },
            AVATARS: { type: "r2", name: "test-avatars" },
            ALLOWED_ORIGINS: { type: "json", value: webOrigin },
            BETTER_AUTH_URL: {
              type: "json",
              value:
                input.authURL ??
                (input.port
                  ? `http://127.0.0.1:${input.port}`
                  : "http://localhost:8787"),
            },
            BETTER_AUTH_SECRET: {
              type: "json",
              value: "test-only-secret-for-flocka-at-least-32-characters",
            },
            RESEND_API_KEY: { type: "json", value: "re_test_never_sent" },
            RESEND_FROM: {
              type: "json",
              value: "Flocka <no-reply@flocka.zofax.net>",
            },
          },
        },
        dev: {
          stripCfConnectingIp: false,
          outboundService: {
            type: "fetcher",
            handler: async (request: TestRequest) => {
              if (
                input.infrastructure &&
                [
                  "https://dash.better-auth.com",
                  "https://kv.better-auth.com",
                ].includes(new URL(request.url).origin)
              ) {
                infrastructureCalls.push(request.url);
                return new TestResponse(
                  JSON.stringify(
                    new URL(request.url).pathname === "/security/check"
                      ? { action: "allow" }
                      : {},
                  ),
                  { headers: { "Content-Type": "application/json" } },
                );
              }
              if (
                request.url === "https://www.googleapis.com/oauth2/v3/certs"
              ) {
                google.calls.push("certs");
                return new TestResponse(
                  JSON.stringify({ keys: [google.key.jwk] }),
                  {
                    status: google.certsStatus,
                    headers: { "Content-Type": "application/json" },
                  },
                );
              }
              if (request.url === "https://oauth2.googleapis.com/token") {
                google.calls.push("token");
                return new TestResponse(
                  google.tokenStatus === 200
                    ? JSON.stringify({
                        access_token: "test-google-access",
                        token_type: "Bearer",
                        expires_in: 3600,
                        id_token: google.codeIdToken,
                      })
                    : JSON.stringify({ error: "invalid_grant" }),
                  {
                    status: google.tokenStatus,
                    headers: { "Content-Type": "application/json" },
                  },
                );
              }
              if (
                [
                  "https://appleid.apple.com/auth/revoke",
                  "https://oauth2.googleapis.com/revoke",
                ].includes(request.url)
              ) {
                revocations.calls.push({
                  url: request.url,
                  body: await request.text(),
                });
                return new TestResponse(
                  revocations.status === 200
                    ? null
                    : JSON.stringify({ error: revocations.error }),
                  { status: revocations.status },
                );
              }
              if (request.url.startsWith("https://exp.host/--/api/v2/push/")) {
                const path = new URL(request.url).pathname.split("/").pop()!;
                push.calls.push({ path, body: await request.json() });
                return new TestResponse(
                  JSON.stringify({
                    data: path === "send" ? push.tickets : push.receipts,
                  }),
                  {
                    status: push.status,
                    headers: { "Content-Type": "application/json" },
                  },
                );
              }
              assert.equal(request.url, "https://api.resend.com/emails");
              assert.equal(
                request.headers.get("authorization"),
                "Bearer re_test_never_sent",
              );
              if (mailStatus.value !== 200)
                return new TestResponse(
                  JSON.stringify({
                    name: "validation_error",
                    message: "Test rejection",
                  }),
                  {
                    status: mailStatus.value,
                    headers: { "Content-Type": "application/json" },
                  },
                );
              emails.push(emailSchema.parse(await request.json()));
              return new TestResponse(
                JSON.stringify({ id: crypto.randomUUID() }),
                { headers: { "Content-Type": "application/json" } },
              );
            },
          },
        },
      },
      {
        config: {
          name: "flocka-ai-fake",
          compatibilityDate: "2026-10-13",
          manifest: {
            mainModule: "index.js",
            modules: {
              "index.js": { type: "esm", contents: FAKE_AI_WORKER },
            },
          },
          env: {
            CONTROL: {
              type: "fetcher" as const,
              handler: async (request: TestRequest) => {
                const call = (await request.json()) as {
                  model: string;
                  inputs: unknown;
                };
                ai.calls.push(call);
                return new TestResponse(
                  JSON.stringify(
                    call.model === "@cf/cloudflare/clef"
                      ? ai.groundingScript(call.inputs)
                      : ai.script(call.inputs),
                  ),
                  {
                    headers: { "Content-Type": "application/json" },
                  },
                );
              },
            },
          },
        },
      },
    ],
  };
  const runtime = new Miniflare(options);
  const setAdmins = (ids: string[]) => {
    (options.workers[0].config.env as Record<string, unknown>).ADMIN_USER_IDS =
      {
        type: "json",
        value: ids.join(","),
      };
    return runtime.setOptions(options);
  };
  try {
    const db = await runtime.getD1Database("DB"),
      directory = new URL("../../apps/api/migrations/", import.meta.url);
    const migrationFiles = readdirSync(directory)
      .filter((name) => name.endsWith(".sql"))
      .sort();
    const applyMigration = async (name: string) => {
      if (!migrationFiles.includes(name))
        throw new Error(`Unknown migration: ${name}`);
      const sql = readFileSync(new URL(name, directory), "utf8").replace(
        /^--.*$/gm,
        "",
      );
      for (const statement of splitSqlQuery(sql))
        await db.prepare(statement).run();
    };
    if (
      input.throughMigration &&
      !migrationFiles.includes(input.throughMigration)
    )
      throw new Error("Unknown migration boundary");
    for (const name of migrationFiles) {
      if (!input.throughMigration || name <= input.throughMigration)
        await applyMigration(name);
    }
    const base = (await runtime.ready).origin;
    let serial = 0;
    const auth = (
      path: string,
      body?: unknown,
      cookie?: string,
      ip = "192.0.2.100",
    ) =>
      fetch(base + "/api/auth" + path, {
        method: body === undefined ? "GET" : "POST",
        headers: {
          Origin: webOrigin,
          "cf-connecting-ip": ip,
          ...(cookie ? { Cookie: cookie } : {}),
          ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    const codeFor = (email: string) => {
      const delivery = emails
        .slice()
        .reverse()
        .find((item) => item.to.includes(email));
      assert.ok(delivery);
      const code = /\b\d{6}\b/.exec(delivery.text)?.[0];
      assert.ok(code);
      return code;
    };
    const cookieFor = (response: Response) => {
      const cookie = response.headers
        .getSetCookie()
        .map((value) => value.split(";")[0])
        .find((value) =>
          /^(?:__Secure-)?better-auth\.session_token=/.test(value),
        );
      assert.ok(cookie, "Better Auth must issue a signed session cookie");
      return cookie;
    };
    const authenticate = async (name: string, emailOverride?: string) => {
      const number = ++serial,
        email = emailOverride ?? `player${number}@example.test`,
        ip = testClientAddress(number),
        password = "Test-password123";
      const signup = await auth(
        "/sign-up/email",
        { name, email, password, termsAccepted: true },
        undefined,
        ip,
      );
      assert.equal(signup.status, 200, await signup.text());
      const sent = await auth(
        "/email-otp/send-verification-otp",
        { email, type: "email-verification" },
        undefined,
        ip,
      );
      assert.equal(sent.status, 200, await sent.text());
      const verified = await auth(
        "/email-otp/verify-email",
        { email, otp: codeFor(email) },
        undefined,
        ip,
      );
      assert.equal(verified.status, 200, await verified.clone().text());
      const cookie = cookieFor(verified),
        api = new FlockaApiClient(
          base,
          { cookie: () => cookie, credentials: "omit" },
          true,
        );
      return { cookie, email, password, api, ip };
    };
    const register = async (name: string, emailOverride?: string) => {
      const session = await authenticate(name, emailOverride);
      const profile = fresh().profile;
      profile.name = name;
      const player = await session.api.createAccount(profile, [
        "impl",
        "focus",
      ]);
      return { ...session, player };
    };
    return {
      runtime,
      db,
      applyMigration,
      ai,
      base,
      emails,
      mailStatus,
      push,
      auth,
      codeFor,
      cookieFor,
      register,
      authenticate,
      setAdmins,
      revocations,
      infrastructureCalls,
      google,
    };
  } catch (error) {
    await runtime.dispose();
    throw error;
  }
}
