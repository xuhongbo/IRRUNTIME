import { test, expect } from "@playwright/test";
import { openStudio } from "./helpers";

test("M7 runtime: breakpoint, step, choice flow", async ({ page }) => {
  await openStudio(page);

  const waitNode = page.getByTestId("node-wait-choice");
  await waitNode.waitFor({ state: "visible", timeout: 10000 });
  await waitNode.locator(".rete-title").click({ force: true });
  await page.getByRole("button", { name: "Add Breakpoint" }).click();

  await page.getByRole("button", { name: "Run" }).click();
  await expect(page.locator(".status-pill.paused")).toBeVisible();

  await page.getByRole("button", { name: "Step" }).click();
  await expect(page.getByTestId("runner-root")).toContainText("Make a Choice");

  await page.getByRole("button", { name: "Happy path" }).click();
  await expect(page.getByTestId("runner-root")).toContainText("Delay");
});
