# -*- coding: utf-8 -*-
"""v2.3 baseline (OFFICIAL_DECISION v3 ADDENDUM, signed 2026-10-06):
remove explicit take-profit (SELL_tp). Recompute strategy metrics from
exit_study/out/Q_E1_nav.csv and patch src/data/public-strategy.json
(Root series only; benchmark kept).

Official signed values: CAGR 17.0427% / Sharpe 0.7441 / MaxDD -53.23% /
final 2,032,781.73 / 7,882 trades. Recomputed CAGR/Sharpe/MaxDD/final are
asserted against the signed values before patching.
"""
import csv
import json
import math
import sys
from datetime import date

CSV_PATH = r"E:/momentum-cn/audit/r10/exit_study/out/Q_E1_nav.csv"
JSON_PATH = r"src/data/public-strategy.json"
INITIAL = 200000.0

OFFICIAL_CAGR = 0.17042687325443207
OFFICIAL_SHARPE = 0.7441
OFFICIAL_MAXDD = -0.5323
OFFICIAL_FINAL = 2032781.73
OFFICIAL_NTRADES = 7882

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
print(f"CAGR(calendar)={cagr*100:.6f}%   official=17.0427%")
print(f"Sharpe(daily, rf=0, sqrt252)={sharpe:.4f}   official=0.7441")
print(f"MaxDD={maxdd*100:.4f}%   official=-53.23%")

# cross-check against signed values
assert abs(cagr - OFFICIAL_CAGR) < 5e-4, f"CAGR mismatch: {cagr}"
assert abs(sharpe - OFFICIAL_SHARPE) < 5e-3, f"Sharpe mismatch: {sharpe}"
assert abs(maxdd - OFFICIAL_MAXDD) < 5e-3, f"MaxDD mismatch: {maxdd}"
assert abs(navs[-1] - OFFICIAL_FINAL) < 0.01, f"final mismatch: {navs[-1]}"

# era returns recomputed on the E1 nav (was old-engine caliber)
def year_ret(y0, y1=None):
    i0 = max(i for i, d in enumerate(dates) if d[:4] == str(y0))
    if y1 is None:
        return navs[-1] / navs[i0] - 1.0
    i1 = max(i for i, d in enumerate(dates) if d[:4] == str(y1))
    return navs[i1] / navs[i0] - 1.0

y2025 = year_ret(2024, 2025)
y2026 = year_ret(2025)
print(f"eras(E1 nav): 2025={y2025*100:+.2f}%  2026={y2026*100:+.2f}%")

with open(JSON_PATH, encoding="utf-8") as f:
    d = json.load(f)

mc = d["mainChart"]
if mc["dates"] != dates:
    print("ERROR: date axis mismatch", file=sys.stderr)
    sys.exit(1)

# patch metrics (cagr per official signed addendum)
d["root"]["cagr"] = 0.170427
d["root"]["sharpe"] = round(sharpe, 2)
d["root"]["maxDD"] = round(maxdd, 4)
d["root"]["finalNav"] = round(navs[-1], 2)
d["root"]["multiple"] = round(navs[-1] / INITIAL, 2)
d["root"]["nTrades"] = OFFICIAL_NTRADES

# patch curve (same 4-decimal rounding as existing series)
mc["root"] = [round(x, 4) for x in norm]
mc["ddRoot"] = [round(x, 4) for x in dds]

# meta
d["meta"]["updatedOn"] = "2026-10-06"
d["meta"]["asof"] = "2026-10-06"

# one-line definition: take-profit bullet removed (v2.3)
d["definition"][2] = "排名衰减：业绩跌出前 40 就换掉（v2.3 起无止盈）"

# exit anatomy: tp stats kept as deleted-rule archive, text reworded
d["sources"]["exit"]["text"] = (
    "v2.3 已删除显式止盈：出场反事实研究显示其贡献为噪声级"
    "（未达预注册 2pp 判定线），唯一卖出线 = 业绩排名跌出前 40。"
    "上方止盈/衰减盈亏统计为已删规则时代的旧引擎存档口径。"
)

# era card: recomputed on E1 nav (no longer old-caliber)
d["sources"]["eras"]["y2025"] = round(y2025, 4)
d["sources"]["eras"]["y2026"] = round(y2026, 4)

# verification badge: replace PIT note with v2.3 note
base = d["verification"].split("。2026-10-06 起")[0]
d["verification"] = (
    base
    + "。2026-10-06 v2.3：策略删除显式止盈规则（反事实研究证伪"
    "“止盈是利润引擎”，贡献未达预注册 2pp 判定线），成绩卡与曲线为"
    "删止盈后官方基线（CAGR 17.04% / Sharpe 0.74 / MaxDD -53.23% / "
    "期末 203.3 万 / 7,882 笔，PIT-ST 口径）。"
    "进场解剖比例为旧引擎口径，待新口径重算。"
)

# risk line 1: max drawdown figure follows new baseline
d["risks"][0] = (
    f"历史最大回撤约 {abs(round(maxdd,4))*100:.0f}%，不是小数目，2015 年式深坑可能复现。"
)

# provenance
d["source"] = (
    "Root 根本版研究: audit/r10 OFFICIAL_DECISION v3 ADDENDUM"
    "（2026-10-06 用户签字，v2.3 删止盈，PIT-ST 口径）; "
    "净值序列: audit/r10/exit_study/out/Q_E1_nav.csv; 基准: 旧报告全市场等权"
)

with open(JSON_PATH, "w", encoding="utf-8") as f:
    json.dump(d, f, ensure_ascii=False, separators=(",", ":"))

print("patched OK:", JSON_PATH)
print(f"root cagr={d['root']['cagr']} sharpe={d['root']['sharpe']} "
      f"maxDD={d['root']['maxDD']} finalNav={d['root']['finalNav']} "
      f"multiple={d['root']['multiple']} nTrades={d['root']['nTrades']}")
print(f"curve last root={mc['root'][-1]} ddRoot={mc['ddRoot'][-1]} "
      f"benchmark last={mc['benchmark'][-1]} (untouched)")
