import { test, expect } from "./test";
import { ready } from "./helpers";

test("tour animations reveal evidence in order and stop when reduced motion is enabled", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  const frozenTime = new Date("2026-10-18T00:00:00Z");
  await page.clock.install({ time: frozenTime });
  await page.goto("/auth");
  await ready(page);
  const now = await page.evaluate(() => Date.now());
  await page.clock.pauseAt(new Date(now + 1000));
  await page
    .getByRole("button", {
      name: "1枚目：会った人と、カードを交換",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", { name: "2枚目：届いた封筒の中身を予想", exact: true })
    .click();
  const option = page.getByTestId("tour-option-0");
  await expect(option).toHaveCSS("opacity", "0");
  await page.clock.runFor(1100);
  await expect(option).toHaveCSS("opacity", "1");
  const initial = await page
    .getByTestId("tour-envelope")
    .evaluate((element) => getComputedStyle(element).transform);
  await page.clock.runFor(500);
  const bobbed = await page
    .getByTestId("tour-envelope")
    .evaluate((element) => getComputedStyle(element).transform);
  expect(bobbed).not.toBe(initial);
  // Manual selection pauses automatic advancement, while element animation continues.
  await page.clock.runFor(2400);
  await expect(
    page.getByRole("button", {
      name: "2枚目：届いた封筒の中身を予想",
      exact: true,
    }),
  ).toHaveAttribute("aria-current", "true");
  await page
    .getByRole("button", {
      name: "3枚目：2人の証言で、確認済みに",
      exact: true,
    })
    .click();
  const document = page.getByTestId("tour-document");
  await expect(document).toHaveCSS("opacity", "0");
  await page.clock.runFor(850);
  await expect(document).toHaveCSS("opacity", "0");
  await page.clock.runFor(600);
  await expect(document).toHaveCSS("opacity", "1");
  const lastLine = page.getByTestId("tour-line-3");
  await expect(lastLine).toHaveCSS("transform", "matrix(0, 0, 0, 1, 0, 0)");
  await page.clock.runFor(1400);
  await expect(lastLine).toHaveCSS("transform", "matrix(1, 0, 0, 1, 0, 0)");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page
    .getByRole("button", {
      name: "1枚目：会った人と、カードを交換",
      exact: true,
    })
    .click();
  await expect(page.getByTestId("tour-swap")).toBeVisible();
  await page.clock.runFor(4000);
  await expect(
    page.getByRole("button", {
      name: "1枚目：会った人と、カードを交換",
      exact: true,
    }),
  ).toHaveAttribute("aria-current", "true");
  await page
    .getByRole("button", {
      name: "3枚目：2人の証言で、確認済みに",
      exact: true,
    })
    .click();
  await expect(document).toHaveCSS("opacity", "1");
  await expect(lastLine).toHaveCSS("transform", "matrix(1, 0, 0, 1, 0, 0)");
});

test("welcome automatically advances after the original 3.6 second interval", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/auth");
  await ready(page);
  await expect(
    page.getByRole("button", {
      name: "1枚目：会った人と、カードを交換",
      exact: true,
    }),
  ).toHaveAttribute("aria-current", "true");
  await expect(
    page.getByRole("button", {
      name: "2枚目：届いた封筒の中身を予想",
      exact: true,
    }),
  ).toHaveAttribute("aria-current", "true", { timeout: 5000 });
});
