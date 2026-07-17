/* 补拍巡检缺口：/signals 解锁态、/risk 密码门后内容、/stock tab2/3
 * 进度 cookie 用 .env.local 里的 AUTH_SECRET 签名（与 middleware 校验一致）。
 * 密钥只用于本地签名，不打印、不外传。 */
const { chromium } = require("playwright");
const crypto = require("crypto");
const path = require("path");
const fs = require("fs");

const BASE = "http://localhost:3100";
const OUT = path.join(__dirname, "..", ".preview_shots", "audit");
fs.mkdirSync(OUT, { recursive: true });

function loadAuthSecret() {
  const envPath = path.join(__dirname, "..", ".env.local");
  try {
    const text = fs.readFileSync(envPath, "utf8");
    const m = text.match(/^\s*AUTH_SECRET\s*=\s*(.+?)\s*$/m);
    if (m) return m[1].replace(/^["']|["']$/g, "");
  } catch {}
  return "atlas-progress-dev-secret";
}

const b64 = (b) =>
  Buffer.from(b).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

function signProgress(payload, secret) {
  const body = b64(JSON.stringify(payload));
  const sig = b64(crypto.createHmac("sha256", secret).update(body).digest());
  return `${body}.${sig}`;
}

async function shot(page, name, fullPage = true) {
  await page.screenshot({ path: path.join(OUT, name + ".png"), fullPage });
  console.log("OK", name);
}

(async () => {
  const secret = loadAuthSecret();
  const progress = signProgress(
    { username: "preview", xp: 999, level: 6, updatedAt: Date.now() },
    secret
  );

  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1.5,
  });
  await ctx.route("**/api/progress/*", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        username: "preview", xp: 999, level: 6,
        levelName: "Atlas 领航员", nextLevelName: null, progressPct: 100, xpToNext: 0,
      }),
    })
  );
  await ctx.addCookies([
    { domain: "localhost", path: "/", name: "atlas_auth", value: "preview.4102444800000.sig" },
    { domain: "localhost", path: "/", name: "atlas_progress", value: progress },
  ]);
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log("PAGE-ERR:", String(e).slice(0, 200)));

  const go = async (p) => {
    await page.goto(BASE + p, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(1500);
  };

  // 1) /signals 解锁态（middleware 校验签名通过则应直达）
  await go("/signals");
  console.log("signals url:", page.url());
  await shot(page, "22_signals_unlocked");

  // 2) /risk 密码门后内容（密码 fs123）
  await go("/risk");
  const pwd = page.locator('input[type="password"]');
  if (await pwd.count()) {
    await pwd.first().fill("fs123");
    await pwd.first().press("Enter");
    await page.waitForTimeout(2500);
  }
  await shot(page, "23_risk_content");

  // 3) /stock/NVDA tab2/tab3（首轮缺失的 18/19）
  await go("/stock/NVDA");
  const tabBar = page.locator("button").filter({ hasText: /策略情景|衍生|收益/ });
  const n = await tabBar.count();
  console.log("stock tabs found:", n);
  for (let i = 1; i < n && i < 3; i++) {
    await tabBar.nth(i).click();
    await page.waitForTimeout(1500);
    await shot(page, i === 1 ? "18_stock_tab2" : "19_stock_tab3");
  }

  await browser.close();
  console.log("DONE");
})().catch((e) => {
  console.error("FATAL", e.message);
  process.exit(1);
});
