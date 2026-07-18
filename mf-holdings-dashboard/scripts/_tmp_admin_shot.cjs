/* 验证 admin 入口与 cd123 门禁 */
const { chromium } = require("playwright");
const crypto = require("crypto");
const path = require("path");
const fs = require("fs");

const BASE = "http://localhost:3100";
const OUT = path.join(__dirname, "..", ".preview_shots");

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
const body = b64(JSON.stringify({ username: "admin", xp: 999, level: 6, updatedAt: Date.now() }));
const sig = b64(crypto.createHmac("sha256", loadAuthSecret()).update(body).digest());

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.5 });
  await ctx.route("**/api/progress/*", (route) =>
    route.fulfill({
      status: 200, contentType: "application/json",
      body: JSON.stringify({ username: "admin", xp: 999, level: 6, levelName: "Atlas 领航员", nextLevelName: null, progressPct: 100, xpToNext: 0 }),
    })
  );
  await ctx.addCookies([
    { domain: "localhost", path: "/", name: "atlas_auth", value: "admin.4102444800000.sig" },
    { domain: "localhost", path: "/", name: "atlas_progress", value: `${body}.${sig}` },
  ]);
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log("PAGE-ERR:", String(e).slice(0, 200)));

  // 1) 首页导航应出现「管理」
  await page.goto(BASE + "/", { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(1500);
  const adminLink = await page.locator('header a[href="/admin"]').count();
  console.log("admin nav link count:", adminLink);
  await page.screenshot({ path: path.join(OUT, "admin_nav_entry.png"), fullPage: true });
  console.log("OK admin_nav_entry");

  // 2) /admin 门禁页
  await page.goto(BASE + "/admin", { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(OUT, "admin_gate.png") });
  console.log("OK admin_gate");

  // 3) 输入 cd123 解锁
  const pwd = page.locator('input[type="password"]');
  if (await pwd.count()) {
    await pwd.first().fill("cd123");
    await pwd.first().press("Enter");
    await page.waitForTimeout(2500);
  }
  await page.screenshot({ path: path.join(OUT, "admin_unlocked.png") });
  console.log("OK admin_unlocked");

  await browser.close();
  console.log("DONE");
})().catch((e) => { console.error("FATAL", e.message); process.exit(1); });
