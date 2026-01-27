import type { Page } from "@playwright/test";

export const openStudio = async (page: Page) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByTestId("studio-root").waitFor({ state: "visible", timeout: 10000 });
};

export const openCanvas = async (page: Page) => {
  await page.goto("/canvas", { waitUntil: "domcontentloaded" });
  await page.getByTestId("canvas-only-root").waitFor({ state: "visible", timeout: 10000 });
};

export const addNodeFromPalette = async (page: Page, typeVersion: string) => {
  await page.getByTestId(`palette-${typeVersion}`).click();
  const nodeId = (await page.getByTestId("inspector-node-id").textContent())?.trim();
  if (!nodeId) {
    throw new Error(`Unable to read node id after adding ${typeVersion}`);
  }
  return nodeId;
};

export const dragPinToPin = async (page: Page, fromTestId: string, toTestId: string) => {
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
