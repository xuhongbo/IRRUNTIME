import { test, expect } from "@playwright/test";
import { openStudio } from "./helpers";

test("M3 inspector: edit props updates preview", async ({ page }) => {
  await openStudio(page);
  const node = page.getByTestId("node-show-intro");
  await node.waitFor({ state: "visible", timeout: 10000 });
  await node.locator(".rete-title").click({ force: true });

  const titleInput = page.getByLabel("Title");
  await titleInput.fill("Updated Title");
  await page.getByRole("button", { name: "Apply" }).click();

  await expect(page.getByTestId("props-preview")).toContainText('"title": "Updated Title"');
});
