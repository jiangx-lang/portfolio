/**
 * 报告：mrf_holdings 中出现的持仓名是否在 mrfHoldingTags 中有映射；
 * 以及映射表中「仅单一维度」（仅地域 / 仅主题 / 仅债券）的条目。
 *
 * 用法（在 mf-holdings-dashboard 目录）:
 *   npx tsx scripts/mrf-holding-tag-report.ts
 *
 * 需 .env.local 中配置 SUPABASE_URL + SUPABASE_KEY（或 NEXT_PUBLIC_*）以拉取 mrf_holdings；
 * 若未配置，仅输出映射表内部的「单维度」清单。
 */
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import type { HoldingTag } from "../src/data/mrfHoldingTags";
import { mrfHoldingTags } from "../src/data/mrfHoldingTags";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadEnvFile(file: string) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq < 1) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (k) process.env[k] = v;
  }
}
loadEnvFile(path.join(__dirname, "../.env.local"));
loadEnvFile(path.join(__dirname, "../.env"));

function dimParts(tag: HoldingTag): { 地域: boolean; 主题: boolean; 债券: boolean } {
  return {
    地域: Boolean(tag.地域),
    主题: Boolean(tag.主题 && tag.主题.length > 0),
    债券: Boolean(tag.债券),
  };
}

function dimCount(tag: HoldingTag): number {
  const p = dimParts(tag);
  return (p.地域 ? 1 : 0) + (p.主题 ? 1 : 0) + (p.债券 ? 1 : 0);
}

function summarizeTag(tag: HoldingTag): string {
  const p = dimParts(tag);
  const bits: string[] = [];
  if (p.地域) bits.push(`地域=${tag.地域}`);
  if (p.主题) bits.push(`主题=[${tag.主题!.join(",")}]`);
  if (p.债券) bits.push(`债券=${tag.债券}`);
  return bits.join(" · ");
}

async function fetchDistinctHoldingNames(): Promise<string[]> {
  const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
  const key = (
    process.env.SUPABASE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    ""
  ).trim();
  if (!url || !key) return [];

  const sb = createClient(url, key, { auth: { persistSession: false } });
  const names = new Set<string>();
  const pageSize = 1000;
  let from = 0;
  for (;;) {
    const { data, error } = await sb
      .from("mrf_holdings")
      .select("holding_name")
      .range(from, from + pageSize - 1);
    if (error) {
      console.error("[Supabase]", error.message);
      return [];
    }
    if (!data?.length) break;
    for (const row of data) {
      const n = String((row as { holding_name?: string }).holding_name ?? "").trim();
      if (n) names.add(n);
    }
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return Array.from(names).sort((a, b) => a.localeCompare(b, "zh-Hans-CN"));
}

async function main() {
  console.log("=== mrfHoldingTags 映射表内：仅含 1 个维度（地域/主题/债券 三选一有内容）===\n");
  const singleDim: { name: string; tag: HoldingTag }[] = [];
  for (const [name, tag] of Object.entries(mrfHoldingTags)) {
    if (dimCount(tag) === 1) singleDim.push({ name, tag });
  }
  singleDim.sort((a, b) => a.name.localeCompare(b.name, "zh-Hans-CN"));
  for (const { name, tag } of singleDim) {
    console.log(`- ${name}`);
    console.log(`  → ${summarizeTag(tag)}`);
  }
  console.log(`\n（共 ${singleDim.length} 条）\n`);

  console.log("=== mrf_holdings（Supabase）中出现、但 mrfHoldingTags 无精确键匹配的持仓名 ===\n");
  const fromDb = await fetchDistinctHoldingNames();
  if (fromDb.length === 0) {
    console.log(
      "未拉取到数据：请检查 .env.local 是否配置 SUPABASE_URL + SUPABASE_KEY，或数据库 mrf_holdings 是否为空。\n"
    );
    return;
  }
  const missing = fromDb.filter((n) => mrfHoldingTags[n] === undefined);
  if (missing.length === 0) {
    console.log("无缺失：所有 distinct holding_name 均在映射表中有键。\n");
  } else {
    for (const n of missing) console.log(`- ${n}`);
    console.log(`\n（共 ${missing.length} 条，数据库 distinct 持仓 ${fromDb.length} 条）\n`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
