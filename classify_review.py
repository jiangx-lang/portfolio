# -*- coding: utf-8 -*-
"""按 parsing_logs 对 86 条待审做分类，便于批量处理"""
import sqlite3
import json
from collections import defaultdict

conn = sqlite3.connect("./sc_funds.db")
rows = conn.execute("""
    SELECT f.id, f.fund_name_cn, f.source_file,
           pl.null_key_fields, pl.uncertain_fields, pl.validation_errors
    FROM funds f
    JOIN (
        SELECT source_file, null_key_fields, uncertain_fields, validation_errors,
               ROW_NUMBER() OVER (PARTITION BY source_file ORDER BY id DESC) rn
        FROM parsing_logs
    ) pl ON pl.source_file = f.source_file AND pl.rn = 1
    WHERE f.status = 2
    ORDER BY f.id
""").fetchall()

def get_fields(r, idx):
    raw = r[idx] or "[]"
    try:
        return json.loads(raw)
    except Exception:
        return []

# 分类规则（与 audit_tool 一致）
# 可自动确认：仅 isin/bloomberg null 或 仅 nav/data_as_of 不确定 或 轻微权重偏差
# 高风险：含 fund_name_cn/mgmt_fee_pct/investment_objective 等 null、或 ret_3m==ret_1y、ABORT
AUTO_NULL = {"isin_codes", "bloomberg_codes"}
AUTO_UNCERTAIN = {"nav", "data_as_of"}
HIGH_RISK_NULL = {"fund_name_cn", "mgmt_fee_pct", "investment_objective", "sc_risk_rating", "sc_product_codes", "inception_date"}
HIGH_RISK_PATTERNS = ["ret_3m==ret_1y", "ABORT", "超出合理范围"]

categories = defaultdict(list)  # 分类名 -> [id]
for r in rows:
    fid, name, src = r[0], r[1] or r[2], r[2]
    nulls = set(get_fields(r, 3))
    unc = get_fields(r, 4)
    errs = get_fields(r, 5) or []
    unc_set = set()
    if isinstance(unc, list):
        for u in unc:
            if isinstance(u, dict) and u.get("field"):
                unc_set.add(u["field"])
            elif isinstance(u, str):
                unc_set.add(u)
    err_str = json.dumps(errs, ensure_ascii=False) if isinstance(errs, list) else str(errs)

    has_high_null = bool(nulls & HIGH_RISK_NULL)
    has_auto_null = nulls and (nulls <= AUTO_NULL or nulls <= (AUTO_NULL | {"inception_date"}))
    has_auto_uncertain = unc_set and (unc_set <= AUTO_UNCERTAIN or unc_set <= {"nav"})
    has_high_pattern = any(p in err_str for p in HIGH_RISK_PATTERNS)
    has_weight_err = "合计=" in err_str and "%" in err_str

    # 分类
    if has_high_null or has_high_pattern:
        cat = "高风险(含关键字段null或校验严重)"
    elif has_auto_null and not unc_set and not errs:
        cat = "可自动确认(仅isin/bloomberg为null)"
    elif has_auto_uncertain and not nulls and not errs:
        cat = "可自动确认(仅nav不确定)"
    elif has_weight_err and not has_high_pattern and not nulls:
        cat = "仅权重/校验警告(可考虑自动确认)"
    elif nulls and (unc_set or errs):
        cat = "null+不确定或校验(需逐条)"
    elif nulls:
        cat = "仅关键字段null(需逐条)"
    elif unc_set and errs:
        cat = "不确定+校验(需逐条)"
    elif unc_set:
        cat = "仅模型不确定(次要字段)"
    elif errs:
        cat = "仅校验警告"
    else:
        cat = "原因不明"
    categories[cat].append(fid)

conn.close()

# 输出
print("=" * 60)
print("  86 条待审 按 parsing_logs 分类")
print("=" * 60)
print()
for cat in [
    "可自动确认(仅isin/bloomberg为null)",
    "可自动确认(仅nav不确定)",
    "仅权重/校验警告(可考虑自动确认)",
    "高风险(含关键字段null或校验严重)",
    "仅关键字段null(需逐条)",
    "仅模型不确定(次要字段)",
    "仅校验警告",
    "不确定+校验(需逐条)",
    "null+不确定或校验(需逐条)",
    "原因不明",
]:
    ids = categories.get(cat, [])
    if not ids:
        continue
    print(f"【{cat}】  {len(ids)} 条")
    print(f"  ID: {ids[:20]}{' ...' if len(ids) > 20 else ''}")
    if len(ids) <= 30:
        print(f"  完整: {','.join(map(str, ids))}")
    print()
print("=" * 60)
print("建议:")
print("  1. 可自动确认的两类 -> 用 --batch-confirm 或 --confirm-id 批量确认")
print("  2. 高风险 -> 不自动确认，可 --force 重解析或人工处理")
print("  3. 仅模型不确定/仅校验 -> 可按需 --auto 或 --confirm-id 批量")
print("  4. null+不确定等 -> --interactive 或逐条")
