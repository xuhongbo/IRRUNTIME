import { test, expect } from "@playwright/test";
import { openStudio } from "./helpers";

test("M9 JSON sync: apply valid and reject invalid drafts", async ({ page }) => {
  await openStudio(page);

  await page.getByTestId("tab-json").click();
  const editor = page.getByTestId("json-editor");
  const text = await editor.inputValue();
  const graph = JSON.parse(text);
  const node = graph.nodes.find((item: { id: string }) => item.id === "show-intro");
  node.props.title = "JSON Updated";
  await editor.fill(JSON.stringify(graph, null, 2));
  await page.getByTestId("apply-json").click();
  await expect(page.locator(".json-error")).toHaveCount(0);

  await page.getByTestId("tab-studio").click();
  await page.getByTestId("node-title-show-intro").click({ force: true });
  await expect(page.getByTestId("props-preview")).toContainText("\"title\": \"JSON Updated\"");

  await page.getByTestId("tab-json").click();
  await editor.fill("{ invalid json");
  await page.getByTestId("apply-json").click();
  await expect(page.locator(".json-error")).toBeVisible();

  await page.getByTestId("tab-studio").click();
  await page.getByTestId("start-run").click();
  await expect(page.getByTestId("runner-root")).toBeVisible();
});
