import { test, expect } from "@playwright/test";
import { openCanvas, openStudio } from "./helpers";

test("Canvas route renders", async ({ page }) => {
  await openCanvas(page);
  await expect(page.getByTestId("canvas-only-root")).toBeVisible();
  await expect(page.getByTestId("canvas-root")).toBeVisible();
});

test("Open canvas window renders and syncs move", async ({ page }) => {
  await openStudio(page);
  const [popup] = await Promise.all([
    page.waitForEvent("popup"),
    page.getByTestId("open-canvas-window").click(),
  ]);
  await popup.waitForLoadState("domcontentloaded");
  await expect(popup.getByTestId("canvas-only-root")).toBeVisible();
  const popupNode = popup.getByTestId("node-start");
  await popupNode.waitFor({ state: "visible", timeout: 10000 });

  const before = await popupNode.boundingBox();
  expect(before).toBeTruthy();
  if (!before) return;

  const mainNode = page.getByTestId("node-start");
  await mainNode.waitFor({ state: "visible", timeout: 10000 });
  const handle = page.getByTestId("node-title-start");
  await handle.waitFor({ state: "visible", timeout: 10000 });

  await handle.click({ force: true });
  const mainBox = await mainNode.boundingBox();
  expect(mainBox).toBeTruthy();
  if (!mainBox) return;

  await page.mouse.move(mainBox.x + mainBox.width / 2, mainBox.y + mainBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(mainBox.x + mainBox.width / 2 + 80, mainBox.y + mainBox.height / 2 + 50);
  await page.mouse.up();

  await expect.poll(async () => {
    const box = await popupNode.boundingBox();
    return box?.x ?? 0;
  }).not.toBe(before.x);
});
