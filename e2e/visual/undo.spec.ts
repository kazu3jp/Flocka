import { test, expect } from "./test";
import { signInFixture } from "./helpers";

test("deletion undo retries failures and only repeats synchronization after an acknowledged withdrawal", async ({
  page,
  context,
}, testInfo) => {
  const fixture = await signInFixture(
    context,
    "collected",
    `undo-${testInfo.project.name}`,
  );
  await page.goto(`/piece?id=${fixture.pieceId}`);
  const requestDeletion = async () => {
    await page
      .getByRole("button", { name: "削除を依頼する", exact: true })
      .click();
    const synchronized = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === "/v1/sync" && response.ok(),
    );
    await page.getByRole("button", { name: "依頼する", exact: true }).click();
    await synchronized;
    await expect(
      page.getByRole("button", { name: "削除を依頼する", exact: true }),
    ).toBeEnabled();
    await expect(page.getByRole("status")).toContainText(
      "削除依頼を受け付けました",
    );
    const response = await context.request.get("/v1/sync");
    expect(response.ok(), await response.text()).toBeTruthy();
    const snapshot = await response.json();
    return snapshot.requests.find(
      (entry: { kind: string; withdrawn: boolean }) =>
        entry.kind === "deletion" && !entry.withdrawn,
    ).id as string;
  };
  const first = await requestDeletion();
  const withdrawal = `**/v1/moderation/${first}/withdraw`;
  await page.route(withdrawal, (route) => route.abort("failed"));
  await page.getByRole("button", { name: "取り消す", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("取り消せませんでした");
  const failed = await (await context.request.get("/v1/sync")).json();
  expect(
    failed.requests.find((entry: { id: string }) => entry.id === first)
      .withdrawn,
  ).toBe(false);
  await page.unroute(withdrawal);
  await page.getByRole("button", { name: "再試行", exact: true }).click();
  await expect(page.getByRole("status")).toContainText(
    "削除依頼を取り消しました",
  );
  const restored = await (await context.request.get("/v1/sync")).json();
  expect(
    restored.requests.find((entry: { id: string }) => entry.id === first)
      .withdrawn,
  ).toBe(true);

  const second = await requestDeletion();
  let withdrawalRequests = 0;
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === `/v1/moderation/${second}/withdraw`)
      withdrawalRequests++;
  });
  // The global action must survive leaving the screen that created the request.
  await page.getByRole("tab", { name: "交換", exact: true }).click();
  await expect(page).toHaveURL(/\/exchange$/);
  const syncRoute = "**/v1/sync*";
  await page.route(syncRoute, (route) => route.abort("failed"));
  await page.getByRole("button", { name: "取り消す", exact: true }).click();
  await expect(page.getByRole("status")).toContainText(
    "取り消しは保存済みです",
  );
  const saved = await (await context.request.get("/v1/sync")).json();
  expect(
    saved.requests.find((entry: { id: string }) => entry.id === second)
      .withdrawn,
  ).toBe(true);
  await page.unroute(syncRoute);
  await page.getByRole("button", { name: "再読込", exact: true }).click();
  await expect(page.getByRole("status")).toContainText(
    "削除依頼を取り消しました",
  );
  expect(withdrawalRequests).toBe(1);
});
