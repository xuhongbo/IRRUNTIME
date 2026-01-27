import { test, expect } from "@playwright/test";
import { openStudio } from "./helpers";

test("M3 inspector: edit props updates preview", async ({ page }) => {
  await openStudio(page);
  const node = page.getByTestId("node-show-intro");
  await node.waitFor({ state: "visible", timeout: 10000 });
  await page.getByTestId("node-title-show-intro").click({ force: true });

  const titleInput = page.getByTestId("field-title");
  await titleInput.fill("Updated Title");
  await page.getByTestId("inspector-apply").click();

  await expect(page.getByTestId("props-preview")).toContainText('"title": "Updated Title"');
});
