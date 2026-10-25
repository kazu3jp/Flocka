import {
  expect,
  type Page,
  type BrowserContext,
  type TestInfo,
  type Locator,
} from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";

type LayoutDimension = "x" | "y" | "width" | "height";

/**
 * `skip` leaves out a dimension that an intentional, documented deviation
 * changes (docs/flocka-v2-screen-spec.md section 10); the rest stay exact.
 */
export async function compareLayout(
  pairs: {
    name: string;
    actual: Locator;
    reference: Locator;
    skip?: LayoutDimension[];
  }[],
  testInfo: TestInfo,
) {
  const measurements = await Promise.all(
    pairs.map(async (pair) => ({
      name: pair.name,
      skip: pair.skip ?? [],
      actual: await pair.actual.boundingBox(),
      reference: await pair.reference.boundingBox(),
    })),
  );
  await testInfo.attach("source-layout", {
    body: JSON.stringify(measurements, null, 2),
    contentType: "application/json",
  });
  await writeFile(
    testInfo.outputPath("source-layout.json"),
    JSON.stringify(measurements, null, 2),
  );
  for (const measurement of measurements) {
    expect(measurement.actual, measurement.name).not.toBeNull();
    expect(measurement.reference, measurement.name).not.toBeNull();
    for (const dimension of ["x", "y", "width", "height"] as const) {
      if (measurement.skip.includes(dimension)) continue;
      expect(
        Math.abs(
          measurement.actual![dimension] - measurement.reference![dimension],
        ),
        `${measurement.name}: ${dimension}`,
      ).toBeLessThanOrEqual(1);
    }
  }
}

export async function ready(page: Page) {
  await page.evaluate(() => document.fonts.ready);
  await expect(
    page.getByText("デッキを読み込み中…", { exact: true }),
  ).toHaveCount(0);
  await page.mouse.move(-1, -1);
}
/**
 * Starts the browser as a device that already showed the first-launch
 * tutorial. The same key as apps/mobile/src/features/guided-tour/tour-steps.ts.
 */
export async function markTourSeen(context: BrowserContext) {
  await context.addInitScript(() => {
    try {
      localStorage.setItem("flocka-expo-tutorial-v1", "1");
    } catch {
      // Storage can be unavailable; the spec would then see the tour.
    }
  });
}
export async function signInFixture(
  context: BrowserContext,
  scenario: "onboarding" | "empty" | "collected",
  instance = "",
  /**
   * Other specs are about other screens, so the guided tour starts out seen.
   * Pass "unseen" to start on a fresh install.
   */
  tutorial: "seen" | "unseen" = "seen",
) {
  if (tutorial === "seen") await markTourSeen(context);
  const response = await context.request.post(
    `/__vrt/fixture?scenario=${scenario}&instance=${encodeURIComponent(instance)}`,
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
