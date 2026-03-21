/**
 * 工行「代客境外理财」产品代码 vs Supabase fund_list.code
 *
 * 1) 将工行网页/Excel 粘贴全文保存为 UTF-8 文本，例如：
 *    项目根目录 data/icbc_qd_catalog_raw.txt
 * 2) 在 mf-holdings-dashboard 下执行：
 *    node --env-file=.env.local scripts/icbc-catalog-vs-fund-list.cjs ../../data/icbc_qd_catalog_raw.txt
 *
 * 输出：
 *   - 目录中出现的 QDUT / QDUR 份额代码数量
 *   - fund_list 中已有数量
 *   - 目录有但 fund_list 缺失（需补 mapping）
 *   - fund_list 有但目录未出现（可能是旧代码或其它来源）
 */
const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

function loadEnvLocal() {
  const p = path.join(__dirname, "..", ".env.local");
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

/** 工行份额代码：QDUT / QDUR + 数字 + 币种后缀 */
function extractCatalogCodes(text) {
  const re = /\b(QDU[RT]\d{2,4}[A-Z]{2,4})\b/g;
  const set = new Set();
  let m;
  while ((m = re.exec(text)) !== null) {
    set.add(m[1]);
  }
  return [...set].sort();
}

async function loadAllFundListCodes(sb) {
  const set = new Set();
  const pageSize = 1000;
  let from = 0;
  for (;;) {
    const { data, error } = await sb.from("fund_list").select("code").range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data?.length) break;
    for (const row of data) {
      const c = String(row.code || "").trim();
      if (c) set.add(c);
    }
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return set;
}

(async () => {
  const catalogPath = process.argv[2] || path.join(__dirname, "..", "..", "data", "icbc_qd_catalog_raw.txt");
  if (!fs.existsSync(catalogPath)) {
    console.error("找不到目录文件:", catalogPath);
    console.error("请将工行产品全文粘贴保存为该路径，或传入第一个参数：路径");
    process.exit(1);
  }

  const text = fs.readFileSync(catalogPath, "utf8");
  const catalogCodes = extractCatalogCodes(text);
  console.log("目录中提取的产品代码数:", catalogCodes.length);

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_KEY;
  if (!url || !key) {
    console.error("缺少 SUPABASE_URL / SUPABASE_KEY");
    process.exit(1);
  }

  const sb = createClient(url, key);
  const dbCodes = await loadAllFundListCodes(sb);
  console.log("Supabase fund_list 中 code 数:", dbCodes.size);

  const inCatalogNotDb = catalogCodes.filter((c) => !dbCodes.has(c));
  const inDbNotCatalog = [...dbCodes].filter((c) => /^QDU[RT]/i.test(c) && !catalogCodes.includes(c)).sort();

  console.log("\n=== 目录有、fund_list 无（建议补 ISIN/ccy）===", inCatalogNotDb.length);
  inCatalogNotDb.forEach((c) => console.log(c));

  console.log("\n=== fund_list 有 QDU*、但本次目录文本未扫到（可核对是否已停售/旧代码）===", inDbNotCatalog.length);
  inDbNotCatalog.slice(0, 80).forEach((c) => console.log(c));
  if (inDbNotCatalog.length > 80) console.log("... 另有", inDbNotCatalog.length - 80);

  const out = path.join(__dirname, "icbc-vs-fund-list-report.json");
  fs.writeFileSync(
    out,
    JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        catalog_path: catalogPath,
        catalog_code_count: catalogCodes.length,
        fund_list_code_count: dbCodes.size,
        in_catalog_not_fund_list: inCatalogNotDb,
        qdu_in_fund_list_not_in_catalog_sample: inDbNotCatalog,
      },
      null,
      2
    ),
    "utf8"
  );
  console.log("\n报告已写:", out);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
