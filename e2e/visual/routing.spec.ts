import { test, expect } from "./test";
import { signInFixture } from "./helpers";

test("requested card URL survives initial loading and a failed snapshot retry", async ({
  page,
  context,
}) => {
  await signInFixture(context, "collected");
  await page.goto("/card?key=bridge");
  const decorationButton = page.getByRole("button", {
    name: "このカードをデコる",
    exact: true,
  });
  await expect(decorationButton).toBeVisible();
  expect(new URL(page.url()).pathname).toBe("/card");
  // Fail transport only. Never replace the actual API with a successful fixture response.
  const snapshotRoute = "**/v1/sync*";
  await page.route(snapshotRoute, (route) => route.abort("failed"));
  await page.reload();
  const retry = page.getByRole("button", {
    name: "もう一度読み込む",
    exact: true,
  });
  await expect(retry).toBeVisible();
  expect(new URL(page.url()).pathname).toBe("/card");
  expect(new URL(page.url()).searchParams.get("key")).toBe("bridge");
  await page.unroute(snapshotRoute);
  await retry.click();
  await expect(decorationButton).toBeVisible();
  expect(new URL(page.url()).pathname).toBe("/card");
});

test("direct routes reconcile selected tabs and nested back navigation", async ({
  page,
  context,
}) => {
  await signInFixture(context, "collected");
  await page.goto("/pr");
  await expect(
    page.getByRole("tab", { name: "自己PR", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await page.goto("/exchange");
  await expect(
    page.getByRole("tab", { name: "交換", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await page.getByRole("button", { name: "つながった人", exact: true }).click();
  await page.getByRole("button", { name: "戻る", exact: true }).click();
  await expect(page).toHaveURL(/\/exchange$/);
  await page.goto("/card?key=bridge");
  await page
    .getByRole("button", { name: "このカードをデコる", exact: true })
    .click();
  await page.getByRole("button", { name: "戻る", exact: true }).click();
  await expect(page).toHaveURL(/\/card\?key=bridge$/);
  await page.getByRole("button", { name: "戻る", exact: true }).click();
  await expect(page).toHaveURL(/\/deck$/);
});

test("a direct unopened testimony URL keeps its contents behind the guess challenge", async ({
  page,
  context,
}, testInfo) => {
  const fixture = await signInFixture(
    context,
    "collected",
    `unopened-route-${testInfo.project.name}`,
  );
  const snapshot = await (await context.request.get("/v1/sync")).json();
  const piece = snapshot.inbox.find(
    (entry: { id: string }) => entry.id === fixture.unopenedId,
  );
  expect(piece.opened).toBe(false);
  const url = `/piece?id=${encodeURIComponent(fixture.unopenedId!)}`;
  await page.goto(url);
  await expect(page).toHaveURL(/\/pieces$/);
  await expect(page.getByText("予想チャレンジ", { exact: true })).toBeVisible();
  await expect(
    page.getByText(`「${piece.text}」`, { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "非公開", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "あとで開ける", exact: true }).click();
  await expect(page.getByText("予想チャレンジ", { exact: true })).toHaveCount(
    0,
  );
  await expect(page.getByText("届いた証言", { exact: true })).toBeVisible();
  const cancelled = await (await context.request.get("/v1/sync")).json();
  expect(
    cancelled.inbox.find((entry: { id: string }) => entry.id === piece.id)
      .opened,
  ).toBe(false);
  await page.reload();
  await expect(page.getByText("予想チャレンジ", { exact: true })).toHaveCount(
    0,
  );
  await page.goto(url);
  const openingRoute = `**/v1/testimonies/${piece.id}`;
  await page.route(openingRoute, (route) => route.abort("failed"));
  await page
    .getByRole("button", { name: "予想せずに開ける", exact: true })
    .click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(
    page.getByText(`「${piece.text}」`, { exact: true }),
  ).toHaveCount(0);
  const failed = await (await context.request.get("/v1/sync")).json();
  expect(
    failed.inbox.find((entry: { id: string }) => entry.id === piece.id).opened,
  ).toBe(false);
  await page.unroute(openingRoute);
  await page
    .getByRole("button", { name: "予想せずに開ける", exact: true })
    .click();
  await expect(
    page.getByText(`「${piece.text}」`, { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "デッキに加える", exact: true })
    .click();
  await page.goto(url);
  await expect(
    page.getByRole("button", { name: "非公開", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(`「${piece.text}」`, { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("予想チャレンジ", { exact: true })).toHaveCount(
    0,
  );
});
