import assert from "node:assert/strict";
import { test } from "node:test";
import { FlockaApiClient } from "@flocka/api-client";
import { fresh } from "@flocka/domain";
import {
  createAuthRuntime,
  TEST_GOOGLE_CLIENT_ID,
} from "./helpers/auth-runtime";

type Runtime = Awaited<ReturnType<typeof createAuthRuntime>>;
const NONCE = "native-nonce-0123456789abcdef";
let serial = 0;
const nextIp = () => `198.51.100.${(++serial % 200) + 1}`;
/** The request the Expo auth client sends for an ID token: no Origin, no cookie. */
const exchange = (f: Runtime, idToken: { token: string; nonce?: string }) =>
  fetch(f.base + "/api/auth/sign-in/social", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "cf-connecting-ip": nextIp(),
      "x-skip-oauth-proxy": "true",
    },
    body: JSON.stringify({ provider: "google", idToken }),
  });
const sessionCookie = (response: Response) =>
  response.headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .find((value) => /session_token=/.test(value));
const userCount = async (f: Runtime) =>
  (
    await f.db
      .prepare("SELECT COUNT(*) AS n FROM auth_users")
      .first<{ n: number }>()
  )?.n;

test("Google appears as a provider only when both credentials are configured", async () => {
  const f = await createAuthRuntime({ googleCredentials: true });
  try {
    assert.deepEqual(await (await fetch(f.base + "/auth/config")).json(), {
      providers: ["google"],
    });
  } finally {
    await f.runtime.dispose();
  }
});

test("native Google sign-in: the web client's ID token signs in, a new user must still accept the terms", async () => {
  const f = await createAuthRuntime({ googleCredentials: true });
  try {
    const token = f.google.key.sign(f.google.claims({ nonce: NONCE }));
    const response = await exchange(f, { token, nonce: NONCE });
    assert.equal(response.status, 200, await response.clone().text());
    const cookie = sessionCookie(response);
    assert.ok(cookie, "the exchange must issue the session cookie");
    const body = (await response.json()) as {
      user: { email: string; termsAccepted: boolean };
    };
    assert.equal(body.user.email, "google.user@example.test");
    assert.equal(body.user.termsAccepted, false);
    const api = new FlockaApiClient(
      f.base,
      { cookie: () => cookie, credentials: "omit" },
      true,
    );
    const profile = fresh().profile;
    profile.name = "Google User";
    // The consent step is not skipped for a Google user.
    await assert.rejects(
      api.createAccount(profile, ["impl", "focus"]),
      /利用規約/,
    );
    await api.acceptTerms();
    const player = await api.createAccount(profile, ["impl", "focus"]);
    assert.equal(player.profile.name, "Google User");
    // Signing in again reuses the same user.
    assert.equal((await exchange(f, { token, nonce: NONCE })).status, 200);
    assert.equal(await userCount(f), 1);
  } finally {
    await f.runtime.dispose();
  }
});

test("native Google sign-in rejects every token the server cannot trust and never issues a session", async () => {
  const f = await createAuthRuntime({ googleCredentials: true });
  try {
    const good = f.google.claims({ nonce: NONCE });
    const now = Math.floor(Date.now() / 1000);
    const cases: [string, string, string][] = [
      [
        "audience of another client",
        f.google.key.sign({
          ...good,
          aud: "someone-else.apps.googleusercontent.com",
        }),
        NONCE,
      ],
      ["nonce that was not asked for", f.google.key.sign(good), "other-nonce"],
      [
        "other issuer",
        f.google.key.sign({ ...good, iss: "https://evil.example" }),
        NONCE,
      ],
      [
        "expired token",
        f.google.key.sign({ ...good, iat: now - 7200, exp: now - 3600 }),
        NONCE,
      ],
      ["signature from another key", f.google.otherKey.sign(good), NONCE],
      ["not a JWT", "abc.def", NONCE],
    ];
    for (const [label, token, nonce] of cases) {
      const response = await exchange(f, { token, nonce });
      assert.equal(response.status, 401, `${label}: ${await response.text()}`);
      assert.equal(sessionCookie(response), undefined, label);
    }
    // Google's key set unreachable is a failure, not a success.
    f.google.certsStatus = 500;
    const outage = await exchange(f, {
      token: f.google.key.sign(good),
      nonce: NONCE,
    });
    assert.equal(outage.status, 401);
    assert.equal(sessionCookie(outage), undefined);
    assert.equal(await userCount(f), 0);
  } finally {
    await f.runtime.dispose();
  }
});

test("a Google account whose email Google has not verified cannot sign in", async () => {
  const f = await createAuthRuntime({ googleCredentials: true });
  try {
    const token = f.google.key.sign(
      f.google.claims({ nonce: NONCE, email_verified: false }),
    );
    const response = await exchange(f, { token, nonce: NONCE });
    assert.notEqual(response.status, 200, await response.clone().text());
    assert.equal(sessionCookie(response), undefined);
  } finally {
    await f.runtime.dispose();
  }
});

/** Cookies set by responses, as one Cookie header value. */
const cookieHeader = (responses: Response[]) =>
  responses
    .flatMap((response) => response.headers.getSetCookie())
    .map((value) => value.split(";")[0])
    .join("; ");
/** What the app does: sign-in/social with expo-origin, then the Custom Tab opens the proxy. */
const startBrowserFlow = async (f: Runtime) => {
  const response = await fetch(f.base + "/api/auth/sign-in/social", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "cf-connecting-ip": nextIp(),
      // What the Expo client sends instead of Origin.
      "expo-origin": "flocka://",
      "x-skip-oauth-proxy": "true",
    },
    body: JSON.stringify({
      provider: "google",
      callbackURL: "flocka://",
      errorCallbackURL: "flocka://auth",
    }),
  });
  assert.equal(response.status, 200, await response.clone().text());
  const { url } = (await response.json()) as { url: string };
  const authorization = new URL(url);
  const proxy = await fetch(
    f.base +
      "/api/auth/expo-authorization-proxy?" +
      new URLSearchParams({ authorizationURL: authorization.href }),
    { redirect: "manual", headers: { "cf-connecting-ip": nextIp() } },
  );
  assert.equal(proxy.status, 302);
  return {
    authorization,
    state: authorization.searchParams.get("state")!,
    cookie: cookieHeader([proxy]),
  };
};
const callback = (f: Runtime, query: string, cookie: string) =>
  fetch(f.base + "/api/auth/callback/google?" + query, {
    headers: { Cookie: cookie, "cf-connecting-ip": nextIp() },
    redirect: "manual",
  });

test("browser Google flow from the app: the custom scheme is trusted and success carries the session cookie", async () => {
  const f = await createAuthRuntime({ googleCredentials: true });
  try {
    const { authorization, state, cookie } = await startBrowserFlow(f);
    assert.equal(authorization.origin, "https://accounts.google.com");
    assert.equal(
      authorization.searchParams.get("client_id"),
      TEST_GOOGLE_CLIENT_ID,
    );
    assert.match(
      authorization.searchParams.get("redirect_uri")!,
      /\/api\/auth\/callback\/google$/,
    );
    assert.match(cookie, /state=/);
    f.google.codeIdToken = f.google.key.sign(
      f.google.claims({
        sub: "browser-subject",
        email: "browser@example.test",
      }),
    );
    const done = await callback(f, `code=abc&state=${state}`, cookie);
    assert.equal(done.status, 302);
    const location = new URL(done.headers.get("location")!);
    assert.equal(location.protocol, "flocka:");
    assert.match(location.searchParams.get("cookie") ?? "", /session_token/);
  } finally {
    await f.runtime.dispose();
  }
});

test("browser Google flow failures come back to the app as flocka://auth?error=<code>", async () => {
  const f = await createAuthRuntime({ googleCredentials: true });
  try {
    const failures: [string, string, () => void][] = [
      ["error=access_denied", "access_denied", () => {}],
      [
        "code=abc",
        "invalid_code",
        () => {
          f.google.tokenStatus = 400;
        },
      ],
    ];
    for (const [query, code, setup] of failures) {
      setup();
      const { state, cookie } = await startBrowserFlow(f);
      const failed = await callback(f, `${query}&state=${state}`, cookie);
      assert.equal(failed.status, 302);
      const location = new URL(failed.headers.get("location")!);
      assert.equal(`${location.protocol}//${location.host}`, "flocka://auth");
      assert.equal(location.searchParams.get("error"), code);
      // The redirect may carry the expired state cookie, never a session.
      assert.doesNotMatch(
        location.searchParams.get("cookie") ?? "",
        /session_token=[^;]/,
      );
    }
    // Without the state cookie (lost between the app and the browser) the flow fails visibly.
    const { state } = await startBrowserFlow(f);
    const lost = await callback(f, `code=abc&state=${state}`, "");
    assert.equal(lost.status, 302);
    assert.match(lost.headers.get("location")!, /error=state_mismatch/);
  } finally {
    await f.runtime.dispose();
  }
});

test("the redirect URI sent to Google is exactly the one the operator registers", async () => {
  // Same value as BETTER_AUTH_URL in apps/api/wrangler.jsonc; a trailing slash must not change it.
  for (const authURL of [
    "https://api.flocka.zofax.net",
    "https://api.flocka.zofax.net/",
  ]) {
    const f = await createAuthRuntime({ googleCredentials: true, authURL });
    try {
      const { authorization } = await startBrowserFlow(f);
      assert.equal(
        authorization.searchParams.get("redirect_uri"),
        "https://api.flocka.zofax.net/api/auth/callback/google",
      );
    } finally {
      await f.runtime.dispose();
    }
  }
});
