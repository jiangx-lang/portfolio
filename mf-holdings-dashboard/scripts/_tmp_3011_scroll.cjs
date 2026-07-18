const { chromium } = require("playwright");
const crypto = require("crypto");
const path = require("path");
const fs = require("fs");
const BASE = "http://localhost:3011";
const OUT = path.join(__dirname, "..", ".preview_shots", "scroll");
function loadAuthSecret() {
  try {
    const t = fs.readFileSync(path.join(__dirname, "..", ".env.local"), "utf8");
    const m = t.match(/^\s*AUTH_SECRET\s*=\s*(.+?)\s*$/m);
    if (m) return m[1].replace(/^["']|["']$/g, "");
  } catch {}
  return "atlas-progress-dev-secret";
}
const b64 = (b) => Buffer.from(b).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const body = b64(JSON.stringify({ username: "preview", xp: 999, level: 6, updatedAt: Date.now() }));
const sig = b64(crypto.createHmac("sha256", loadAuthSecret()).update(body).digest());
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1.5 });
  await ctx.route("**/api/progress/*", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ username: "preview", xp: 999, level: 6, levelName: "Atlas 领航员", nextLevelName: null, progressPct: 100, xpToNext: 0 }) }));
  await ctx.addCookies([
    { domain: "localhost", path: "/", name: "atlas_auth", value: "preview.4102444800000.sig" },
    { domain: "localhost", path: "/", name: "atlas_progress", value: `${body}.${sig}` },
  ]);
  const page = await ctx.newPage();
  await page.goto(BASE + "/chronicle", { waitUntil: "networkidle", timeout: 45000 });
  await page.waitForTimeout(3000);
  const H = await page.evaluate(() => document.body.scrollHeight);
  console.log("page height:", H);
  const segs = Math.min(8, Math.ceil(H / 900));
  for (let i = 0; i < segs; i++) {
    await page.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" }), i * 900);
    await page.waitForTimeout(2500);
    await page.screenshot({ path: path.join(OUT, `seg${i}.png`) });
    console.log("OK seg" + i);
  }
  await browser.close();
})().catch((e) => { console.error("FATAL", e.message); process.exit(1); });
