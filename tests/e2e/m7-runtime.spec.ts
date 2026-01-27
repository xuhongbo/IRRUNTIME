import { test, expect } from "@playwright/test";
import { openStudio } from "./helpers";

test("M7 runtime: breakpoint, step, choice flow", async ({ page }) => {
  await openStudio(page);

  const waitNode = page.getByTestId("node-wait-choice");
  await waitNode.waitFor({ state: "visible", timeout: 10000 });
  await page.getByTestId("node-title-wait-choice").click({ force: true });
  await page.getByTestId("toggle-breakpoint").click();

  await page.getByTestId("start-run").click();
  await expect(page.getByTestId("status-pill")).toHaveText("paused");

  await page.getByTestId("step-run").click();
  await expect(page.getByTestId("runner-root")).toContainText("Make a Choice");

  await page.getByTestId("runner-choice-choiceA").click();
  await expect(page.getByTestId("runner-root")).toContainText("Delay");
});
