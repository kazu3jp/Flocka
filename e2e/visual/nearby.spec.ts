import { test, expect } from "./test";
import { signInFixture } from "./helpers";

// The web build has no Bluetooth, so this checks the unsupported card. The
// searching, found, paused and blocked states are covered by
// tests/nearby-status.test.ts because only a device can scan.
for (const motion of ["reduce", "no-preference"] as const) {
  test(`web shows an unsupported card without layout shift (${motion} motion)`, async ({
    page,
    context,
  }) => {
    await page.emulateMedia({ reducedMotion: motion });
    await signInFixture(context, "empty", `nearby-${motion}`);
    await page.goto("/nearby");
    const status = page.getByTestId("nearby-status");
    const card = page.getByTestId("nearby-unavailable");
    await expect(card).toBeVisible();
    await expect(
      card.getByText("近距離交換はiOS・Androidアプリで利用できます。", {
        exact: true,
      }),
    ).toBeVisible();
    await expect(status).toContainText("ここでは近くの人を探せません");
    // Not scanning, so no claim that it is searching and no retry button.
    await expect(page.getByText("近くの人を探しています…")).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "探索をやり直す", exact: true }),
    ).toHaveCount(0);
    const boxes = async () => ({
      status: await status.boundingBox(),
      card: await card.boundingBox(),
    });
    const before = await boxes();
    expect(before.status && before.card).toBeTruthy();
    // The card sits below the status slot, centred in the page.
    expect(before.card!.y).toBeGreaterThan(
      before.status!.y + before.status!.height - 1,
    );
    // The status text is centred over the card's column.
    const centre = before.status!.x + before.status!.width / 2;
    const cardCentre = before.card!.x + before.card!.width / 2;
    expect(Math.abs(centre - cardCentre)).toBeLessThanOrEqual(1);
    await page.waitForTimeout(1500);
    const after = await boxes();
    for (const key of ["x", "y", "width", "height"] as const) {
      expect(Math.abs(after.status![key] - before.status![key])).toBeLessThan(
        0.5,
      );
      expect(Math.abs(after.card![key] - before.card![key])).toBeLessThan(0.5);
    }
  });
}

test("the unsupported card leads to the QR exchange", async ({
  page,
  context,
}) => {
  await signInFixture(context, "empty", "nearby-qr");
  await page.goto("/nearby");
  await page.getByRole("button", { name: "QRで交換する", exact: true }).click();
  await expect(page).toHaveURL(/\/scan/);
});
