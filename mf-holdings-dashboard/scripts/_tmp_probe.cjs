const { chromium } = require("playwright");
const crypto = require("crypto");
const path = require("path");
const fs = require("fs");
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
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await ctx.route("**/api/progress/*", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ username: "preview", xp: 999, level: 6 }) }));
  await ctx.addCookies([
    { domain: "localhost", path: "/", name: "atlas_auth", value: "preview.4102444800000.sig" },
    { domain: "localhost", path: "/", name: "atlas_progress", value: `${body}.${sig}` },
  ]);
  const page = await ctx.newPage();
  await page.goto("http://localhost:3011/chronicle", { waitUntil: "networkidle", timeout: 45000 });
  // 滚到估值锚点章节
  await page.evaluate(() => {
    const el = [...document.querySelectorAll("*")].find((e) => e.textContent === "估值锚点" && e.children.length < 3);
    el?.scrollIntoView({ block: "center" });
  });
  await page.waitForTimeout(3500);
  const info = await page.evaluate(() => {
    const areas = [...document.querySelectorAll(".recharts-area-area")];
    return areas.map((a) => {
      const d = a.getAttribute("d") || "";
      const xs = d.match(/[\d.]+(?=,)/g)?.map(Number) ?? [];
      return { len: d.length, minX: Math.min(...xs), maxX: Math.max(...xs), dHead: d.slice(0, 60), dTail: d.slice(-60) };
    });
  });
  console.log(JSON.stringify(info, null, 1));
  await browser.close();
})();
