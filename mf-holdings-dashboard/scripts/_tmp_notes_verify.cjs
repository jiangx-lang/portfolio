/* 临时：/notes 阅读中心交互验证截图 */
const { chromium } = require("playwright");
const crypto = require("crypto");
const path = require("path");

const BASE = "http://localhost:3100";
const OUT = path.join(__dirname, "..", ".preview_shots");

const b64 = (b) =>
  Buffer.from(b).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const body = b64(JSON.stringify({ username: "preview", xp: 999, level: 5, updatedAt: Date.now() }));
const sig = b64(crypto.createHmac("sha256", "atlas-progress-dev-secret").update(body).digest());
const progress = `${body}.${sig}`;

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  await ctx.addCookies([
    { domain: "localhost", path: "/", name: "atlas_auth", value: "preview.4102444800000.sig" },
    { domain: "localhost", path: "/", name: "atlas_progress", value: progress },
  ]);
  const page = await ctx.newPage();

  // 1. 报告 tab
  await page.goto(BASE + "/notes", { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(OUT, "notes_reports_new.png") });
  console.log("OK notes_reports_new");

  // 2. 打开 PDF 阅读器（hero 卡按钮）
  const readBtn = page.locator("text=阅读报告").first();
  if (await readBtn.count()) {
    await readBtn.click();
    await page.waitForTimeout(2500);
    await page.screenshot({ path: path.join(OUT, "notes_pdf_modal.png") });
    console.log("OK notes_pdf_modal");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);
  } else {
    console.log("SKIP pdf modal: no 阅读报告 button");
  }

  // 3. 笔记 tab（含折叠卡）
  await page.goto(BASE + "/notes?tab=notes", { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(OUT, "notes_notes_tab.png"), fullPage: false });
  console.log("OK notes_notes_tab");

  // 4. 展开一篇长笔记
  const expandBtn = page.locator("text=展开全文").first();
  if (await expandBtn.count()) {
    await expandBtn.scrollIntoViewIfNeeded();
    await expandBtn.click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(OUT, "notes_expanded.png") });
    console.log("OK notes_expanded");
  } else {
    console.log("SKIP expand: no 展开全文 button");
  }

  // 5. 搜索高亮
  await page.fill("input[placeholder*='搜索']", "美元");
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(OUT, "notes_search.png") });
  console.log("OK notes_search");

  await browser.close();
  console.log("DONE");
})();
