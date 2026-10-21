import { test, expect } from "./test";
import {
  capture,
  compareLayout,
  referenceComparison,
  signInFixture,
} from "./helpers";

test("connection rows, sent details and removal preserve source layout and real server state", async ({
  page,
  context,
}, testInfo) => {
  const fixture = await signInFixture(
    context,
    "collected",
    `connections-${testInfo.project.name}`,
  );
  await page.goto("/connections");
  const reference = await context.newPage();
  await reference.goto("/reference/?embed=exchange");
  await reference.locator('[data-od-id="exchange-give-entry"]').click();
  const snapshot = async (name: string) => {
    await capture(page, name);
    await referenceComparison(page, reference, name, testInfo);
  };
  await snapshot("connections-source");
  await compareLayout(
    [
      {
        name: "connection list",
        actual: page.getByTestId("connections-list"),
        reference: reference.locator(".list"),
        // The status filter row is an intentional addition above the list.
        skip: ["y"],
      },
      {
        name: "filter row starts where the source list starts",
        actual: page.getByTestId("connections-filter"),
        reference: reference.locator(".list"),
        skip: ["width", "height"],
      },
    ],
    testInfo,
  );
  const id = fixture.exchanges![0];
  const row = page.getByTestId(`connection-${id}`);
  const originalRow = reference
    .locator(".list-row")
    .filter({ hasText: "ミナト" });
  await row
    .getByRole("button", { name: "ミナトとの交換を解除", exact: true })
    .click();
  await originalRow
    .getByRole("button", { name: "ミナトとの交換を解除", exact: true })
    .click();
  await snapshot("connections-unlink");
  await compareLayout(
    [
      {
        name: "removal sheet",
        actual: page.getByTestId("sheet"),
        reference: reference.locator(".sheet"),
      },
    ],
    testInfo,
  );
  await page.getByRole("button", { name: "やめる", exact: true }).click();
  await reference.getByRole("button", { name: "やめる", exact: true }).click();
  await row.getByRole("button", { name: "印象を贈る", exact: true }).click();
  await originalRow
    .getByRole("button", { name: "印象を贈る", exact: true })
    .click();
  const reason = "初対面から話しかけてくれて、一緒に発表の準備ができた";
  for (const surface of [page, reference]) {
    await surface
      .getByRole("radio", { name: "話しやすい", exact: true })
      .click();
    await surface.getByRole("textbox").fill(reason);
    await surface
      .getByRole("button", { name: "この印象を贈る", exact: true })
      .click();
  }
  await expect(
    page.getByText("最新データを取得中…", { exact: true }),
  ).toHaveCount(0);
  await page.getByTestId("toast").getByRole("button").click();
  await reference.locator(".toast-msg").click();
  await page.getByRole("button", { name: "戻る", exact: true }).click();
  await reference.getByRole("button", { name: "戻る", exact: true }).click();
  await expect(
    row.getByText("「話しやすい」を贈った", { exact: true }),
  ).toBeVisible();
  await snapshot("connections-sent");
  await row.getByRole("button", { name: "詳細", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/give\\?cid=${id}$`));
  await expect(page.getByText(`「${reason}」`, { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "戻る", exact: true }).click();
  const accepted = await (
    await context.request.get(`/v1/exchanges/${id}`)
  ).json();
  let mode: "network" | "invalid" | "real" = "network";
  let cancelRequests = 0;
  const cancelRoute = `**/v1/exchanges/${id}/cancel`;
  await page.route(cancelRoute, (route) => {
    cancelRequests++;
    if (mode === "network") return route.abort("failed");
    if (mode === "invalid")
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(accepted),
      });
    return route.continue();
  });
  await row
    .getByRole("button", { name: "ミナトとの交換を解除", exact: true })
    .click();
  const remove = page.getByRole("button", { name: "解除", exact: true });
  await remove.click();
  await expect(page.getByRole("alert")).toContainText("APIに接続できません");
  await expect(page.getByTestId("sheet")).toBeVisible();
  mode = "invalid";
  await remove.click();
  await expect(page.getByRole("alert")).toContainText(
    "APIの応答を読み込めませんでした",
  );
  expect(
    (await (await context.request.get(`/v1/exchanges/${id}`)).json()).status,
  ).toBe("accepted");
  mode = "real";
  await page.route("**/v1/sync?*", (route) => route.abort("failed"));
  await remove.click();
  await expect(page.getByRole("alert")).toContainText(
    "解除は完了しました。最新データの取得に失敗しました。",
  );
  await expect(remove).toHaveCount(0);
  const retryButton = page.getByRole("button", {
    name: "最新データを再取得",
    exact: true,
  });
  const buttonBounds = await retryButton.boundingBox();
  const labelBounds = await retryButton
    .getByText("最新データを再取得", { exact: true })
    .boundingBox();
  expect(buttonBounds).not.toBeNull();
  expect(labelBounds).not.toBeNull();
  expect(labelBounds!.x).toBeGreaterThanOrEqual(buttonBounds!.x + 2);
  expect(labelBounds!.x + labelBounds!.width).toBeLessThanOrEqual(
    buttonBounds!.x + buttonBounds!.width - 2,
  );

  expect(
    (await (await context.request.get(`/v1/exchanges/${id}`)).json()).status,
  ).toBe("cancelled");
  // Exercise enlarged text without disabling font scaling or truncating the label.
  await retryButton
    .getByText("最新データを再取得", { exact: true })
    .evaluate((element) => {
      element.style.fontSize = "25.5px";
      element.style.lineHeight = "38.25px";
    });
  const enlargedButton = await retryButton.boundingBox();
  const enlargedLabel = await retryButton
    .getByText("最新データを再取得", { exact: true })
    .boundingBox();
  expect(enlargedButton).not.toBeNull();
  expect(enlargedLabel).not.toBeNull();
  expect(enlargedLabel!.x).toBeGreaterThanOrEqual(enlargedButton!.x + 2);
  expect(enlargedLabel!.x + enlargedLabel!.width).toBeLessThanOrEqual(
    enlargedButton!.x + enlargedButton!.width - 2,
  );
  expect(enlargedLabel!.y + enlargedLabel!.height).toBeLessThanOrEqual(
    enlargedButton!.y + enlargedButton!.height - 2,
  );
  expect(cancelRequests).toBe(3);
  await page.unroute("**/v1/sync?*");
  await page
    .getByRole("button", { name: "最新データを再取得", exact: true })
    .click();
  await expect(page.getByTestId("sheet")).toHaveCount(0);
  await expect(row).toHaveCount(0);
  expect(cancelRequests).toBe(3);
  await originalRow
    .getByRole("button", { name: "ミナトとの交換を解除", exact: true })
    .click();
  await reference.getByRole("button", { name: "解除", exact: true }).click();
  await page.getByTestId("toast").getByRole("button").click();
  await reference.locator(".toast-msg").click();
  await snapshot("connections-after-unlink");
  for (const remainingId of fixture.exchanges!.slice(1)) {
    const result = await context.request.post(
      `/v1/exchanges/${remainingId}/cancel`,
    );
    expect(result.ok()).toBeTruthy();
  }
  for (const name of ["ソラ", "カエデ"]) {
    await reference
      .getByRole("button", { name: `${name}との交換を解除`, exact: true })
      .click();
    await reference.getByRole("button", { name: "解除", exact: true }).click();
    await reference.locator(".toast-msg").click();
  }
  await page.reload();
  await snapshot("connections-empty");
  await expect(
    page.getByRole("button", { name: "見た場面をメモで贈る", exact: true }),
  ).toHaveCount(0);
  const stored = await (await context.request.get("/v1/sync")).json();
  expect(stored.sent).toHaveLength(1);
  expect(stored.sent[0].text).toBe(reason);
  expect(
    stored.inbox.some((piece: { id: string }) => piece.id === fixture.pieceId),
  ).toBe(true);
});

test("a pending connection offers confirmation and can be removed without enabling memo delivery", async ({
  page,
  context,
  browser,
  baseURL,
}, testInfo) => {
  await signInFixture(
    context,
    "empty",
    `pending-owner-${testInfo.project.name}`,
  );
  const peer = await browser.newContext({ baseURL, ignoreHTTPSErrors: true });
  try {
    await signInFixture(peer, "empty", `pending-peer-${testInfo.project.name}`);
    const invitation = await (await peer.request.post("/v1/invites")).json();
    const started = await context.request.post("/v1/exchanges", {
      data: { code: invitation.code },
    });
    expect(started.ok()).toBeTruthy();
    const exchange = await started.json();
    await page.goto("/connections");
    const row = page.getByTestId(`connection-${exchange.id}`);
    await expect(row.getByText("承認待ち", { exact: true })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "見た場面をメモで贈る", exact: true }),
    ).toHaveCount(0);
    await capture(page, "connections-pending");
    await row.getByRole("button", { name: "確認", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/confirm\\?cid=${exchange.id}$`));
    await page.getByRole("button", { name: "戻る", exact: true }).click();
    await row
      .getByRole("button", { name: "ハルカとの交換を解除", exact: true })
      .click();
    await page.getByRole("button", { name: "解除", exact: true }).click();
    await expect(row).toHaveCount(0);
    expect(
      (await (await context.request.get(`/v1/exchanges/${exchange.id}`)).json())
        .status,
    ).toBe("cancelled");
  } finally {
    await peer.close();
  }
});
