import { test, expect } from "@playwright/test";
import { openStudio } from "./helpers";

test("M6 errors: overlays and focus navigation", async ({ page }) => {
  await openStudio(page);

  await page.getByTestId("palette-ShowText@2").click();
  const nodeId = (await page.getByTestId("inspector-node-id").textContent())?.trim();
  expect(nodeId).toBeTruthy();
  if (!nodeId) return;

  await page.waitForTimeout(400);
  const errorItem = page.locator(".errors-item").first();
  await expect(errorItem).toContainText(nodeId);
  await errorItem.click();

  await expect(page.getByTestId(`pin-${nodeId}-text`)).toHaveClass(/focused/);
});
