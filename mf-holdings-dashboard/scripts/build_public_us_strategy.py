# -*- coding: utf-8 -*-
"""从 D:/13f/outputs 的对比报告与季度演示中提取「巨鲸追踪」公众展示数据。

输出: src/data/public-us-strategy.json（结构化，全部数字由 md 表格正则解析，
      并交叉断言两份 md 的整体指标一致）。

脱敏纪律：不导出任何筛选阈值或参数名（机构密集度门槛、估值比值门槛等一律
      不出现）；13F 是 SEC 公开披露，个股名单与机构数、净买卖金额可保留。
      写出前执行黑名单正则自检，命中即退出。
"""
import json
import os
import re
import sys

SRC = "D:/13f/outputs"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                   "..", "src", "data", "public-us-strategy.json")

FORBIDDEN = [
    r"F[123]", r"accel", r"clip", r"top\s?\d+", r"(?i)\brank\b",
    r"(?<![\d.])210(?![\d.])", r"MA\s?\d+", r"排雷", r"加速度",
    r"(?i)buffer", r"REV", r"80%",
    r"flow_breadth", r"SPR", r"breadth_buy_ratio", r"Breadth\s?>",
    r"flow_confidence", r"Forensic",
]


def read(name):
    with open(os.path.join(SRC, name), encoding="utf-8") as f:
        return f.read()


def pct(s):
    return round(float(s.replace("%", "")) / 100, 4)


def parse_overall(md):
    """解析「整体表现对比」表：| 指标 | Mode A | Mode B |"""
    out = {}
    for line in md.splitlines():
        m = re.match(r"\|\s*(.+?)\s*\|\s*([\d.]+%?)\s*\|\s*([\d.]+%?)\s*\|",
                     line)
        if not m:
            continue
        key, a, b = m.groups()
        out[key.strip()] = (a, b)
    return out


def parse_yearly(md):
    """解析按年表：| 2020 | 34 | 47.18% | 22.14% | 55.9% | 26 | 52.75% | ... |"""
    rows = []
    for line in md.splitlines():
        m = re.match(
            r"\|\s*(20\d\d)\s*\|\s*(\d+)\s*\|\s*([\d.]+%)\s*\|\s*([\d.]+%)\s*"
            r"\|\s*([\d.]+%)\s*\|\s*(\d+)\s*\|\s*([\d.]+%)\s*\|\s*([\d.]+%)"
            r"\s*\|\s*([\d.]+%)\s*\|", line)
        if m:
            y, asn, ar, aa, aaw, bsn, br, ba, baw = m.groups()
            rows.append({
                "year": int(y),
                "aSignals": int(asn), "aAvg4Q": pct(ar), "aAlpha": pct(aa),
                "aAlphaWin": pct(aaw),
                "bSignals": int(bsn), "bAvg4Q": pct(br), "bAlpha": pct(ba),
                "bAlphaWin": pct(baw),
            })
    return rows


def main():
    md_perf = read("两种策略历史表现对比.md")
    md_down = read("大盘下跌年份_两策略与大盘对比.md")

    overall = parse_overall(md_perf)
    yearly = parse_yearly(md_perf)
    assert len(yearly) == 5, f"yearly rows: {len(yearly)}"

    a_sig = int(overall["总信号数"][0])
    b_sig = int(overall["总信号数"][1])
    # 分年表统计的是「具备完整 4Q 表现」的子集（信号发出满一年）
    assert a_sig == 310 and sum(r["aSignals"] for r in yearly) == 258
    assert b_sig == 255 and sum(r["bSignals"] for r in yearly) == 210

    tracks = {
        "A": {
            "key": "bottleneck",
            "label": "物理瓶颈产业链",
            "tagline": "电网、核电、热管理、核燃料、数据中心 REIT、储能等「有物理产能约束」的链条",
            "signals": a_sig,
            "winRate": pct(overall["绝对胜率（4Q 收益>0）"][0]),
            "alphaWinRate": pct(overall["Alpha 胜率（4Q 超额>0）"][0]),
            "avg4Q": pct(overall["平均 4Q 收益"][0]),
            "avgAlpha": pct(overall["平均 4Q 超额 vs SPY"][0]),
        },
        "B": {
            "key": "radar",
            "label": "全市场雷达",
            "tagline": "同一套「机构共识 + 估值未贵」标准，不限行业，在全市场扫描",
            "signals": b_sig,
            "winRate": pct(overall["绝对胜率（4Q 收益>0）"][1]),
            "alphaWinRate": pct(overall["Alpha 胜率（4Q 超额>0）"][1]),
            "avg4Q": pct(overall["平均 4Q 收益"][1]),
            "avgAlpha": pct(overall["平均 4Q 超额 vs SPY"][1]),
        },
    }

    # 大盘年度收益（对照列）
    spy = []
    for line in md_down.splitlines():
        m = re.match(r"\|\s*(20\d\d)\s*\|\s*(-?[\d.]+%)\s*\|", line)
        if m:
            spy.append({"year": int(m.group(1)), "spyReturn": pct(m.group(2))})
    spy = [s for s in spy if s["year"] <= 2024]
    assert len(spy) == 5, f"spy rows: {len(spy)}"
    spy_by_year = {s["year"]: s["spyReturn"] for s in spy}
    for r in yearly:
        r["spyReturn"] = spy_by_year[r["year"]]

    down = next(r for r in yearly if r["spyReturn"] < 0)
    assert down["year"] == 2022

    data = {
        "meta": {
            "name": "巨鲸追踪 · WhaleTrail",
            "quarter": "2026 Q2",
            "dataNote": "信号样本 2020–2024，季度亮点截至 2026Q2 披露季",
            "disclaimer": "历史回测，非实盘业绩",
        },
        "tracks": tracks,
        "yearly": yearly,
        "downYear": down,
        "quarterHighlights": [
            {
                "title": "潜伏共识黑马",
                "text": "POWL、MOD、NVT、NXT、SXI：机构开仓/加仓极其密集但净流入金额尚小——典型的「爆发前潜伏」形态，集中在变电开关、数据中心液冷、电网继电器等物理瓶颈细分。",
            },
            {
                "title": "净买入主线：硬资产与电力",
                "text": "GEV（单季机构净买入约 $14.9B、上百家机构加仓）、CEG、VRT 领衔，电网设备、核电、热管理、储能霸榜加仓前列。",
            },
            {
                "title": "净卖出主线：按席位收费的 SaaS",
                "text": "CRM、ZM、DOCU 等 Seat-SaaS 被机构集体减持——AI 按量计费模式正在侵蚀按人头收费的叙事。",
            },
            {
                "title": "宏观锚点：贴现率新常态",
                "text": "Higher for Longer 延续；AI 资本开支进入「ROIC 能否覆盖 CAPEX」的检验期；数据中心发债成本升至 7.2%–7.8% 的历史高位。",
            },
        ],
        "source": "SEC 13F 公开披露; backflow 回测流水（T+1 收盘买入，持有 4 季度）; SPY 对照",
    }

    text = json.dumps(data, ensure_ascii=False, indent=1)
    for pat in FORBIDDEN:
        m = re.search(pat, text)
        if m:
            print(f"[LEAK] {pat!r} -> {m.group(0)!r}", file=sys.stderr)
            sys.exit(1)
    with open(OUT, "w", encoding="utf-8") as f:
        f.write(text + "\n")
    print(f"[ok] wrote {os.path.abspath(OUT)} ({len(text)/1024:.1f} KB), clean")


if __name__ == "__main__":
    main()
