import { test, expect } from "./test";
import { PNG } from "pngjs";
import { capture, referenceComparison, compareLayout } from "./helpers";

test.beforeEach(async ({ page }) => {
  page.on("console", (message) => {
    if (message.type() === "error")
      console.error("Browser error:", message.text());
  });
  page.on("response", (response) => {
    if (response.status() >= 400)
      console.error(
        "HTTP error:",
        response.status(),
        new URL(response.url()).pathname,
      );
  });
  page.on("pageerror", (error) =>
    console.error("Application error:", error.message),
  );
  page.on("requestfailed", (request) =>
    console.error(
      "Request failed:",
      new URL(request.url()).pathname,
      request.failure()?.errorText,
    ),
  );
});

const scenes = [
  "会った人と、カードを交換",
  "届いた封筒の中身を予想",
  "2人の証言で、確認済みに",
];
for (const [index, title] of scenes.entries()) {
  test(`welcome scene ${index + 1}`, async ({ page, context }, testInfo) => {
    await page.goto("/auth");
    await page
      .getByRole("button", { name: `${index + 1}枚目：${title}`, exact: true })
      .click();
    await expect(
      page.getByRole("button", {
        name: `${index + 1}枚目：${title}`,
        exact: true,
      }),
    ).toHaveAttribute("aria-current", "true");
    await expect(page.getByText(title, { exact: true })).toBeVisible();
    await capture(page, `welcome-${index + 1}`);
    const reference = await context.newPage();
    await reference.goto("/reference/");
    await reference
      .getByRole("button", { name: `${index + 1}枚目：${title}`, exact: true })
      .click();
    await compareLayout(
      [
        {
          name: "stage",
          actual: page.getByRole("button", {
            name: "次の説明を見る",
            exact: true,
          }),
          reference: reference.locator(".tour-stage"),
        },
        ...(index === 1
          ? [
              {
                name: "envelope",
                actual: page.getByTestId("tour-envelope"),
                reference: reference.locator(".tour-env"),
              },
              {
                name: "seal",
                actual: page.getByTestId("tour-seal"),
                reference: reference.locator(".tour-seal"),
              },
            ]
          : []),
        ...(index === 2
          ? [
              {
                name: "confirmed",
                actual: page.getByTestId("tour-confirm"),
                reference: reference.locator(".tour-confirm"),
              },
              {
                name: "document",
                actual: page.getByTestId("tour-document"),
                reference: reference.locator(".tour-doc"),
              },
            ]
          : []),
      ],
      testInfo,
    );
    await referenceComparison(
      page,
      reference,
      `welcome-${index + 1}`,
      testInfo,
    );
  });
}
for (const view of ["signup", "login", "reset"] as const) {
  test(`${view} form`, async ({ page, context }, testInfo) => {
    await page.goto("/auth");
    const reference = await context.newPage();
    await reference.goto("/reference/");
    for (const target of [page, reference]) {
      if (view === "signup")
        await target
          .getByRole("button", { name: "アカウントを作成", exact: true })
          .click();
      else {
        await target
          .getByRole("button", { name: /アカウントをお持ちの方は/ })
          .click();
        if (view === "reset")
          await target
            .getByRole("button", { name: /パスワードを忘れた/ })
            .click();
      }
      await expect(
        target.getByText("メールアドレス", { exact: true }),
      ).toBeVisible();
    }
    // The app no longer offers Apple sign-in; the design reference still draws
    // that button, so take it out of the reference before comparing positions.
    await reference
      .locator('[data-od-id="auth-apple"]')
      .evaluateAll((nodes) =>
        nodes.forEach((node) => ((node as HTMLElement).style.display = "none")),
      );
    await compareLayout(
      [
        {
          name: "back",
          actual: page.getByRole("button", { name: "戻る", exact: true }),
          reference: reference.getByRole("button", {
            name: "戻る",
            exact: true,
          }),
        },
        ...Array.from({ length: view === "reset" ? 1 : 2 }, (_, index) => ({
          name: `input-${index + 1}`,
          actual: page.locator("input").nth(index),
          reference: reference.locator("input").nth(index),
        })),
      ],
      testInfo,
    );
    await capture(page, view);
    await referenceComparison(page, reference, view, testInfo);
  });
}

test("the Google button draws the official four-colour G at the old mark's size", async ({
  page,
}) => {
  await page.goto("/auth");
  await page
    .getByRole("button", { name: "アカウントを作成", exact: true })
    .click();
  const mark = page.getByTestId("google-mark");
  await expect(mark).toBeVisible();
  const box = await mark.boundingBox();
  expect(box?.width).toBe(20);
  expect(box?.height).toBe(20);
  const fills = await mark
    .locator("path")
    .evaluateAll((paths) => paths.map((path) => path.getAttribute("fill")));
  expect(fills.sort()).toEqual(["#34A853", "#4285F4", "#EA4335", "#FBBC05"]);
  // The rendered pixels show all four hues (the button may be dimmed when the
  // provider is not configured, so classify by hue instead of exact colour).
  const image = PNG.sync.read(await mark.screenshot());
  const hues = new Set<string>();
  for (let index = 0; index < image.data.length; index += 4) {
    const [r, g, b] = [
      image.data[index],
      image.data[index + 1],
      image.data[index + 2],
    ];
    if (Math.max(r, g, b) - Math.min(r, g, b) < 40) continue;
    hues.add(
      b > r && b > g
        ? "blue"
        : g > r && g > b
          ? "green"
          : g > 0.6 * r
            ? "yellow"
            : "red",
    );
  }
  expect([...hues].sort()).toEqual(["blue", "green", "red", "yellow"]);
});
