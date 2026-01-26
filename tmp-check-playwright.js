const { chromium } = require("@playwright/test");
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on("pageerror", err => console.log("pageerror", err.message));
  page.on("console", msg => console.log("console", msg.type(), msg.text()));
  await page.goto("http://127.0.0.1:4173", { waitUntil: "domcontentloaded" });
  try {
    await page.waitForSelector('[data-testid="studio-root"]', { timeout: 5000 });
    console.log("studio-root visible");
  } catch (err) {
    console.log("wait error", err.message);
  }
  await browser.close();
})();
