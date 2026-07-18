/**
 * 镜像 History of Market 公开数据集 → public/chronicle-data/
 * 许可：CC-BY-4.0（需署名）
 *
 * 用法：
 *   node scripts/sync-historyofmarket.mjs
 *   node scripts/sync-historyofmarket.mjs --limit 10
 *   node scripts/sync-historyofmarket.mjs --concurrency 6
 *
 * 建议：美股收盘后每日跑一次（北京时间约 09:00，工作日）
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "public", "chronicle-data");
const BASE = "https://historyofmarket.com";

function argValue(flag, fallback) {
  const eq = process.argv.find((a) => a.startsWith(`${flag}=`));
  if (eq) return eq.split("=").slice(1).join("=");
  const i = process.argv.indexOf(flag);
  if (i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith("-")) {
    return process.argv[i + 1];
  }
  return fallback;
}

const LIMIT = Number(argValue("--limit", "Infinity"));
const CONCURRENCY = Math.max(1, Number(argValue("--concurrency", "5")));

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeAtomic(filePath, content) {
  ensureDir(path.dirname(filePath));
  const tmp = `${filePath}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, content);
  fs.renameSync(tmp, filePath);
}

async function fetchJson(url, { etag } = {}) {
  const headers = {
    Accept: "application/json",
    "User-Agent": "Atlas-Chronicle-Sync/1.1 (+https://atlasallocations.com)",
  };
  if (etag) headers["If-None-Match"] = etag;
  const res = await fetch(url, { headers });
  if (res.status === 304) return { status: 304, etag };
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  const data = await res.json();
  return { status: 200, data, etag: res.headers.get("etag") || undefined };
}

async function mapPool(items, concurrency, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  async function run() {
    while (cursor < items.length) {
      const i = cursor++;
      results[i] = await worker(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => run()));
  return results;
}

async function main() {
  ensureDir(OUT);
  console.log(`[chronicle-sync] ${new Date().toISOString()}`);
  console.log(`Fetching manifest + profile…`);

  const [manifestRes, profileRes] = await Promise.all([
    fetchJson(`${BASE}/api/_manifest.json`),
    fetchJson(`${BASE}/api/profile.json`),
  ]);
  const manifest = manifestRes.data;
  const profile = profileRes.data;

  writeAtomic(path.join(OUT, "_manifest.json"), JSON.stringify(manifest, null, 2));
  writeAtomic(path.join(OUT, "_profile.json"), JSON.stringify(profile, null, 2));

  const all = manifest.datasets || [];
  const datasets = Number.isFinite(LIMIT) ? all.slice(0, LIMIT) : all;
  console.log(`Syncing ${datasets.length}/${all.length} datasets (concurrency=${CONCURRENCY})`);

  let ok = 0;
  let skipped = 0;
  let fail = 0;
  const etagStorePath = path.join(OUT, "_etags.json");
  let etags = {};
  try {
    etags = JSON.parse(fs.readFileSync(etagStorePath, "utf8"));
  } catch {
    etags = {};
  }

  await mapPool(datasets, CONCURRENCY, async (ds) => {
    const rel = String(ds.path || "").replace(/^\/api\//, "");
    if (!rel) return;
    const target = path.join(OUT, rel);
    const url = ds.url || `${BASE}${ds.path}`;
    try {
      const result = await fetchJson(url, { etag: etags[rel] });
      if (result.status === 304 && fs.existsSync(target)) {
        skipped += 1;
        process.stdout.write(`  · ${rel} (etag)\n`);
        return;
      }
      writeAtomic(target, JSON.stringify(result.data));
      if (result.etag) etags[rel] = result.etag;
      ok += 1;
      process.stdout.write(`  ✓ ${rel}\n`);
    } catch (e) {
      fail += 1;
      process.stderr.write(`  ✗ ${rel}: ${e.message}\n`);
    }
  });

  writeAtomic(etagStorePath, JSON.stringify(etags, null, 2));

  const meta = {
    synced_at: new Date().toISOString(),
    source: BASE,
    license: "CC-BY-4.0",
    attribution:
      "History of Market — The Chronicle of the U.S. Stock Market, historyofmarket.com",
    cadence: "daily after US close (recommended cron: 0 9 * * 2-6 Asia/Shanghai)",
    ok,
    skipped,
    fail,
    total: datasets.length,
    panel_count: Array.isArray(profile?.panels) ? profile.panels.length : null,
    dataset_count: all.length,
  };
  writeAtomic(path.join(OUT, "_sync_meta.json"), JSON.stringify(meta, null, 2));
  console.log(`[chronicle-sync] done ok=${ok} skipped=${skipped} fail=${fail}`);
  if (fail > 0 && ok === 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
