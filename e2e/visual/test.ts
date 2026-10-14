import { createHash } from "node:crypto";
import { test as base, expect } from "@playwright/test";

export { expect };

export const test = base.extend<{ isolatedClient: void; runtimeErrors: void }>({
  isolatedClient: [
    async ({ context }, use, testInfo) => {
      // Miniflare represents the edge locally. Give each independent browser
      // context a distinct address from the reserved benchmarking range so the
      // real authentication limiter does not combine unrelated test clients.
      const digest = createHash("sha256").update(testInfo.testId).digest();
      await context.setExtraHTTPHeaders({
        "CF-Connecting-IP": `198.18.${digest[0]}.${digest[1]}`,
      });
      await use();
    },
    { auto: true },
  ],
  runtimeErrors: [
    async ({ context }, use) => {
      const errors: string[] = [];
      context.on("page", (page) =>
        page.on("pageerror", (error) => errors.push(error.message)),
      );
      await use();
      expect(
        errors,
        "No uncaught errors in application or reference pages",
      ).toEqual([]);
    },
    { auto: true },
  ],
});
