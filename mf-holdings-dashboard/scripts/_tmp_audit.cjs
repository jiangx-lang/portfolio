/* 全站逐页交互巡检 */
const { chromium } = require("playwright");
const crypto = require("crypto");
const path = require("path");
const fs = require("fs");

const BASE = "http://localhost:3100";
const OUT = path.join(__dirname, "..", ".preview_shots", "audit");
fs.mkdirSync(OUT, { recursive: true });

// middleware 用 AUTH_SECRET（.env.local）校验进度 cookie，缺省时回退 dev 默认值
function loadAuthSecret() {
  try {
    const text = fs.readFileSync(path.join(__dirname, "..", ".env.local"), "utf8");
    const m = text.match(/^\s*AUTH_SECRET\s*=\s*(.+?)\s*$/m);
    if (m) return m[1].replace(/^["']|["']$/g, "");
  } catch {}
  return "atlas-progress-dev-secret";
}

const b64 = (b) =>
  Buffer.from(b).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const body = b64(JSON.stringify({ username: "preview", xp: 999, level: 6, updatedAt: Date.now() }));
const sig = b64(crypto.createHmac("sha256", loadAuthSecret()).update(body).digest());
const progress = `${body}.${sig}`;

async function shot(page, name, fullPage = false) {
  await page.screenshot({ path: path.join(OUT, name + ".png"), fullPage });
  console.log("OK", name);
}

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1.5,
  });
  // 拦截进度 API，防止覆盖手工注入的满级 cookie
  await ctx.route("**/api/progress/*", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ username: "preview", xp: 999, level: 5, levelName: "Atlas 领航员", nextLevelName: null, progressPct: 100, xpToNext: 0 }),
    })
  );
  await ctx.addCookies([
    { domain: "localhost", path: "/", name: "atlas_auth", value: "preview.4102444800000.sig" },
    { domain: "localhost", path: "/", name: "atlas_progress", value: progress },
  ]);
  const page = await ctx.newPage();
  page.on("console", (m) => {
    if (m.type() === "error") console.log("BROWSER-ERR:", m.text().slice(0, 160));
  });
  page.on("pageerror", (e) => console.log("PAGE-ERR:", String(e).slice(0, 200)));

  const go = async (p) => {
    await page.goto(BASE + p, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(900);
  };

  // 首页（整页）
  await go("/");
  await shot(page, "01_home_full", true);

  // QD 基金池 + 展开第一行
  await go("/qd");
  await shot(page, "02_qd_top");
  const qdRow = page.locator("tbody tr").first();
  if (await qdRow.count()) {
    await qdRow.click();
    await page.waitForTimeout(1800);
    await shot(page, "03_qd_expanded", false);
    await page.locator("tbody tr").first().scrollIntoViewIfNeeded();
  }
  await shot(page, "04_qd_full", true);

  // MRF + 展开第一行
  await go("/mrf");
  await shot(page, "05_mrf_top");
  const mrfRow = page.locator("tbody tr").first();
  if (await mrfRow.count()) {
    await mrfRow.click();
    await page.waitForTimeout(1800);
    await shot(page, "06_mrf_expanded");
  }
  await shot(page, "07_mrf_full", true);

  // WMP
  await go("/wmp");
  await shot(page, "08_wmp", true);

  // Portfolio（整页）
  await go("/portfolio");
  await shot(page, "09_portfolio_full", true);

  // Notes 双 tab
  await go("/notes");
  await shot(page, "10_notes_reports");
  await go("/notes?tab=notes");
  await shot(page, "11_notes_notes", true);

  // Podcast
  await go("/podcast");
  await shot(page, "12_podcast", true);

  // Risk 密码门
  await go("/risk");
  await shot(page, "13_risk_gate");

  // Signals
  await go("/signals");
  await shot(page, "14_signals", true);

  // Unlock
  await go("/unlock?feature=signals&required=4&current=2");
  await shot(page, "15_unlock", true);

  // Stock NVDA 三个 tab
  await go("/stock/NVDA");
  await shot(page, "16_stock_top");
  await shot(page, "17_stock_full", true);
  for (const [i, name] of [
    [1, "18_stock_tab2"],
    [2, "19_stock_tab3"],
  ]) {
    const tabs = page.locator("button").filter({ hasText: /策略|衍生|收益|链|图/ });
    if ((await tabs.count()) > i) {
      await tabs.nth(i).click();
      await page.waitForTimeout(1200);
      await shot(page, name, true);
    }
  }

  // Login + 注册模式
  const lctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1.5,
  });
  const lp = await lctx.newPage();
  await lp.goto(BASE + "/login", { waitUntil: "networkidle", timeout: 30000 });
  await lp.waitForTimeout(1200);
  await lp.screenshot({ path: path.join(OUT, "20_login.png") });
  console.log("OK 20_login");

  await browser.close();
  console.log("DONE");
})().catch((e) => {
  console.error("FATAL", e.message);
  process.exit(1);
});
