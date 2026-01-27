import { test, expect } from "@playwright/test";
import { addNodeFromPalette, dragPinToPin, openCanvas, openStudio } from "./helpers";

test("M9 full flow: complete studio workflow", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await openStudio(page);

  const startId = await addNodeFromPalette(page, "Start@1");
  const showId = await addNodeFromPalette(page, "ShowText@2");
  const waitId = await addNodeFromPalette(page, "WaitForChoice@1");
  const endId = await addNodeFromPalette(page, "End@1");
  const strId = await addNodeFromPalette(page, "ConstString@1");
  const numId = await addNodeFromPalette(page, "ConstNumber@1");

  await dragPinToPin(page, `pin-${startId}-next`, `pin-${showId}-in`);
  await dragPinToPin(page, `pin-${showId}-out`, `pin-${waitId}-in`);
  await dragPinToPin(page, `pin-${waitId}-choiceA`, `pin-${endId}-in`);

  await dragPinToPin(page, `pin-${numId}-value`, `pin-${showId}-text`);
  await page.waitForTimeout(400);
  await expect(page.getByTestId(`error-${showId}-text`)).toBeVisible();

  await dragPinToPin(page, `pin-${strId}-value`, `pin-${showId}-text`);
  await dragPinToPin(page, `pin-${strId}-value`, `pin-${waitId}-prompt`);
  await page.waitForTimeout(400);
  await expect(page.getByTestId(`error-${showId}-text`)).toHaveCount(0);
  await expect(page.getByTestId("errors-panel")).toHaveCount(0);

  await page.getByTestId(`node-title-${showId}`).click({ force: true });
  const titleInput = page.getByTestId("field-title");
  await titleInput.fill("Flow Title");
  await page.getByTestId("inspector-apply").click();
  await expect(page.getByTestId("props-preview")).toContainText('"title": "Flow Title"');

  await page.getByTestId("start-run").click();
  await expect(page.getByTestId("runner-root")).toContainText("Welcome to the Blueprint Studio demo.");
  await expect(page.getByTestId("node-show-intro")).toHaveClass(/running/);

  await page.getByTestId("runner-next").click();
  await expect(page.getByTestId("runner-root")).toContainText("Make a Choice");
  await expect(page.getByTestId("node-wait-choice")).toHaveClass(/running/);

  await page.getByTestId("node-title-wait-choice").click({ force: true });
  await page.getByTestId("toggle-breakpoint").click();
  await page.getByTestId("reset-run").click();
  await page.getByTestId("start-run").click();
  await expect(page.getByTestId("status-pill")).toHaveText("waiting");

  await page.getByTestId("runner-next").click();
  await expect(page.getByTestId("status-pill")).toHaveText("paused");

  await page.getByTestId("step-run").click();
  await expect(page.getByTestId("runner-root")).toContainText("Make a Choice");

  await page.getByTestId("runner-choice-choiceA").click();
  await expect(page.getByTestId("runner-root")).toContainText("Delay");

  await page.getByTestId("node-title-show-intro").click({ force: true });
  await expect(page.getByTestId("inspector-root")).toContainText("Duration:");

  await page.getByTestId("copy-trace").click();
  const traceText = await page.evaluate(() => navigator.clipboard.readText());
  const parsed = JSON.parse(traceText);
  expect(Array.isArray(parsed)).toBe(true);

  await page.getByTestId("tab-json").click();
  const editor = page.getByTestId("json-editor");
  const graph = JSON.parse(await editor.inputValue());
  const introNode = graph.nodes.find((node: { id: string }) => node.id === "show-intro");
  introNode.props.title = "JSON Updated";
  await editor.fill(JSON.stringify(graph, null, 2));
  await page.getByTestId("apply-json").click();

  await page.getByTestId("tab-studio").click();
  await page.getByTestId("node-title-show-intro").click({ force: true });
  await expect(page.getByTestId("props-preview")).toContainText('"title": "JSON Updated"');

  await page.getByTestId("start-run").click();
  await expect(page.getByTestId("status-pill")).toHaveText("waiting");
  await page.getByTestId("reset-run").click();
  await expect(page.getByTestId("status-pill")).toHaveText("idle");
  await expect(page.getByTestId("runner-root")).toContainText("No active view model");

  const canvasPage = await context.newPage();
  await openCanvas(canvasPage);
  await expect(canvasPage.getByTestId("canvas-root")).toBeVisible();

  const [popup] = await Promise.all([
    page.waitForEvent("popup"),
    page.getByTestId("open-canvas-window").click(),
  ]);
  await popup.waitForLoadState("domcontentloaded");
  await expect(popup.getByTestId("canvas-only-root")).toBeVisible();
  await expect(popup.getByTestId("node-start")).toBeVisible();
});
