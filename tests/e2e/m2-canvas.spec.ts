import { test, expect } from "@playwright/test";
import { openStudio } from "./helpers";

test("M2 canvas: select node and drag", async ({ page }) => {
  await openStudio(page);
  const node = page.getByTestId("node-start");
  await node.waitFor({ state: "visible", timeout: 10000 });
  const handle = node.locator(".rete-title");
  await handle.waitFor({ state: "visible", timeout: 10000 });

  await handle.click({ force: true });
  await expect(page.getByTestId("inspector-root")).toContainText("Start@1");

  const before = await node.boundingBox();
  expect(before).toBeTruthy();
  if (!before) return;

  await page.mouse.move(before.x + before.width / 2, before.y + before.height / 2);
  await page.mouse.down();
  await page.mouse.move(before.x + before.width / 2 + 60, before.y + before.height / 2 + 40);
  await page.mouse.up();

  await page.waitForTimeout(200);
  const after = await node.boundingBox();
  expect(after).toBeTruthy();
  if (!after) return;

  expect(after.x).not.toBe(before.x);
  expect(after.y).not.toBe(before.y);
});
