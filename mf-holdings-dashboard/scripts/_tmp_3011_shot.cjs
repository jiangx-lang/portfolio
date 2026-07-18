/* 编年史定制面板截图 */
const { chromium } = require("playwright");
const crypto = require("crypto");
const path = require("path");
const fs = require("fs");

const BASE = "http://localhost:3011";
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
  page.on("response", (r) => { if (r.status() >= 400) console.log("HTTP", r.status(), r.url()); });

  const targets = [
    ["/chronicle", "chronicle_hub"],
    ["/chronicle/sp500-logyoy", "chronicle_logyoy"],
    ["/chronicle/forward-pe", "chronicle_forwardpe"],
    ["/chronicle/mag7-concentration", "chronicle_mag7"],
  ];
  for (const [url, name] of targets) {
    await page.goto(BASE + url, { waitUntil: "networkidle", timeout: 45000 });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(OUT, name + ".png") });
    console.log("OK", name);
  }
  await browser.close();
  console.log("DONE");
})().catch((e) => { console.error("FATAL", e.message); process.exit(1); });
