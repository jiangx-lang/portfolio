/* 临时脚本：视觉抽查截图（构建后配合 next start 使用） */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const BASE = process.env.BASE_URL || "http://localhost:3100";
const OUT = path.join(__dirname, "..", ".preview_shots");

function b64url(buf) {
  return Buffer.from(buf)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function getAuthSecret() {
  try {
    const envPath = path.join(__dirname, "..", ".env.local");
    const raw = fs.readFileSync(envPath, "utf8");
    const m = raw.match(/^\s*AUTH_SECRET\s*=\s*(.+?)\s*$/m);
    if (m) return m[1].replace(/^["']|["']$/g, "");
  } catch {}
  return "atlas-progress-dev-secret";
}

const AUTH_COOKIE = "preview.4102444800000.sig";

// 通过官方 API 累积 XP，拿服务端签发的进度 cookie
async function farmProgressCookie() {
  let cookie = "";
  for (let i = 0; i < 30; i++) {
    const res = await fetch(BASE + "/api/progress/track", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `atlas_auth=${AUTH_COOKIE}` + (cookie ? `; atlas_progress=${cookie}` : ""),
      },
      body: JSON.stringify({ eventType: "report_export", page_path: "/preview" }),
    });
    const setC = res.headers.get("set-cookie") || "";
    const m = setC.match(/atlas_progress=([^;]+)/);
    if (m) cookie = decodeURIComponent(m[1]);
    if (i % 10 === 9 || i === 29) {
      const j = await res.json().catch(() => ({}));
      console.log(`farm ${i + 1}/30 xp=${j.xp} level=${j.level}`);
    }
  }
  return cookie;
}

function signProgressCookie(secret) {
  const payload = {
    username: "preview",
    xp: 999,
    level: 5,
    updatedAt: Date.now(),
  };
  const body = b64url(JSON.stringify(payload));
  const sig = b64url(
    crypto.createHmac("sha256", secret).update(body).digest()
  );
  return `${body}.${sig}`;
}

const PAGES = [
  { path: "/", name: "home" },
  { path: "/qd", name: "qd" },
  { path: "/mrf", name: "mrf" },
  { path: "/wmp", name: "wmp" },
  { path: "/portfolio", name: "portfolio" },
  { path: "/notes", name: "notes" },
  { path: "/podcast", name: "podcast" },
  { path: "/risk", name: "risk" },
  { path: "/signals", name: "signals" },
  { path: "/unlock?feature=signals&required=4&current=2", name: "unlock" },
  { path: "/stock/NVDA", name: "stock_nvda" },
];

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const progress = signProgressCookie(getAuthSecret());
  const url = new URL(BASE);
  const cookieBase = { domain: url.hostname, path: "/" };

  // 已登录 + 满级上下文；拦截埋点/进度 API 防止覆盖手工注入的满级 cookie
  const ME_STUB = JSON.stringify({
    username: "preview",
    xp: 999,
    level: 5,
    levelName: "Atlas 领航员",
    nextLevelName: null,
    progressPct: 100,
    xpToNext: 0,
  });
  const stubApi = async (c) => {
    await c.route("**/api/progress/track", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: "{}" })
    );
    await c.route("**/api/progress/me", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: ME_STUB })
    );
    await c.route("**/api/track", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: "{}" })
    );
  };
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });
  await stubApi(ctx);
  await ctx.addCookies([
    { ...cookieBase, name: "atlas_auth", value: AUTH_COOKIE },
    { ...cookieBase, name: "atlas_progress", value: progress },
  ]);

  for (const p of PAGES) {
    const page = await ctx.newPage();
    try {
      await page.goto(BASE + p.path, {
        waitUntil: "networkidle",
        timeout: 30000,
      });
      await page.waitForTimeout(1200);
      await page.screenshot({
        path: path.join(OUT, `${p.name}.png`),
        fullPage: false,
      });
      console.log(`OK  ${p.name}  <- ${page.url()}`);
    } catch (e) {
      console.log(`ERR ${p.name}: ${e.message.split("\n")[0]}`);
    }
    await page.close();
  }

  // 移动端抽查：首页 + qd
  const mctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  await stubApi(mctx);
  await mctx.addCookies([
    { ...cookieBase, name: "atlas_auth", value: AUTH_COOKIE },
    { ...cookieBase, name: "atlas_progress", value: progress },
  ]);
  for (const p of [
    { path: "/", name: "m_home" },
    { path: "/qd", name: "m_qd" },
  ]) {
    const page = await mctx.newPage();
    try {
      await page.goto(BASE + p.path, {
        waitUntil: "networkidle",
        timeout: 30000,
      });
      await page.waitForTimeout(1200);
      await page.screenshot({ path: path.join(OUT, `${p.name}.png`) });
      console.log(`OK  ${p.name}`);
    } catch (e) {
      console.log(`ERR ${p.name}: ${e.message.split("\n")[0]}`);
    }
    await page.close();
  }

  // 登录页（无 cookie 上下文）
  const lctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });
  const lp = await lctx.newPage();
  try {
    await lp.goto(BASE + "/login", { waitUntil: "networkidle", timeout: 30000 });
    await lp.waitForTimeout(1500);
    await lp.screenshot({ path: path.join(OUT, "login.png") });
    console.log("OK  login");
  } catch (e) {
    console.log(`ERR login: ${e.message.split("\n")[0]}`);
  }

  await browser.close();
  console.log("DONE ->", OUT);
})();
