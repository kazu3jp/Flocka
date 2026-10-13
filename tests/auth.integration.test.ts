import assert from "node:assert/strict";
import { test } from "node:test";
import { createAuthRuntime } from "./helpers/auth-runtime";

test("Better Auth verifies email, rejects bad credentials, rotates sessions, and resets passwords via Resend", async () => {
  const f = await createAuthRuntime();
  try {
    const email = "auth@example.test",
      password = "Good-password123";
    assert.equal(
      (await f.auth("/sign-up/email", { name: "ハル", email, password }))
        .status,
      400,
    );
    assert.equal(
      (
        await f.auth("/sign-up/email", {
          name: "ハル",
          email,
          password: "abcdefgh",
          termsAccepted: true,
        })
      ).status,
      400,
    );
    // Separate IPs keep testing credentials independent of rate-limit checks.
    const signup = await f.auth("/sign-up/email", {
      name: "ハル",
      email,
      password,
      termsAccepted: true,
    });
    assert.equal(signup.status, 200, await signup.text());
    assert.equal(
      (await f.auth("/sign-in/email", { email, password })).status,
      403,
    );
    assert.equal(
      (
        await f.auth(
          "/email-otp/send-verification-otp",
          {
            email,
            type: "sign-in",
          },
          undefined,
          "192.0.2.200",
        )
      ).status,
      403,
    );
    const sent = await f.auth("/email-otp/send-verification-otp", {
      email,
      type: "email-verification",
    });
    assert.equal(sent.status, 200, await sent.text());
    assert.equal(f.emails[0].from, "Flocka <no-reply@flocka.zofax.net>");
    const otp = f.codeFor(email),
      wrong = otp === "000000" ? "111111" : "000000";
    assert.equal(
      (await f.auth("/email-otp/verify-email", { email, otp: wrong })).status,
      400,
    );
    const verified = await f.auth("/email-otp/verify-email", { email, otp });
    assert.equal(verified.status, 200, await verified.clone().text());
    const cookie = f.cookieFor(verified);
    const session = await (
      await f.auth("/get-session", undefined, cookie)
    ).json();
    assert.equal(session.user.emailVerified, true);
    assert.equal(
      (await f.auth("/email-otp/verify-email", { email, otp })).status,
      400,
      "OTP is single use",
    );
    assert.equal(
      (await f.auth("/sign-in/email", { email, password: "Wrong-password123" }))
        .status,
      401,
    );
    assert.equal(
      (await f.auth("/sign-in/email", { email, password })).status,
      200,
    );
    assert.equal(
      (
        await f.auth("/request-password-reset", {
          email,
          redirectTo: "https://untrusted.example/reset",
        })
      ).status,
      403,
    );
    const reset = await f.auth("/request-password-reset", {
      email,
      redirectTo: "http://localhost:8081/reset-password",
    });
    assert.equal(reset.status, 200, await reset.text());
    // waitUntil delivery is asynchronous; poll boundedly without sending real email.
    for (let i = 0; i < 40 && f.emails.length < 2; i++)
      await new Promise((resolve) => setTimeout(resolve, 25));
    const delivery = f.emails
      .slice()
      .reverse()
      .find((item) => item.subject.includes("再設定"));
    assert.ok(delivery);
    const link = /https?:\/\/[^\s]+/.exec(delivery.text)?.[0];
    assert.ok(link);
    const url = new URL(link),
      token = url.pathname.split("/").at(-1);
    assert.ok(token);
    assert.equal(
      url.searchParams.get("callbackURL"),
      "http://localhost:8081/reset-password",
    );
    assert.equal(
      (await f.auth("/reset-password", { token, newPassword: "weak" })).status,
      400,
    );
    const changed = await f.auth("/reset-password", {
      token,
      newPassword: "New-password456",
    });
    assert.equal(changed.status, 200, await changed.text());
    assert.equal(
      await (await f.auth("/get-session", undefined, cookie)).json(),
      null,
      "Reset revokes all old sessions",
    );
    assert.equal(
      (
        await f.auth("/reset-password", {
          token,
          newPassword: "Other-password456",
        })
      ).status,
      400,
      "Reset token is single use",
    );
    assert.equal(
      (
        await f.auth(
          "/sign-in/email",
          { email, password },
          undefined,
          "192.0.2.101",
        )
      ).status,
      401,
    );
    const signedIn = await f.auth(
      "/sign-in/email",
      { email, password: "New-password456" },
      undefined,
      "192.0.2.101",
    );
    assert.equal(signedIn.status, 200, await signedIn.clone().text());
    const newCookie = f.cookieFor(signedIn);
    assert.equal((await f.auth("/sign-out", {}, newCookie)).status, 200);
    assert.equal(
      await (await f.auth("/get-session", undefined, newCookie)).json(),
      null,
    );
    const stored = await f.db
      .prepare(
        "SELECT password FROM auth_accounts WHERE provider_id = 'credential'",
      )
      .first<{ password: string }>();
    assert.ok(stored);
    assert.notEqual(stored.password, "New-password456");
  } finally {
    await f.runtime.dispose();
  }
});

test("Resend rejection is not reported as a delivered verification email; resend is limited", async () => {
  const f = await createAuthRuntime();
  try {
    const email = "delivery@example.test";
    assert.equal(
      (
        await f.auth("/sign-up/email", {
          name: "ソラ",
          email,
          password: "Test-password123",
          termsAccepted: true,
        })
      ).status,
      200,
    );
    f.mailStatus.value = 422;
    const sent = await f.auth("/email-otp/send-verification-otp", {
      email,
      type: "email-verification",
    });
    assert.equal(sent.status, 502, await sent.text());
    assert.equal(f.emails.length, 0);
    const resend = await f.auth("/email-otp/send-verification-otp", {
      email,
      type: "email-verification",
    });
    assert.equal(resend.status, 429);
  } finally {
    await f.runtime.dispose();
  }
});
