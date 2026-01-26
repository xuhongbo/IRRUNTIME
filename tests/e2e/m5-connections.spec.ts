import { test, expect } from "@playwright/test";
import { openStudio } from "./helpers";

const dragPinToPin = async (page: Parameters<typeof test>[0]["page"], fromTestId: string, toTestId: string) => {
  const from = page.getByTestId(fromTestId);
  const to = page.getByTestId(toTestId);
  await from.waitFor({ state: "visible", timeout: 10000 });
  await to.waitFor({ state: "visible", timeout: 10000 });
  const fromBox = await from.boundingBox();
  const toBox = await to.boundingBox();
  if (!fromBox || !toBox) throw new Error("Missing pin bounds");
  await page.mouse.move(fromBox.x + fromBox.width / 2, fromBox.y + fromBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(toBox.x + toBox.width / 2, toBox.y + toBox.height / 2);
  await page.mouse.up();
};

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
  await expect(page.locator(".errors-item")).toContainText("Required input");

  await dragPinToPin(page, `pin-${strId}-value`, `pin-${showId}-text`);
  await page.waitForTimeout(400);
  await expect(page.locator(".errors-panel")).toHaveCount(0);
});
