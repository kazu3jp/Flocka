import { test, expect } from "./test";
import { ready, signInFixture } from "./helpers";

test("prediction opens the original envelope, then reveals the card and stamps the result", async ({
  page,
  context,
}, testInfo) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  const fixture = await signInFixture(
    context,
    "collected",
    `envelope-motion-${testInfo.project.name}`,
  );
  await page.goto(`/piece?id=${fixture.unopenedId}`);
  await ready(page);
  await expect(page.getByTestId("guess-envelope-seal")).toBeVisible();
  await page.clock.install();
  const now = await page.evaluate(() => Date.now());
  await page.clock.pauseAt(new Date(now + 50));
  const flap = page.getByTestId("guess-envelope-flap");
  const closed = await flap.evaluate((el) => getComputedStyle(el).transform);
  await page.screenshot({ path: testInfo.outputPath("prediction.png") });
  await page.getByRole("button", { name: /^話しやすさ・/ }).click();
  // Saving and syncing are real API calls; the paused clock holds the visual reveal.
  await expect(
    page.getByRole("button", { name: "予想せずに開ける", exact: true }),
  ).toBeDisabled();
  const snapshot = async () =>
    (await (await context.request.get("/v1/sync")).json()).inbox.find(
      (piece: { id: string }) => piece.id === fixture.unopenedId,
    );
  await expect.poll(async () => (await snapshot()).opened).toBe(true);
  // Let React process the server sync before advancing Animated's clock.
  await expect(page.getByRole("progressbar")).toHaveCount(0);
  await page.clock.runFor(500);
  await expect(flap).not.toHaveCSS("transform", closed);
  await expect(page.getByTestId("guess-reveal-card")).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath("opening.png") });
  await page.clock.runFor(400);
  await expect(page.getByTestId("guess-reveal-card")).toBeAttached();
  await expect(page.getByTestId("guess-reveal-stamp")).toHaveCSS(
    "opacity",
    "0",
  );
  await page.clock.runFor(1300);
  await expect(page.getByTestId("guess-reveal-card")).toHaveCSS("opacity", "1");
  await expect(page.getByTestId("guess-reveal-stamp")).toHaveCSS(
    "opacity",
    "1",
  );
  await expect(page.getByText("的中！", { exact: true })).toBeVisible();
  expect((await snapshot()).guess).toBe("warm");
  await page.screenshot({ path: testInfo.outputPath("discovered.png") });
  await page
    .getByRole("button", { name: "デッキに加える", exact: true })
    .click();
  await expect(page.getByText("予想チャレンジ", { exact: true })).toHaveCount(
    0,
  );
});

test("failed opening reveals nothing and reduced motion skips the staged celebration", async ({
  page,
  context,
}, testInfo) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const fixture = await signInFixture(
    context,
    "collected",
    `envelope-reduced-${testInfo.project.name}`,
  );
  await page.goto(`/piece?id=${fixture.unopenedId}`);
  await ready(page);
  const endpoint = `**/v1/testimonies/${fixture.unopenedId}`;
  await page.route(endpoint, (route) => route.abort("failed"));
  await page
    .getByRole("button", { name: "予想せずに開ける", exact: true })
    .click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.getByTestId("guess-envelope-seal")).toHaveCSS(
    "opacity",
    "1",
  );
  await expect(page.getByTestId("guess-reveal-note")).toHaveCount(0);
  await page.unroute(endpoint);
  await page
    .getByRole("button", { name: "予想せずに開ける", exact: true })
    .click();
  await expect(page.getByTestId("guess-reveal-card")).toBeAttached();
  await expect(page.getByTestId("guess-reveal-card")).toHaveCSS(
    "opacity",
    "1",
    { timeout: 250 },
  );
  await expect(page.getByTestId("guess-reveal-stamp")).toHaveCSS(
    "opacity",
    "1",
    { timeout: 250 },
  );
  await expect(page.getByText("開封！", { exact: true })).toBeVisible();
});

test("switching reduced motion on during opening finishes without a stranded envelope", async ({
  page,
  context,
}, testInfo) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  const fixture = await signInFixture(
    context,
    "collected",
    `envelope-toggle-${testInfo.project.name}`,
  );
  await page.goto(`/piece?id=${fixture.unopenedId}`);
  await ready(page);
  await page
    .getByRole("button", { name: "予想せずに開ける", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "予想せずに開ける", exact: true }),
  ).toBeDisabled();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.getByTestId("guess-reveal-card")).toHaveCSS("opacity", "1");
  await expect(
    page.getByRole("button", { name: "デッキに加える", exact: true }),
  ).toBeEnabled();
});
