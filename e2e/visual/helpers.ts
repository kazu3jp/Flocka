import {
  expect,
  type Page,
  type BrowserContext,
  type TestInfo,
} from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";

export async function ready(page: Page) {
  await page.evaluate(() => document.fonts.ready);
  await expect(
    page.getByText("デッキを読み込み中…", { exact: true }),
  ).toHaveCount(0);
  await page.mouse.move(-1, -1);
}
export async function signInFixture(
  context: BrowserContext,
  scenario: "onboarding" | "empty" | "collected",
) {
  const response = await context.request.post(
    `/__vrt/fixture?scenario=${scenario}`,
  );
  expect(response.ok()).toBeTruthy();
  const fixture = (await response.json()) as {
    cookie: string;
    playerId?: string;
    exchanges?: string[];
    pieceId?: string;
    unopenedId?: string;
  };
  const delimiter = fixture.cookie.indexOf("=");
  await context.addCookies([
    {
      name: fixture.cookie.slice(0, delimiter),
      value: fixture.cookie.slice(delimiter + 1),
      domain: "127.0.0.1",
      path: "/",
      httpOnly: true,
      secure: fixture.cookie.startsWith("__Secure-"),
      sameSite: "Lax",
    },
  ]);
  return fixture;
}
export async function capture(page: Page, name: string) {
  await ready(page);
  await expect(page).toHaveScreenshot(`${name}.png`);
}
export async function referenceComparison(
  page: Page,
  reference: Page,
  name: string,
  testInfo: TestInfo,
) {
  await ready(reference);
  await expect(reference).toHaveScreenshot(`reference-${name}.png`);
  const actual = PNG.sync.read(
    await page.screenshot({ animations: "disabled" }),
  );
  const expected = PNG.sync.read(
    await reference.screenshot({ animations: "disabled" }),
  );
  expect(actual.width).toBe(expected.width);
  expect(actual.height).toBe(expected.height);
  const difference = new PNG({ width: actual.width, height: actual.height });
  const pixels = pixelmatch(
    actual.data,
    expected.data,
    difference.data,
    actual.width,
    actual.height,
    { threshold: 0.1 },
  );
  const path = testInfo.outputPath(`design-diff-${name}.png`);
  await writeFile(path, PNG.sync.write(difference));
  await testInfo.attach(`design-diff-${name}`, {
    path,
    contentType: "image/png",
  });
  await writeFile(
    testInfo.outputPath(`design-metrics-${name}.json`),
    JSON.stringify({ pixels, ratio: pixels / (actual.width * actual.height) }),
  );
  await testInfo.attach(`design-metrics-${name}`, {
    body: JSON.stringify({
      pixels,
      ratio: pixels / (actual.width * actual.height),
    }),
    contentType: "application/json",
  });
  // These artifacts measure fidelity. A passing regression baseline alone is
  // deliberately not presented as proof that the reference design is matched.
}
