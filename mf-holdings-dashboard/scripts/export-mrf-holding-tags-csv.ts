/**
 * 导出 mrfHoldingTags 全量标签为 CSV，可用 Excel 打开审阅。
 *
 * 运行（在 mf-holdings-dashboard 目录）:
 *   npx tsx scripts/export-mrf-holding-tags-csv.ts
 *
 * 输出: mrf-holding-tags-review.csv（项目根下 mf-holdings-dashboard）
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { mrfHoldingTags, type HoldingTag } from "../src/data/mrfHoldingTags";
import { formatMrfHoldingDisplayName } from "../src/data/mrfHoldingNameUnified";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "..", "mrf-holding-tags-review.csv");

function csvCell(s: string): string {
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function dimCount(tag: HoldingTag): number {
  let n = 0;
  if (tag.地域) n++;
  if (tag.主题?.length) n++;
  if (tag.债券) n++;
  return n;
}

function classify(tag: HoldingTag): string {
  const hasGeoOrTheme = Boolean(tag.地域 || (tag.主题 && tag.主题.length > 0));
  const hasBond = Boolean(tag.债券);
  if (hasGeoOrTheme && hasBond) return "股债均有";
  if (hasBond) return "仅债券";
  return "仅地域/主题";
}

function row(tag: HoldingTag, key: string): string[] {
  const region = tag.地域 ?? "";
  const themes = tag.主题?.length ? tag.主题.join("、") : "";
  const bond = tag.债券 ?? "";
  const display = formatMrfHoldingDisplayName(key);
  return [
    key,
    display,
    region,
    themes,
    bond,
    String(dimCount(tag)),
    classify(tag),
  ];
}

const headers = [
  "标签表主键",
  "界面简体展示名",
  "地域",
  "主题",
  "债券",
  "已标维度数",
  "分类",
];

const entries = Object.entries(mrfHoldingTags).sort(([a], [b]) =>
  a.localeCompare(b, "zh-Hans-CN")
);

const lines = [
  headers.map(csvCell).join(","),
  ...entries.map(([k, t]) => row(t, k).map(csvCell).join(",")),
];

fs.writeFileSync(OUT, "\uFEFF" + lines.join("\r\n"), "utf8");
console.log(`已写入 ${entries.length} 条 → ${OUT}`);
