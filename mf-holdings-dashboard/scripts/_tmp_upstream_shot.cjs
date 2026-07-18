const { chromium } = require("playwright");
const path = require("path");
const OUT = path.join(__dirname, "..", ".preview_shots");
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.5 });
  await page.goto("https://historyofmarket.com/", { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(OUT, "upstream_home.png") });
  console.log("OK upstream_home");
  await page.goto("https://historyofmarket.com/sp500/annual/", { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(OUT, "upstream_annual.png") });
  console.log("OK upstream_annual");
  await browser.close();
})().catch((e) => { console.error("FATAL", e.message); process.exit(1); });
