/**
 * 从 History of Market 前端 bundle 抽取「editorial」面板数据
 * （王朝 Top10 / 发行注销等无 /api/*.json 的章节）
 *
 * 用法：node scripts/extract-editorial-chronicle.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "..", "public", "chronicle-data");
const BASE = "https://historyofmarket.com";

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeAtomic(filePath, obj) {
  ensureDir(path.dirname(filePath));
  const tmp = `${filePath}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2));
  fs.renameSync(tmp, filePath);
}

async function fetchText(url) {
  const res = await fetch(url, {
    headers: {
      Accept: "*/*",
      "User-Agent": "Atlas-Chronicle-Editorial/1.0 (+https://atlasallocations.com)",
    },
  });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.text();
}

function findAsset(indexJs, prefix) {
  const re = new RegExp(`assets/(${prefix}-[^"'\\s]+\\.js)`);
  const m = indexJs.match(re);
  return m ? m[1] : null;
}

/** 执行 ESM 风格 const 赋值块（去掉 export）并返回变量表 */
function evalConsts(js, names) {
  const cleaned = js.replace(/export\{[^}]+\};?\s*$/m, "").trim();
  // eslint-disable-next-line no-new-func
  const fn = new Function(`${cleaned}; return { ${names.join(",")} };`);
  return fn();
}

function firmKey(f) {
  return f.canonical || String(f.name || "").toLowerCase();
}

function buildLineage(roster) {
  const decades = roster.map((r) => r.decade);
  const map = new Map();
  for (const row of roster) {
    for (const firm of row.top10 || []) {
      const key = firmKey(firm);
      if (!map.has(key)) {
        map.set(key, { key, name: firm.name, nameCn: firm.nameCn, ticker: firm.ticker, appearances: [], ranks: [] });
      }
      const g = map.get(key);
      g.appearances.push(row.decade);
      g.ranks.push(firm.rank);
    }
  }
  return Array.from(map.values())
    .map((g) => ({
      ...g,
      count: g.appearances.length,
      bestRank: Math.min(...g.ranks),
      rank1Count: g.ranks.filter((r) => r === 1).length,
    }))
    .filter((g) => g.count >= 3)
    .sort((a, b) => b.count - a.count || a.bestRank - b.bestRank);
}

function buildCrowns(roster) {
  const map = new Map();
  for (const row of roster) {
    const top = (row.top10 || []).find((f) => f.rank === 1);
    if (!top) continue;
    const key = firmKey(top);
    if (!map.has(key)) {
      map.set(key, { key, name: top.name, nameCn: top.nameCn, ticker: top.ticker, decades: [] });
    }
    map.get(key).decades.push(row.decade);
  }
  return Array.from(map.values())
    .map((g) => ({ ...g, count: g.decades.length }))
    .sort((a, b) => b.count - a.count);
}

function buildEclipse(roster) {
  const lastDecade = roster[roster.length - 1]?.decade;
  const sectorDecades = new Map();
  for (const row of roster) {
    for (const firm of row.top10 || []) {
      const s = firm.sector || "other";
      if (!sectorDecades.has(s)) sectorDecades.set(s, new Set());
      sectorDecades.get(s).add(row.decade);
    }
  }
  return Array.from(sectorDecades.entries())
    .map(([sector, set]) => {
      const decades = Array.from(set).sort();
      return {
        sector,
        firstDecade: decades[0],
        lastDecade: decades[decades.length - 1],
        count: decades.length,
        faded: decades[decades.length - 1] !== lastDecade,
      };
    })
    .sort((a, b) => Number(b.faded) - Number(a.faded) || a.lastDecade.localeCompare(b.lastDecade));
}

async function main() {
  console.log(`[editorial-extract] ${new Date().toISOString()}`);
  const html = await fetchText(`${BASE}/`);
  const indexMatch = html.match(/\/assets\/(index-[^"']+\.js)/);
  if (!indexMatch) throw new Error("cannot locate index bundle from homepage");
  const indexBody = await fetchText(`${BASE}/assets/${indexMatch[1]}`);
  console.log("index", indexMatch[1]);

  const dynFile = findAsset(indexBody, "companyDynasties");
  const annexFile = findAsset(indexBody, "dynastiesAnnex");
  const cpFile = findAsset(indexBody, "counterpointStatic");
  if (!dynFile || !annexFile || !cpFile) {
    throw new Error(`missing modules dyn=${dynFile} annex=${annexFile} cp=${cpFile}`);
  }

  console.log("modules:", dynFile, annexFile, cpFile);
  const [dynJs, annexJs, cpJs] = await Promise.all([
    fetchText(`${BASE}/assets/${dynFile}`),
    fetchText(`${BASE}/assets/${annexFile}`),
    fetchText(`${BASE}/assets/${cpFile}`),
  ]);

  const dyn = evalConsts(dynJs, ["n", "a", "e"]);
  const annex = evalConsts(annexJs, ["e", "a"]);
  const cp = evalConsts(cpJs, ["n", "d", "g", "T", "v", "S", "i"]);

  const roster = dyn.n;
  const updated = new Date().toISOString().slice(0, 10);

  writeAtomic(path.join(OUT, "dynasties", "roster.json"), {
    updated,
    kind: "top10-roster",
    eras: roster,
  });
  writeAtomic(path.join(OUT, "dynasties", "lineage.json"), {
    updated,
    kind: "top10-lineage",
    firms: buildLineage(roster),
  });
  writeAtomic(path.join(OUT, "dynasties", "crowns.json"), {
    updated,
    kind: "top10-crowns",
    crowns: buildCrowns(roster),
  });
  writeAtomic(path.join(OUT, "dynasties", "eclipse.json"), {
    updated,
    kind: "top10-eclipse",
    sectors: buildEclipse(roster),
  });
  writeAtomic(path.join(OUT, "dynasties", "spx-share.json"), {
    updated,
    kind: "top10-spx-share",
    peaks: annex.e,
  });
  writeAtomic(path.join(OUT, "dynasties", "pe-at-entry.json"), {
    updated,
    kind: "top10-pe-at-entry",
    peaks: annex.a,
  });

  // concurrents / aftermath：从 roster 派生简版
  const longLived = buildLineage(roster);
  const pairs = [];
  {
    const decadeSets = roster.map((r) => ({
      decade: r.decade,
      keys: new Set((r.top10 || []).map(firmKey)),
    }));
    const pairMap = new Map();
    for (const { decade, keys } of decadeSets) {
      const arr = Array.from(keys);
      for (let i = 0; i < arr.length; i++) {
        for (let j = i + 1; j < arr.length; j++) {
          const a = arr[i] < arr[j] ? arr[i] : arr[j];
          const b = arr[i] < arr[j] ? arr[j] : arr[i];
          const id = `${a}|${b}`;
          const cur = pairMap.get(id) || { a, b, count: 0, decades: [] };
          cur.count += 1;
          cur.decades.push(decade);
          pairMap.set(id, cur);
        }
      }
    }
    pairs.push(
      ...Array.from(pairMap.values())
        .sort((x, y) => y.count - x.count)
        .slice(0, 20)
    );
  }
  writeAtomic(path.join(OUT, "dynasties", "concurrents.json"), {
    updated,
    kind: "top10-concurrents",
    pairs,
  });
  writeAtomic(path.join(OUT, "dynasties", "aftermath.json"), {
    updated,
    kind: "top10-aftermath",
    firms: longLived.map((f) => ({
      key: f.key,
      name: f.name,
      nameCn: f.nameCn,
      ticker: f.ticker,
      appearances: f.count,
      first: f.appearances[0],
      last: f.appearances[f.appearances.length - 1],
      stillIn: f.appearances[f.appearances.length - 1] === roster[roster.length - 1]?.decade,
    })),
  });

  // issuance
  writeAtomic(path.join(OUT, "latest", "issuance-overview.json"), {
    updated,
    kind: "cp-iss-overview",
    window: cp.n?.window,
    issuanceUsdT: cp.n?.issuanceUsdT,
    retirementUsdT: cp.n?.retirementUsdT,
    issuanceMix: cp.n?.issuanceMix || [],
    sbcSeries: cp.d || [],
    sbcMeta: cp.i || {},
  });
  writeAtomic(path.join(OUT, "latest", "issuance-deciles.json"), {
    updated,
    kind: "cp-iss-deciles",
    sbcByDecile: cp.g || [],
    dilutionByDecile: cp.T || [],
  });
  writeAtomic(path.join(OUT, "latest", "issuance-quadrant.json"), {
    updated,
    kind: "cp-iss-quadrant",
    quintiles: cp.v || [],
    returns: cp.S || {},
  });

  writeAtomic(path.join(OUT, "_editorial_meta.json"), {
    updated,
    source: BASE,
    modules: { dynasties: dynFile, annex: annexFile, counterpoint: cpFile },
    panels: [
      "top10-roster",
      "top10-lineage",
      "top10-crowns",
      "top10-eclipse",
      "top10-concurrents",
      "top10-aftermath",
      "top10-spx-share",
      "top10-pe-at-entry",
      "cp-iss-overview",
      "cp-iss-deciles",
      "cp-iss-quadrant",
    ],
  });

  console.log("[editorial-extract] done → public/chronicle-data/dynasties + latest/issuance-*");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
