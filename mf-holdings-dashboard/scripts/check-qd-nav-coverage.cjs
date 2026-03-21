/**
 * 检查 QD 基金（SQLite）在 Supabase fund_list / nav_history 的覆盖（批量查询，较快）
 *
 *   node --env-file=.env.local scripts/check-qd-nav-coverage.cjs
 */
const path = require("path");
const fs = require("fs");
const Database = require("better-sqlite3");
const { createClient } = require("@supabase/supabase-js");

const ROOT = path.join(__dirname, "..");
const DB_PATH = path.join(ROOT, "..", "qdii_portfolio", "fund_tagging.db");

function loadEnvLocal() {
  const p = path.join(ROOT, ".env.local");
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i <= 0) continue;
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))
      v = v.slice(1, -1);
    if (k && process.env[k] === undefined) process.env[k] = v;
  }
}

loadEnvLocal();

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_KEY;
if (!url || !key) {
  console.error("缺少 SUPABASE_URL / SUPABASE_KEY");
  process.exit(1);
}

if (!fs.existsSync(DB_PATH)) {
  console.error("未找到 SQLite:", DB_PATH);
  process.exit(1);
}

const db = new Database(DB_PATH, { readonly: true });
const funds = db
  .prepare(
    `
    SELECT
      fund_id,
      fund_name_cn,
      MIN(COALESCE(primary_code, sc_product_code)) AS code,
      MIN(primary_code) AS primary_code,
      MIN(sc_product_code) AS sc_product_code
    FROM fund_holding_exposure
    WHERE fund_name_cn IS NOT NULL
      AND (primary_code IS NOT NULL OR sc_product_code IS NOT NULL)
    GROUP BY fund_id, fund_name_cn
    ORDER BY fund_name_cn
  `
  )
  .all();
db.close();

const sb = createClient(url, key);

function codeCandidates(f) {
  const out = [];
  for (const c of [f.primary_code, f.sc_product_code, f.code]) {
    const s = String(c || "").trim();
    if (s && !out.includes(s)) out.push(s);
  }
  return out;
}

/** 分页拉全表 fund_list */
async function loadFundListMap() {
  const map = new Map();
  const pageSize = 1000;
  let from = 0;
  for (;;) {
    const { data, error } = await sb.from("fund_list").select("code, isin, ccy").range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data?.length) break;
    for (const row of data) {
      const code = String(row.code || "").trim();
      if (code && row.isin) map.set(code, { isin: String(row.isin), ccy: String(row.ccy || "USD") });
    }
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return map;
}

async function navCount(isin, ccy) {
  const { count, error } = await sb
    .from("nav_history")
    .select("nav_date", { count: "exact", head: true })
    .eq("isin", isin)
    .eq("ccy", ccy);
  if (error) return { error: error.message, n: -1 };
  return { n: count ?? 0 };
}

async function distinctCcysForIsin(isin) {
  const { data, error } = await sb.from("nav_history").select("ccy").eq("isin", isin).limit(80);
  if (error || !data?.length) return [];
  return [...new Set(data.map((r) => String(r.ccy)))];
}

(async () => {
  console.log("加载 fund_list …");
  const fundListMap = await loadFundListMap();
  console.log("fund_list 行数(按 code):", fundListMap.size);

  const noFundList = [];
  const needNavCheck = [];

  for (const f of funds) {
    const candidates = codeCandidates(f);
    let resolved = null;
    for (const code of candidates) {
      const row = fundListMap.get(code);
      if (row) {
        resolved = { ...row, matchedCode: code };
        break;
      }
    }
    if (!resolved) {
      noFundList.push({
        fund_id: f.fund_id,
        fund_name_cn: f.fund_name_cn,
        tried_codes: candidates,
      });
    } else {
      needNavCheck.push({
        fund_id: f.fund_id,
        fund_name_cn: f.fund_name_cn,
        isin: resolved.isin,
        ccy: resolved.ccy,
        matchedCode: resolved.matchedCode,
      });
    }
  }

  console.log("检查 nav_history 计数 …");
  const noNav = [];
  const ok = [];
  const BATCH = 8;
  for (let i = 0; i < needNavCheck.length; i += BATCH) {
    const chunk = needNavCheck.slice(i, i + BATCH);
    const results = await Promise.all(
      chunk.map(async (r) => {
        const nav = await navCount(r.isin, r.ccy);
        return { r, nav };
      })
    );
    for (const { r, nav } of results) {
      if (nav.error) {
        noNav.push({ ...r, err: nav.error, nav_rows: -1 });
        continue;
      }
      if (nav.n === 0) {
        const alt = await distinctCcysForIsin(r.isin);
        noNav.push({
          ...r,
          nav_rows: 0,
          other_ccy_in_nav_history_sample: alt.filter((c) => c !== r.ccy),
        });
      } else {
        ok.push({ fund_name_cn: r.fund_name_cn, isin: r.isin, ccy: r.ccy, nav_rows: nav.n });
      }
    }
    process.stdout.write(`\r  进度 ${Math.min(i + BATCH, needNavCheck.length)} / ${needNavCheck.length}`);
  }
  console.log("");

  console.log("\n=== QD 基金净值覆盖（SQLite 基金数: %d）===", funds.length);
  console.log("✓ 有 fund_list 且 nav_history 有数据: %d", ok.length);
  console.log("✗ fund_list 无匹配: %d", noFundList.length);
  console.log("✗ 有 ISIN 但 nav 为 0 或查询失败: %d", noNav.length);

  if (noFundList.length) {
    console.log("\n--- fund_list 无匹配 ---");
    noFundList.slice(0, 35).forEach((r) => {
      console.log(`  [${r.fund_id}] ${r.fund_name_cn}`);
      console.log(`      尝试: ${r.tried_codes.join(" | ") || "—"}`);
    });
    if (noFundList.length > 35) console.log(`  ... 另有 ${noFundList.length - 35} 只`);
  }

  if (noNav.length) {
    console.log("\n--- 有 ISIN 但无净值行 / 币种可能不一致 ---");
    noNav.slice(0, 35).forEach((r) => {
      console.log(`  ${r.fund_name_cn}`);
      console.log(`      ISIN=${r.isin}  fund_list.ccy=${r.ccy}  code=${r.matchedCode}${r.err ? `  err=${r.err}` : ""}`);
      if (r.other_ccy_in_nav_history_sample?.length) {
        console.log(`      nav_history 中其它 ccy: ${r.other_ccy_in_nav_history_sample.join(", ")}`);
      }
    });
    if (noNav.length > 35) console.log(`  ... 另有 ${noNav.length - 35} 只`);
  }

  const rep = path.join(ROOT, "scripts", "qd-nav-gap-report.json");
  fs.writeFileSync(
    rep,
    JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        fund_list_codes: fundListMap.size,
        total_qd_funds: funds.length,
        with_nav: ok.length,
        missing_fund_list: noFundList.length,
        missing_nav_or_ccy: noNav.length,
        noFundList,
        noNav,
        ok_sample: ok.slice(0, 50),
      },
      null,
      2
    ),
    "utf8"
  );
  console.log("\n完整 JSON:", rep);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
