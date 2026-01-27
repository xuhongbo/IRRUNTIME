import { test, expect } from "@playwright/test";
import { openStudio } from "./helpers";

test("M1 smoke: JSON apply safety", async ({ page }) => {
  page.on("console", (msg) => console.log(`BROWSER: ${msg.text()}`));
  await page.addInitScript(() => {
    (window as any).__STUDIO_DEBUG__ = true;
  });
  await openStudio(page);
  await expect(page.getByTestId("studio-root")).toBeVisible();

  // Switch to JSON tab
  await page.getByTestId("tab-json").click();
  const editor = page.getByTestId("json-editor");

  const initial = await editor.inputValue();

  await editor.fill("{ invalid json");
  await page.getByTestId("apply-json").click();
  await expect(page.locator(".json-error")).toBeVisible();

  await page.getByTestId("sync-json").click();
  await expect(editor).toHaveValue(initial);

  await page.getByTestId("apply-json").click();
  await expect(page.locator(".json-error")).toHaveCount(0);
});
