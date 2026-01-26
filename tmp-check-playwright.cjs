const { chromium } = require("@playwright/test");
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on("pageerror", err => console.log("pageerror", err.message));
  page.on("console", msg => console.log("console", msg.type(), msg.text()));
  await page.goto("http://127.0.0.1:4173", { waitUntil: "domcontentloaded", timeout: 10000 });
  console.log("goto ok");
  const rootHtml = await page.evaluate(() => document.getElementById("root")?.innerHTML || "");
  console.log("root length", rootHtml.length);
  const hasStudio = await page.evaluate(() => Boolean(document.querySelector('[data-testid="studio-root"]')));
  console.log("has studio", hasStudio);
  await browser.close();
})();
