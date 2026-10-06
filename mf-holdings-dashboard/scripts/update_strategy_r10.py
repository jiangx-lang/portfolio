# -*- coding: utf-8 -*-
"""R10 frozen-snapshot baseline: recompute strategy metrics from c_nav.csv
and patch src/data/public-strategy.json (Root series only; benchmark kept).
"""
import csv
import json
import math
import sys
from datetime import date

CSV_PATH = r"E:/momentum-cn/audit/r10/out/c_nav.csv"
JSON_PATH = r"src/data/public-strategy.json"
INITIAL = 200000.0

dates, navs = [], []
with open(CSV_PATH, newline="", encoding="utf-8") as f:
    r = csv.reader(f)
    header = next(r)
    for row in r:
        if not row:
            continue
        dates.append(row[0])
        navs.append(float(row[1]))

assert abs(navs[0] - INITIAL) < 1e-6, navs[0]
n = len(navs)

# daily returns
rets = [navs[i] / navs[i - 1] - 1.0 for i in range(1, n)]
mean = sum(rets) / len(rets)
var = sum((x - mean) ** 2 for x in rets) / (len(rets) - 1)
sharpe = mean / math.sqrt(var) * math.sqrt(252)

# max drawdown
peak = navs[0]
maxdd = 0.0
dds = []
for v in navs:
    peak = max(peak, v)
    dd = v / peak - 1.0
    dds.append(dd)
    maxdd = min(maxdd, dd)

# CAGR (calendar-year basis)
d0 = date.fromisoformat(dates[0])
d1 = date.fromisoformat(dates[-1])
years = (d1 - d0).days / 365.25
cagr = (navs[-1] / INITIAL) ** (1 / years) - 1

norm = [v / INITIAL for v in navs]

print(f"n={n}  {dates[0]} ~ {dates[-1]}")
print(f"final={navs[-1]:.2f}  multiple={navs[-1]/INITIAL:.4f}")
print(f"CAGR(calendar)={cagr*100:.4f}%   official=18.3316%")
print(f"Sharpe(daily, rf=0, sqrt252)={sharpe:.4f}")
print(f"MaxDD={maxdd*100:.4f}%")

with open(JSON_PATH, encoding="utf-8") as f:
    d = json.load(f)

mc = d["mainChart"]
if mc["dates"] != dates:
    print("ERROR: date axis mismatch", file=sys.stderr)
    sys.exit(1)

# patch metrics (cagr per official signed decision)
d["root"]["cagr"] = 0.183316
d["root"]["sharpe"] = round(sharpe, 2)
d["root"]["maxDD"] = round(maxdd, 4)
d["root"]["finalNav"] = round(navs[-1], 2)
d["root"]["multiple"] = round(navs[-1] / INITIAL, 2)
d["root"]["nTrades"] = 8134

# patch curve (same 4-decimal rounding as existing series)
mc["root"] = [round(x, 4) for x in norm]
mc["ddRoot"] = [round(x, 4) for x in dds]

# meta
d["meta"]["updatedOn"] = "2026-10-06"
d["meta"]["asof"] = "2026-10-06"

# verification badge: keep original, append R10 note
d["verification"] = (
    d["verification"]
    + "。2026-10-06 起成绩卡与曲线为 R10 冻结快照+补丁引擎口径（规则确定性修复，CAGR 18.33%）；"
    "解剖类比例（收益来源三卡、时代分布）为旧引擎口径，待新口径重算。"
)

# risk line 1: max drawdown figure follows new baseline
d["risks"][0] = (
    f"历史最大回撤约 {abs(round(maxdd,4))*100:.0f}%，不是小数目，2015 年式深坑可能复现。"
)

# provenance
d["source"] = (
    "Root 根本版研究: audit/r10 OFFICIAL_DECISION（2026-10-06 用户签字，冻结快照+补丁引擎）; "
    "净值序列: audit/r10/out/c_nav.csv; 基准: 旧报告全市场等权"
)

with open(JSON_PATH, "w", encoding="utf-8") as f:
    json.dump(d, f, ensure_ascii=False, separators=(",", ":"))

print("patched OK:", JSON_PATH)
print(f"root cagr={d['root']['cagr']} sharpe={d['root']['sharpe']} "
      f"maxDD={d['root']['maxDD']} finalNav={d['root']['finalNav']} "
      f"multiple={d['root']['multiple']} nTrades={d['root']['nTrades']}")
print(f"curve last root={mc['root'][-1]} ddRoot={mc['ddRoot'][-1]} "
      f"benchmark last={mc['benchmark'][-1]} (untouched)")
