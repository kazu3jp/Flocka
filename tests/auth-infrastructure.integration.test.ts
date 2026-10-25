import assert from "node:assert/strict";
import { test } from "node:test";
import { createAuthRuntime } from "./helpers/auth-runtime";

test("dashboard access is opt-in, origin-scoped, and requires dashboard authentication", async () => {
  for (const infrastructure of [false, true]) {
    const f = await createAuthRuntime({ infrastructure });
    try {
      const origin = "https://dash.better-auth.com";
      const config = await fetch(f.base + "/api/auth/dash/config", {
        headers: { Origin: origin },
      });
      assert.equal(config.status, infrastructure ? 401 : 403);
      if (infrastructure)
        assert.equal(config.headers.get("Access-Control-Allow-Origin"), origin);

      const unrelated = await fetch(f.base + "/v1/me", {
        headers: { Origin: origin },
      });
      assert.equal(unrelated.status, 403);
      const attacker = await fetch(f.base + "/api/auth/dash/config", {
        headers: { Origin: "https://dash.better-auth.com.attacker.test" },
      });
      assert.equal(attacker.status, 403);

      const preflight = await fetch(f.base + "/api/auth/sign-in/email", {
        method: "OPTIONS",
        headers: {
          Origin: "http://localhost:8081",
          "Access-Control-Request-Method": "POST",
          "Access-Control-Request-Headers":
            "content-type,x-visitor-id,x-request-id,x-pow-solution",
        },
      });
      assert.equal(preflight.status, 204);
      const allowed = preflight.headers.get("Access-Control-Allow-Headers");
      for (const header of ["X-Visitor-Id", "X-Request-Id", "X-PoW-Solution"])
        assert.ok(allowed?.includes(header));
      assert.ok(
        config.headers
          .get("Access-Control-Expose-Headers")
          ?.includes("X-PoW-Challenge") || !infrastructure,
      );
    } finally {
      await f.runtime.dispose();
    }
  }
});

test("dashboard tracking does not turn failed verification delivery into success", async () => {
  const f = await createAuthRuntime({ infrastructure: true });
  try {
    const email = "infra-email@example.test";
    const signup = await f.auth("/sign-up/email", {
      name: "ハル",
      email,
      password: "Good-password123",
      termsAccepted: true,
    });
    assert.equal(signup.status, 200, await signup.text());
    f.mailStatus.value = 400;
    const sent = await f.auth("/email-otp/send-verification-otp", {
      email,
      type: "email-verification",
    });
    assert.equal(sent.status, 502, await sent.text());
    assert.equal(f.emails.length, 0);
    assert.ok(
      f.infrastructureCalls.some((url) => url.endsWith("/events/track")),
      "dashboard events must use the intercepted external service",
    );
  } finally {
    await f.runtime.dispose();
  }
});
