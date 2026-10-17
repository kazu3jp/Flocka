import { test, expect } from "./test";
import { capture, signInFixture } from "./helpers";

test("accepted exchange displays the real peer and public testimony", async ({
  page,
  context,
}, testInfo) => {
  const fixture = await signInFixture(
    context,
    "collected",
    `peer-${testInfo.project.name}`,
  );
  await page.goto(`/confirm?cid=${fixture.exchanges![0]}`);
  await expect(page.getByTestId("player-name")).toHaveText("ミナト");
  await expect(page.getByTestId("player-role")).toHaveText(
    "UIデザインを勉強中",
  );
  await page
    .getByRole("button", { name: "公開された証言を見る", exact: true })
    .click();
  await expect(
    page.getByText("公開された証言はありません。", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "閉じる", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "印象を贈る", exact: true }),
  ).toBeVisible();
  await capture(page, "exchange-peer");
});
