import { test, expect } from "@playwright/test";
import { openStudio } from "./helpers";

const parseCount = (text: string | null) => {
  if (!text) return 0;
  const match = text.match(/Nodes:\s*(\d+)/);
  return match ? Number(match[1]) : 0;
};

test("M4 palette: add and delete node", async ({ page }) => {
  await openStudio(page);

  const meta = page.locator(".graph-meta");
  const beforeText = await meta.textContent();
  const beforeCount = parseCount(beforeText);

  await page.getByTestId("palette-ConstString@1").click();
  await expect(page.getByTestId("inspector-root")).toContainText("ConstString@1");
  const afterText = await meta.textContent();
  const afterCount = parseCount(afterText);
  expect(afterCount).toBe(beforeCount + 1);

  await page.getByTestId("delete-node").click();
  const finalText = await meta.textContent();
  const finalCount = parseCount(finalText);
  expect(finalCount).toBe(beforeCount);
});
