import { test, expect } from "@playwright/test";
import { dragPinToPin, openStudio } from "./helpers";

test("M5 connections: enforce pin and type rules", async ({ page }) => {
  await openStudio(page);

  await page.getByTestId("palette-ShowText@2").click();
  const showId = (await page.getByTestId("inspector-node-id").textContent())?.trim();
  expect(showId).toBeTruthy();
  if (!showId) return;

  await page.getByTestId("palette-ConstNumber@1").click();
  const numId = (await page.getByTestId("inspector-node-id").textContent())?.trim();
  expect(numId).toBeTruthy();
  if (!numId) return;

  await page.getByTestId("palette-ConstString@1").click();
  const strId = (await page.getByTestId("inspector-node-id").textContent())?.trim();
  expect(strId).toBeTruthy();
  if (!strId) return;

  await dragPinToPin(page, `pin-${numId}-value`, `pin-${showId}-text`);
  await page.waitForTimeout(400);
  await expect(page.getByTestId(`error-${showId}-text`)).toContainText("Required input");

  await dragPinToPin(page, `pin-${strId}-value`, `pin-${showId}-text`);
  await page.waitForTimeout(400);
  await expect(page.getByTestId("errors-panel")).toHaveCount(0);
});
