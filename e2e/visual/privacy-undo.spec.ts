import { test, expect } from "./test";
import { signInFixture } from "./helpers";

test("visibility undo restores its revision and reads newer changes without replaying a conflict", async ({
  page,
  context,
}, testInfo) => {
  const fixture = await signInFixture(
    context,
    "collected",
    `visibility-undo-${testInfo.project.name}`,
  );
  await page.goto(`/piece?id=${fixture.pieceId}`);
  const publish = async () => {
    await page.getByRole("button", { name: "個別公開", exact: true }).click();
    await page
      .getByRole("button", { name: "個別公開する", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "個別公開", exact: true }),
    ).toBeEnabled();
    await expect(page.getByRole("status")).toContainText(
      "公開範囲を変更しました",
    );
  };
  await publish();
  await page.getByRole("button", { name: "取り消す", exact: true }).click();
  await expect(page.getByRole("status")).toContainText(
    "公開範囲を元に戻しました",
  );
  const restored = await (await context.request.get("/v1/sync")).json();
  expect(
    restored.inbox.find((piece: { id: string }) => piece.id === fixture.pieceId)
      .visibility,
  ).toBe("private");
  await publish();
  const snapshot = await (await context.request.get("/v1/sync")).json();
  const piece = snapshot.inbox.find(
    (entry: { id: string }) => entry.id === fixture.pieceId,
  );
  const changed = await context.request.patch(`/v1/testimonies/${piece.id}`, {
    data: {
      visibility: "hidden",
      expectedVisibilityRevision: piece.visibilityRevision,
    },
  });
  expect(changed.ok()).toBe(true);
  let undoRequests = 0;
  page.on("request", (request) => {
    if (
      request.method() === "PATCH" &&
      new URL(request.url()).pathname === `/v1/testimonies/${piece.id}`
    )
      undoRequests++;
  });
  const syncRoute = "**/v1/sync*";
  await page.route(syncRoute, (route) => route.abort("failed"));
  await page.getByRole("button", { name: "取り消す", exact: true }).click();
  await expect(page.getByRole("status")).toContainText(
    "別の変更があったため取り消しませんでした",
  );
  await expect(
    page.getByRole("button", { name: "再読込", exact: true }),
  ).toBeVisible();
  await page.unroute(syncRoute);
  await page.getByRole("button", { name: "再読込", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText(
    "別の変更があったため取り消しませんでした",
  );
  const final = await (await context.request.get("/v1/sync")).json();
  expect(
    final.inbox.find((entry: { id: string }) => entry.id === piece.id)
      .visibility,
  ).toBe("hidden");
  expect(undoRequests).toBe(1);
});

test("block undo survives navigation and cannot remove a replacement block", async ({
  page,
  context,
}, testInfo) => {
  const fixture = await signInFixture(
    context,
    "collected",
    `block-undo-${testInfo.project.name}`,
  );
  const snapshot = await (await context.request.get("/v1/sync")).json();
  const peer = snapshot.inbox.find(
    (piece: { id: string }) => piece.id === fixture.pieceId,
  ).fromId;
  const block = async () => {
    await page.goto(`/piece?id=${fixture.pieceId}`);
    await page
      .getByRole("button", { name: "この人をブロック", exact: true })
      .click();
    await page
      .getByRole("button", { name: "ブロックする", exact: true })
      .click();
    await expect(page).toHaveURL(/\/deck$/);
    await expect(page.getByRole("status")).toContainText("ブロックしました");
  };
  await block();
  await page.getByRole("button", { name: "取り消す", exact: true }).click();
  await expect(page.getByRole("status")).toContainText(
    "ブロックを取り消しました",
  );
  expect(
    (await (await context.request.get("/v1/sync")).json()).blocked,
  ).not.toContain(peer);
  await block();
  expect((await context.request.delete(`/v1/blocks/${peer}`)).ok()).toBe(true);
  expect(
    (
      await context.request.post("/v1/blocks", { data: { playerId: peer } })
    ).ok(),
  ).toBe(true);
  await page.getByRole("button", { name: "取り消す", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText(
    "別の変更があったため取り消しませんでした",
  );
  expect(
    (await (await context.request.get("/v1/sync")).json()).blocked,
  ).toContain(peer);
});
