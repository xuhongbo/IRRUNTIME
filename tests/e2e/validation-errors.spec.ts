import { test, expect } from "@playwright/test";
import { openStudio } from "./helpers";

test("Validation errors: incompatible data types via JSON apply", async ({ page }) => {
  await openStudio(page);
  await page.getByTestId("tab-json").click();
  const editor = page.getByTestId("json-editor");
  const graph = JSON.parse(await editor.inputValue());
  graph.edges = graph.edges.filter((edge: { id: string }) => edge.id !== "d3");
  graph.edges.push({
    id: "bad-edge",
    from: { nodeId: "const-flag-value", pinKey: "value" },
    to: { nodeId: "show-intro", pinKey: "text" },
  });
  await editor.fill(JSON.stringify(graph, null, 2));
  await page.getByTestId("apply-json").click();

  await expect(page.getByTestId("errors-panel")).toBeVisible();
  await expect(page.getByTestId("error-show-intro-text")).toContainText("incompatible data types");

  graph.edges = graph.edges.filter((edge: { id: string }) => edge.id !== "bad-edge");
  graph.edges.push({
    id: "d3",
    from: { nodeId: "const-intro", pinKey: "value" },
    to: { nodeId: "show-intro", pinKey: "text" },
  });
  await editor.fill(JSON.stringify(graph, null, 2));
  await page.getByTestId("apply-json").click();
  await expect(page.locator('[data-testid="errors-panel"]')).toHaveCount(0);
});
