/** 列出「已标维度数」≤1 的 mrfHoldingTags 条目（地域/主题块/债券 各算 1 维） */
import { mrfHoldingTags, type HoldingTag } from "../src/data/mrfHoldingTags";

function dimCount(tag: HoldingTag): number {
  let n = 0;
  if (tag.地域) n++;
  if (tag.主题?.length) n++;
  if (tag.债券) n++;
  return n;
}

const rows: { key: string; n: number; tag: HoldingTag }[] = [];
for (const [key, tag] of Object.entries(mrfHoldingTags)) {
  const n = dimCount(tag);
  if (n <= 1) rows.push({ key, n, tag });
}
rows.sort((a, b) => a.n - b.n || a.key.localeCompare(b.key));
for (const r of rows) {
  const parts: string[] = [];
  if (r.tag.地域) parts.push(`地域:${r.tag.地域}`);
  if (r.tag.主题?.length) parts.push(`主题:${r.tag.主题.join("|")}`);
  if (r.tag.债券) parts.push(`债券:${r.tag.债券}`);
  console.log(`${r.n}\t${r.key}\t${parts.join(" ")}`);
}
console.log("--- total", rows.length);
