import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import {
  Miniflare,
  Response as TestResponse,
  type Request as TestRequest,
} from "miniflare";
import { FlockaApiClient } from "@flocka/api-client";
import { fresh } from "@flocka/domain";
import { z } from "zod";

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
export async function createAuthRuntime() {
  const emails: TestEmail[] = [],
    mailStatus = { value: 200 };
  const options = {
    host: "127.0.0.1",
    port: 0,
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
            DB: { type: "d1", id: "test-flocka" },
            AVATARS: { type: "r2", name: "test-avatars" },
            ALLOWED_ORIGINS: { type: "json", value: "http://localhost:8081" },
            BETTER_AUTH_URL: { type: "json", value: "http://localhost:8787" },
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
    for (const name of readdirSync(directory)
      .filter((name) => name.endsWith(".sql"))
      .sort()) {
      const sql = readFileSync(new URL(name, directory), "utf8").replace(
        /^--.*$/gm,
        "",
      );
      for (const statement of sql
        .split(";")
        .map((text) => text.trim())
        .filter(Boolean))
        await db.prepare(statement).run();
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
          Origin: "http://localhost:8081",
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
        .find((value) => value.startsWith("better-auth.session_token="));
      assert.ok(cookie, "Better Auth must issue a signed session cookie");
      return cookie;
    };
    const register = async (name: string) => {
      const number = ++serial,
        email = `player${number}@example.test`,
        ip = `192.0.2.${number}`,
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
        ),
        profile = fresh().profile;
      profile.name = name;
      const player = await api.createAccount(profile, ["impl", "focus"]);
      return { cookie, player, email, password, api, ip };
    };
    return {
      runtime,
      db,
      base,
      emails,
      mailStatus,
      auth,
      codeFor,
      cookieFor,
      register,
      setAdmins,
    };
  } catch (error) {
    await runtime.dispose();
    throw error;
  }
}
