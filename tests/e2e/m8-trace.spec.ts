import { test, expect } from "@playwright/test";
import { openStudio } from "./helpers";

test("M8 trace: copy JSON", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await openStudio(page);

  await page.getByRole("button", { name: "Run" }).click();
  await page.waitForTimeout(300);
  await expect(page.locator(".trace-entry").first()).toBeVisible();

  await page.getByTestId("copy-trace").click();
  const text = await page.evaluate(() => navigator.clipboard.readText());
  const parsed = JSON.parse(text);
  expect(Array.isArray(parsed)).toBe(true);
});
