import { test, expect } from "./test";
import { markTourSeen, ready, signInFixture } from "./helpers";
import { emulateFontScale } from "./font-scale";
import type { BrowserContext, Page } from "@playwright/test";

/**
 * Small phones: 320-360pt wide, with the system font enlarged. Every case
 * asserts geometry (nothing scrolls sideways, no text is cut off, the player
 * name stays within two lines, the card fan stays between its neighbours), not
 * only a screenshot. `font-scale.ts` explains how Android's font scale is
 * reproduced in the browser.
 */
const SIZES = [
  { width: 320, height: 568 },
  { width: 340, height: 640 },
  { width: 360, height: 640 },
  // The size of the phone in the bug report (720x1496 px at 2x).
  { width: 360, height: 748 },
];
const FONT_SCALES = [1, 1.3];
const LONGEST_NAME = "あいうえおかきくけこさしすせそた";

type Size = (typeof SIZES)[number];

async function expectFitsScreen(page: Page, label: string) {
  const problems = await page.evaluate(() => {
    const found: string[] = [];
    const root = document.documentElement;
    if (root.scrollWidth > window.innerWidth + 1)
      found.push(
        `page scrolls sideways: ${root.scrollWidth} > ${window.innerWidth}`,
      );
    const visible = (element: Element) => {
      for (
        let node: Element | null = element;
        node;
        node = node.parentElement
      ) {
        const style = getComputedStyle(node);
        if (style.display === "none" || style.visibility === "hidden")
          return false;
      }
      return true;
    };
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
    );
    for (let text = walker.nextNode(); text; text = walker.nextNode()) {
      const content = text.textContent?.trim();
      const owner = text.parentElement;
      if (!content || !owner || !visible(owner)) continue;
      const range = document.createRange();
      range.selectNodeContents(text);
      const box = range.getBoundingClientRect();
      if (box.width === 0 || box.height === 0) continue;
      const name = `"${content.slice(0, 24)}"`;
      if (box.left < -0.5 || box.right > window.innerWidth + 0.5)
        found.push(`${name} leaves the screen sideways`);
      // Text must lie inside every ancestor that clips its children (the
      // line box, not the glyph box: display fonts have tall ascenders).
      // Rotated cards (the fan) and what a scroller can reach are not "cut off".
      let reachableByScrolling = false;
      let rotated = false;
      for (let node: Element | null = owner; node; node = node.parentElement) {
        const transform = getComputedStyle(node).transform;
        if (transform.startsWith("matrix(")) {
          const [, b] = transform.slice(7, -1).split(",").map(Number);
          if (Math.abs(b) > 0.001) rotated = true;
        }
      }
      if (rotated) continue;
      for (let node: Element | null = owner; node; node = node.parentElement) {
        const style = getComputedStyle(node);
        const clips = [style.overflowX, style.overflowY].some(
          (value) => value !== "visible",
        );
        if (!clips || node === document.documentElement) continue;
        const parent = node.getBoundingClientRect();
        const line = owner.getBoundingClientRect();
        const scrolls =
          style.overflowY === "auto" || style.overflowY === "scroll";
        const horizontal =
          box.left < parent.left - 1 || box.right > parent.right + 1;
        if (scrolls) reachableByScrolling = true;
        const vertical =
          !reachableByScrolling &&
          (line.top < parent.top - 1 || line.bottom > parent.bottom + 1);
        if (horizontal || vertical) {
          found.push(
            `${name} is cut off by its container (${horizontal ? "sideways" : "vertically"}: text ${Math.round(box.left)}-${Math.round(box.right)}/${Math.round(line.top)}-${Math.round(line.bottom)}, container ${Math.round(parent.left)}-${Math.round(parent.right)}/${Math.round(parent.top)}-${Math.round(parent.bottom)}, overflow ${style.overflowX}/${style.overflowY})`,
          );
          break;
        }
      }
    }
    return found;
  });
  expect(problems, label).toEqual([]);
}

async function boxOf(page: Page, testId: string) {
  const box = await page.getByTestId(testId).boundingBox();
  expect(box, testId).not.toBeNull();
  return box!;
}

/**
 * The strengths shown on a player card, fanned out or listed by name, lie
 * between the 強み label and the footer, inside the card, and never cover the
 * tagline. A card too short to show them shows nothing, as in the design.
 */
async function expectFanClear(page: Page) {
  const card = await boxOf(page, "player-card");
  const role = await boxOf(page, "player-role");
  const footer = await boxOf(page, "player-footer");
  expect(role.y + role.height).toBeLessThanOrEqual(footer.y + 1);
  const hand = page.getByTestId("player-hand");
  if (!(await hand.count())) return;
  const label = await boxOf(page, "player-strength-label");
  const shown = await hand.locator("> *").evaluateAll((nodes) =>
    nodes.map((node) => {
      const box = node.getBoundingClientRect();
      return {
        top: box.top,
        bottom: box.bottom,
        left: box.left,
        right: box.right,
      };
    }),
  );
  expect(shown.length).toBeGreaterThan(0);
  for (const item of shown) {
    expect(item.top, "strengths below 強み label").toBeGreaterThanOrEqual(
      label.y + label.height - 1,
    );
    expect(item.bottom, "strengths above footer").toBeLessThanOrEqual(
      footer.y + 1,
    );
    expect(item.left).toBeGreaterThanOrEqual(card.x - 1);
    expect(item.right).toBeLessThanOrEqual(card.x + card.width + 1);
  }
}

async function lineHeightOf(page: Page, testId: string) {
  return page
    .getByTestId(testId)
    .evaluate((element) =>
      Number.parseFloat(getComputedStyle(element).lineHeight),
    );
}

async function setPlayerName(context: BrowserContext, name: string) {
  const current = await (await context.request.get("/v1/me")).json();
  const response = await context.request.patch("/v1/me", {
    data: { profile: { ...current.profile, name }, self: current.self },
  });
  expect(response.ok()).toBeTruthy();
}

async function openApp(
  context: BrowserContext,
  page: Page,
  size: Size,
  scale: number,
  instance = "default",
) {
  await page.setViewportSize(size);
  await emulateFontScale(context, scale);
  return signInFixture(
    context,
    "collected",
    `small-${size.width}x${size.height}-${String(scale).replace(".", "p")}-${instance}`,
  );
}

test.describe("small screens", () => {
  for (const size of SIZES)
    for (const scale of FONT_SCALES) {
      const when = `${size.width}x${size.height} font x${scale}`;

      test(`exchange tab: a long name stays inside the card on at most two lines (${when})`, async ({
        page,
        context,
      }) => {
        await openApp(context, page, size, scale, "long-name");
        await setPlayerName(context, LONGEST_NAME);
        await page.goto("/exchange");
        await expect(page.getByTestId("player-name")).toHaveText(LONGEST_NAME);
        await ready(page);
        const name = await boxOf(page, "player-name");
        const card = await boxOf(page, "player-card");
        const lineHeight = await lineHeightOf(page, "player-name");
        expect(name.height, "name lines").toBeLessThanOrEqual(
          lineHeight * 2 + 1,
        );
        expect(name.x + name.width).toBeLessThanOrEqual(card.x + card.width);
        await expectFanClear(page);
        await expectFitsScreen(page, `exchange ${when}`);
      });

      test(`exchange tab: a short name stays on one line (${when})`, async ({
        page,
        context,
      }) => {
        await openApp(context, page, size, scale);
        await page.goto("/exchange");
        await expect(page.getByTestId("player-name")).toHaveText("ハルカ");
        await ready(page);
        const name = await boxOf(page, "player-name");
        const lineHeight = await lineHeightOf(page, "player-name");
        expect(name.height, "ハルカ lines").toBeLessThanOrEqual(lineHeight + 1);
      });

      test(`deck: the banner text stays within the banner (${when})`, async ({
        page,
        context,
      }) => {
        await openApp(context, page, size, scale);
        await page.goto("/deck");
        await ready(page);
        const banner = page.getByTestId("deck-challenge");
        await expect(banner).toBeVisible();
        const frame = (await banner.boundingBox())!;
        const texts = await banner.locator("*").evaluateAll((nodes) =>
          nodes
            .filter((node) => node.children.length === 0 && node.textContent)
            .map((node) => {
              const box = node.getBoundingClientRect();
              return { right: box.right, bottom: box.bottom };
            }),
        );
        expect(texts.length).toBeGreaterThan(0);
        for (const text of texts) {
          expect(text.right).toBeLessThanOrEqual(frame.x + frame.width);
          expect(text.bottom).toBeLessThanOrEqual(frame.y + frame.height);
        }
        await expectFitsScreen(page, `deck ${when}`);
      });

      test(`confirm: the card fan stays below the tagline and above the footer (${when})`, async ({
        page,
        context,
      }) => {
        const fixture = await openApp(context, page, size, scale);
        await page.goto(`/confirm?cid=${fixture.exchanges![0]}`);
        await expect(page.getByTestId("player-name")).toHaveText("ミナト");
        await ready(page);
        await expectFanClear(page);
        await expectFitsScreen(page, `confirm ${when}`);
      });

      test(`main screens fit without sideways scrolling or cut-off text (${when})`, async ({
        page,
        context,
      }) => {
        await openApp(context, page, size, scale);
        for (const path of [
          "/deck",
          "/exchange",
          "/connections",
          "/nearby",
          "/pr",
          "/me",
          "/selfEdit",
          "/settings",
          "/sns",
          "/collection",
        ]) {
          await page.goto(path);
          await ready(page);
          await expectFitsScreen(page, `${path} ${when}`);
        }
      });
    }

  for (const size of SIZES.slice(0, 2))
    for (const scale of FONT_SCALES)
      test(`sign-in screens ${size.width}x${size.height} font x${scale}`, async ({
        page,
        context,
      }) => {
        await page.setViewportSize(size);
        await emulateFontScale(context, scale);
        await markTourSeen(context);
        await page.goto("/auth");
        await ready(page);
        await expectFitsScreen(page, "auth");
        await page
          .getByRole("button", { name: "アカウントをお持ちの方はログイン" })
          .click();
        await expectFitsScreen(page, "login");
      });
});
