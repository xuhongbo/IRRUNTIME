import { test, expect } from "@playwright/test";
import { openStudio } from "./helpers";

test("Graph settings: contract, inputs, presets validations", async ({ page }) => {
  await openStudio(page);
  await page.getByTestId("tab-graph").click();

  await page.getByTestId("contract-add-input").click();
  await page.getByTestId("contract-input-name-0").fill("payload");
  await page.getByTestId("contract-input-type-0").selectOption("json");
  await page.getByTestId("contract-input-default-0").fill("{ bad json");
  await page.getByTestId("contract-input-examples-0").fill("{}");
  await page.getByTestId("contract-apply").click();

  await expect(page.getByTestId("contract-input-error-default-0")).toContainText("Default JSON invalid");
  await expect(page.getByTestId("contract-input-error-examples-0")).toContainText("Examples must be JSON array");

  await page.getByTestId("contract-input-default-0").fill("{}");
  await page.getByTestId("contract-input-examples-0").fill("[\"ok\"]");
  await page.getByTestId("contract-apply").click();
  await expect(page.locator('[data-testid="contract-input-error-default-0"]')).toHaveCount(0);
  await expect(page.locator('[data-testid="contract-input-error-examples-0"]')).toHaveCount(0);

  await page.getByTestId("graph-input-payload").fill("{ bad json");
  await page.getByTestId("graph-inputs-apply").click();
  await expect(page.getByTestId("graph-input-error-payload")).toContainText("JSON parse error");

  await page.getByTestId("graph-input-payload").fill("{\"ok\":true}");
  await page.getByTestId("graph-inputs-apply").click();
  await expect(page.locator('[data-testid="graph-input-error-payload"]')).toHaveCount(0);

  await page.getByTestId("preset-add").click();
  await page.getByTestId("preset-inputs-0").fill("[]");
  await page.getByTestId("preset-apply").click();
  await expect(page.getByTestId("preset-error-0")).toContainText("Preset inputs must be JSON object");

  await page.getByTestId("preset-inputs-0").fill("{}");
  await page.getByTestId("preset-apply").click();
  await expect(page.locator('[data-testid="preset-error-0"]')).toHaveCount(0);
});
