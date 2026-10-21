import { createHash } from "node:crypto";
import { test as base, expect, type Page } from "@playwright/test";

export { expect };

/**
 * Tab screens stay mounted out of view (display: none) so going back reveals
 * them without a rebuild. Role queries already skip hidden elements; text and
 * test id queries do not, so they leave out those kept screens
 * (`hidden-screen` in apps/mobile/src/features/navigation/ScreenStacks.tsx).
 */
function onScreenQueries(page: Page): Page {
  return new Proxy(page, {
    get(target, property, receiver) {
      if (property === "getByText" || property === "getByTestId")
        return (...args: Parameters<Page["getByText"]>) =>
          target[property](...args).and(
            target.locator(':not([data-testid="hidden-screen"] *)'),
          );
      const value = Reflect.get(target, property, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}

export const test = base.extend<{ isolatedClient: void; runtimeErrors: void }>({
  page: async ({ page }, provide) => {
    await provide(onScreenQueries(page));
  },
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
