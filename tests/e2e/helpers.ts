import type { Page } from "@playwright/test";

export const openStudio = async (page: Page) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByTestId("studio-root").waitFor({ state: "visible", timeout: 10000 });
};

export const openCanvas = async (page: Page) => {
  await page.goto("/canvas", { waitUntil: "domcontentloaded" });
  await page.getByTestId("canvas-only-root").waitFor({ state: "visible", timeout: 10000 });
};
