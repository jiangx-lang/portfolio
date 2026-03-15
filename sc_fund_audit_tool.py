"""
sc_fund_audit_tool.py
══════════════════════════════════════════════════════════════════
批量审核工具 · 处理 status=2 的待审核记录

用法：
  python sc_fund_audit_tool.py --db ./sc_funds.db --diagnose
      → 打印待审核记录的问题分布，帮你决定批量策略

  python sc_fund_audit_tool.py --db ./sc_funds.db --auto
      → 按安全规则自动确认"低风险"问题（isin null / nav不确定 / 轻微偏差）

  python sc_fund_audit_tool.py --db ./sc_funds.db --batch-confirm "isin_codes"
      → 把所有"只有isin_codes为null"的记录直接确认

  python sc_fund_audit_tool.py --db ./sc_funds.db --batch-confirm "nav"
      → 把所有"只有nav不确定"的记录直接确认

  python sc_fund_audit_tool.py --db ./sc_funds.db --interactive
      → 按问题分组，每组一次性决策（y=全组确认/n=全组保留/s=逐条）

  python sc_fund_audit_tool.py --db ./sc_funds.db --export
      → 导出待审核记录到 audit_report.csv，方便 Excel 查看

  python sc_fund_audit_tool.py --db ./sc_funds.db --confirm-id 5,12,33
      → 直接按 fund.id 确认指定记录

  python sc_fund_audit_tool.py --db ./sc_funds.db --reject-id 7,9
      → 把指定记录改回 status=0（重新解析）
"""

import sqlite3, json, csv, sys, argparse, datetime, re
from pathlib import Path
from collections import defaultdict

# ══ 安全规则：这些问题可以自动确认（不影响核心数据完整性）══════════
AUTO_CONFIRM_RULES = [
    # 规则名                  # 匹配函数
    ("只有isin_codes为null",   lambda r: _only_null(r, {"isin_codes"})),
    ("只有bloomberg为null",    lambda r: _only_null(r, {"bloomberg_codes"})),
    ("只有nav不确定",           lambda r: _only_uncertain(r, {"nav"})),
    ("只有data_as_of不确定",   lambda r: _only_uncertain(r, {"data_as_of"})),
    ("轻微权重偏差(<±5%)",     lambda r: _only_weight_warn(r)),
    ("isin+bloomberg均null",   lambda r: _only_null(r, {"isin_codes","bloomberg_codes"})),
    ("仅ret_3m==ret_1y疑似列错位", lambda r: _only_val_err(r, "ret_3m", "ret_1y")),
    ("仅ret_ytd超出合理范围",   lambda r: _only_val_err(r, "ret_ytd")),
]

# ══ 高风险规则：这些问题不应该自动确认 ═══════════════════════════════
# 注：仅「ret_3m==ret_1y」或「ret_ytd超出」且无其他问题时，由 AUTO_CONFIRM 规则放行
HIGH_RISK_PATTERNS = [
    "ABORT",                  # 权重严重异常
    "mgmt_fee_pct",           # 费率缺失/异常（影响产品比较）
    "fund_name_cn",           # 基金名称缺失
    "investment_objective",   # 投资目标缺失
    "sc_risk_rating",         # 风险评级缺失
]


def _parse_reason(review_reason: str) -> dict:
    """解析 review_reason 字符串，返回结构化信息"""
    result = {"null_fields": set(), "uncertain_fields": set(),
              "val_errors": [], "raw": review_reason or ""}
    if not review_reason:
        return result
    for part in review_reason.split(";"):
        part = part.strip()
        if part.startswith("关键字段为null:"):
            fields = part.replace("关键字段为null:", "").strip()
            result["null_fields"] = {f.strip() for f in fields.split(",")}
        elif part.startswith("模型不确定:"):
            fields = part.replace("模型不确定:", "").strip()
            result["uncertain_fields"] = {f.strip() for f in fields.split(",")}
        elif part.startswith("校验警告:"):
            errs = part.replace("校验警告:", "").strip()
            result["val_errors"] = [e.strip() for e in errs.split(";")]
    return result


def _only_null(r: dict, allowed_nulls: set) -> bool:
    """记录的问题只是特定字段为null，没有其他问题"""
    p = _parse_reason(r["review_reason"])
    if p["uncertain_fields"] or p["val_errors"]:
        return False
    return p["null_fields"] <= allowed_nulls and bool(p["null_fields"])


def _only_uncertain(r: dict, allowed_uncertain: set) -> bool:
    """记录的问题只是特定字段不确定，没有其他问题"""
    p = _parse_reason(r["review_reason"])
    if p["null_fields"] or p["val_errors"]:
        return False
    return p["uncertain_fields"] <= allowed_uncertain and bool(p["uncertain_fields"])


def _only_val_err(r: dict, *keywords: str) -> bool:
    """仅含指定类型的校验警告（如 ret_3m==ret_1y 或 ret_ytd 超出），无 null/不确定"""
    p = _parse_reason(r["review_reason"])
    if p["null_fields"] or p["uncertain_fields"]:
        return False
    if not p["val_errors"]:
        return False
    for e in p["val_errors"]:
        if not any(k in e for k in keywords):
            return False
    return True


def _only_weight_warn(r: dict) -> bool:
    """只有轻微权重偏差警告，且偏差不超过±5%"""
    p = _parse_reason(r["review_reason"])
    if p["null_fields"] or p["uncertain_fields"]:
        return False
    if not p["val_errors"]:
        return False
    # 检查每个校验错误是否都是轻微权重偏差
    for e in p["val_errors"]:
        m = re.search(r"合计=(\d+\.?\d*)%", e)
        if not m:
            return False
        total = float(m.group(1))
        if total > 105 or total < 95:
            return False
    return True


def is_high_risk(r: dict) -> list[str]:
    """返回该记录中高风险问题列表（空=低风险）"""
    reason = r.get("review_reason") or ""
    hits = []
    for pat in HIGH_RISK_PATTERNS:
        if pat.lower() in reason.lower():
            hits.append(pat)
    return hits


def load_review_records(conn) -> list[dict]:
    rows = conn.execute("""
        SELECT f.id, f.fund_name_cn, f.sc_product_codes,
               f.review_reason, f.fund_manager_company,
               f.sc_risk_rating, f.mgmt_fee_pct, f.fund_aum_usd,
               f.isin_codes, f.parsed_at,
               pl.uncertain_fields, pl.null_key_fields,
               pl.validation_errors, pl.field_positions
        FROM funds f
        LEFT JOIN (
            SELECT source_file,
                   MAX(id) as max_id,
                   uncertain_fields, null_key_fields,
                   validation_errors, field_positions
            FROM parsing_logs
            GROUP BY source_file
        ) pl ON pl.source_file = (
            SELECT source_file FROM funds WHERE id=f.id
        )
        WHERE f.status = 2
        ORDER BY f.fund_manager_company, f.fund_name_cn
    """).fetchall()
    cols = ["id","fund_name_cn","sc_product_codes","review_reason",
            "fund_manager_company","sc_risk_rating","mgmt_fee_pct",
            "fund_aum_usd","isin_codes","parsed_at",
            "uncertain_fields","null_key_fields","validation_errors","field_positions"]
    return [dict(zip(cols, row)) for row in rows]


def cmd_diagnose(conn):
    """分析待审核记录的问题分布，给出批量处理建议"""
    records = load_review_records(conn)
    if not records:
        print("✅ 没有待审核记录")
        return

    print(f"\n{'═'*65}")
    print(f"  待审核记录诊断报告  ({len(records)} 条)")
    print(f"{'═'*65}")

    # 问题分类统计
    category_counts = defaultdict(list)
    high_risk_ids = []
    auto_confirm_ids = []

    for r in records:
        p = _parse_reason(r["review_reason"])
        hr = is_high_risk(r)

        # 确定主要问题类别
        categories = []
        if p["null_fields"]:
            categories.append(f"null字段: {', '.join(sorted(p['null_fields']))}")
        if p["uncertain_fields"]:
            categories.append(f"不确定: {', '.join(sorted(p['uncertain_fields']))}")
        if p["val_errors"]:
            short = [e[:40] for e in p["val_errors"][:2]]
            categories.append(f"校验: {'; '.join(short)}")

        cat_key = " | ".join(categories) if categories else "原因不明"
        category_counts[cat_key].append(r["id"])

        if hr:
            high_risk_ids.append((r["id"], r["fund_name_cn"], hr))

        # 检查是否符合自动确认规则
        for rule_name, rule_fn in AUTO_CONFIRM_RULES:
            if rule_fn(r):
                auto_confirm_ids.append((r["id"], rule_name))
                break

    # 打印问题分布
    print(f"\n  问题分类分布（{len(category_counts)} 类）：")
    print(f"  {'问题描述':<50} {'数量':>5}  {'ID列表'}")
    print(f"  {'─'*70}")
    for cat, ids in sorted(category_counts.items(), key=lambda x: -len(x[1])):
        id_str = ",".join(str(i) for i in ids[:8])
        if len(ids) > 8:
            id_str += f"...+{len(ids)-8}"
        print(f"  {cat:<50} {len(ids):>5}  [{id_str}]")

    # 高风险记录
    print(f"\n  🔴 高风险记录（{len(high_risk_ids)} 条，不建议自动确认）：")
    for fid, name, reasons in high_risk_ids[:15]:
        print(f"      ID{fid:>4}  {(name or '?')[:35]:<35}  ⚠ {', '.join(reasons[:2])}")
    if len(high_risk_ids) > 15:
        print(f"      ... 还有 {len(high_risk_ids)-15} 条")

    # 可自动确认
    print(f"\n  🟢 可自动确认（{len(auto_confirm_ids)} 条，问题为低风险）：")
    rule_groups = defaultdict(list)
    for fid, rule in auto_confirm_ids:
        rule_groups[rule].append(fid)
    for rule, ids in rule_groups.items():
        print(f"      [{rule}] → {len(ids)} 条  ID: {','.join(str(i) for i in ids[:10])}")

    # 剩余需要逐条看的
    auto_ids = {fid for fid, _ in auto_confirm_ids}
    hr_ids   = {fid for fid, _, _ in high_risk_ids}
    manual_ids = [r["id"] for r in records if r["id"] not in auto_ids and r["id"] not in hr_ids]

    print(f"\n  🟡 需要逐条判断（{len(manual_ids)} 条）：")
    for r in records:
        if r["id"] in manual_ids:
            name = (r["fund_name_cn"] or "?")[:35]
            reason = (r["review_reason"] or "")[:55]
            print(f"      ID{r['id']:>4}  {name:<35}  {reason}")

    print(f"\n{'─'*65}")
    print(f"  建议操作：")
    if auto_confirm_ids:
        print(f"  1. 运行 --auto 自动确认 {len(auto_confirm_ids)} 条低风险记录")
    if manual_ids:
        print(f"  2. 运行 --interactive 逐组处理 {len(manual_ids)} 条中等风险记录")
    if high_risk_ids:
        print(f"  3. 高风险 {len(high_risk_ids)} 条：建议用 --force 重新解析对应 PDF")
        hr_files = conn.execute(
            f"SELECT source_file FROM funds WHERE id IN ({','.join(str(x[0]) for x in high_risk_ids)})"
        ).fetchall()
        for f in hr_files:
            print(f"      python sc_fund_parser_qwen_v2.py --file {f[0]} --force")


def cmd_auto(conn, dry_run=False):
    """按安全规则自动确认低风险记录"""
    records = load_review_records(conn)
    to_confirm = []

    for r in records:
        for rule_name, rule_fn in AUTO_CONFIRM_RULES:
            if rule_fn(r):
                to_confirm.append((r["id"], r["fund_name_cn"], rule_name))
                break

    if not to_confirm:
        print("没有符合自动确认规则的记录")
        return

    print(f"\n  将自动确认 {len(to_confirm)} 条记录：")
    for fid, name, rule in to_confirm:
        print(f"  ✅ ID{fid:>4}  {(name or '?')[:40]:<40}  [{rule}]")

    if dry_run:
        print("\n  [DRY RUN] 未实际写入数据库。去掉 --dry-run 正式执行。")
        return

    ids = [fid for fid, _, _ in to_confirm]
    conn.execute(
        f"UPDATE funds SET status=1, review_reason=NULL "
        f"WHERE id IN ({','.join('?'*len(ids))})", ids
    )
    conn.execute(
        f"INSERT INTO parsing_logs(source_file, parsed_at, status, error_msg) "
        f"SELECT source_file, ?, 'auto_confirmed', 'batch auto-confirm' "
        f"FROM funds WHERE id IN ({','.join('?'*len(ids))})",
        [datetime.datetime.now().isoformat()] + ids
    )
    conn.commit()
    print(f"\n  ✅ 已确认 {len(to_confirm)} 条，status → 1")


def cmd_batch_confirm(conn, keyword: str):
    """把 review_reason 包含特定关键词、且只有该问题的记录批量确认"""
    records = load_review_records(conn)
    to_confirm = []

    for r in records:
        reason = r.get("review_reason") or ""
        if keyword.lower() not in reason.lower():
            continue
        # 检查是否有高风险问题
        if is_high_risk(r):
            continue
        p = _parse_reason(reason)
        # 去掉包含该关键词的问题后，是否还有其他严重问题
        remaining_null = {f for f in p["null_fields"] if keyword.lower() not in f.lower()}
        remaining_unc  = {f for f in p["uncertain_fields"] if keyword.lower() not in f.lower()}
        remaining_err  = [e for e in p["val_errors"] if keyword.lower() not in e.lower()]
        if not remaining_null and not remaining_unc and not remaining_err:
            to_confirm.append(r)

    if not to_confirm:
        print(f"没有找到只含 '{keyword}' 问题的记录")
        return

    print(f"\n  将批量确认 {len(to_confirm)} 条（问题关键词: {keyword}）：")
    for r in to_confirm:
        print(f"  ✅ ID{r['id']:>4}  {(r['fund_name_cn'] or '?')[:45]}")

    ans = input(f"\n  确认执行？[y/N] ").strip().lower()
    if ans != "y":
        print("  已取消")
        return

    ids = [r["id"] for r in to_confirm]
    conn.execute(
        f"UPDATE funds SET status=1, review_reason=NULL "
        f"WHERE id IN ({','.join('?'*len(ids))})", ids
    )
    conn.commit()
    print(f"  ✅ 已确认 {len(to_confirm)} 条")


def cmd_interactive(conn):
    """按问题类别分组，每组一次性决策"""
    records = load_review_records(conn)
    # 只处理非自动确认、非高风险的记录
    auto_ids = set()
    for r in records:
        for _, rule_fn in AUTO_CONFIRM_RULES:
            if rule_fn(r):
                auto_ids.add(r["id"])
                break
    hr_ids = {r["id"] for r in records if is_high_risk(r)}
    to_process = [r for r in records if r["id"] not in auto_ids and r["id"] not in hr_ids]

    if not to_process:
        print("没有需要手动处理的记录（建议先运行 --auto）")
        return

    # 按问题分组
    groups = defaultdict(list)
    for r in to_process:
        p = _parse_reason(r["review_reason"])
        key_parts = []
        if p["null_fields"]:
            key_parts.append("null:" + "+".join(sorted(p["null_fields"])))
        if p["uncertain_fields"]:
            key_parts.append("unc:" + "+".join(sorted(p["uncertain_fields"])))
        if p["val_errors"]:
            # 只取错误类型，不取具体数字
            err_types = []
            for e in p["val_errors"]:
                if "ret_3m" in e:    err_types.append("列错位")
                elif "合计" in e:    err_types.append("权重偏差")
                else:                err_types.append(e[:20])
            key_parts.append("err:" + "+".join(sorted(set(err_types))))
        group_key = " | ".join(key_parts) or "其他"
        groups[group_key].append(r)

    total_confirmed = total_kept = 0

    for group_key, group_records in sorted(groups.items(), key=lambda x: -len(x[1])):
        print(f"\n{'═'*65}")
        print(f"  问题类型: {group_key}")
        print(f"  共 {len(group_records)} 条记录：")
        for r in group_records:
            name = (r["fund_name_cn"] or "?")[:38]
            mgr  = r.get("fund_manager_company") or "?"
            risk = r.get("sc_risk_rating") or "?"
            print(f"    ID{r['id']:>4}  {name:<38}  [{mgr}] {risk}")

        print(f"\n  操作：y=全组确认入库 / n=全组保留待审 / s=逐条处理 / q=退出")
        ans = input("  > ").strip().lower()

        if ans == "q":
            break
        elif ans == "y":
            ids = [r["id"] for r in group_records]
            conn.execute(
                f"UPDATE funds SET status=1, review_reason=NULL "
                f"WHERE id IN ({','.join('?'*len(ids))})", ids
            )
            conn.commit()
            print(f"  ✅ 已确认 {len(group_records)} 条")
            total_confirmed += len(group_records)
        elif ans == "n":
            print(f"  ⏭  保留 {len(group_records)} 条")
            total_kept += len(group_records)
        elif ans == "s":
            # 逐条处理
            for r in group_records:
                print(f"\n  ── ID{r['id']}  {r['fund_name_cn'] or '?'}")
                print(f"     产品码: {r['sc_product_codes'] or '?'}")
                print(f"     管理费: {r['mgmt_fee_pct'] or '?'}  AUM: {r['fund_aum_usd'] or '?'}M")
                print(f"     原因:   {r['review_reason'] or '?'}")
                # 显示坐标信息
                if r.get("field_positions"):
                    try:
                        pos = json.loads(r["field_positions"])
                        if pos:
                            print(f"     坐标:   {json.dumps(pos, ensure_ascii=False)[:100]}")
                    except:
                        pass
                a = input("     y=确认 / n=保留 > ").strip().lower()
                if a == "y":
                    conn.execute("UPDATE funds SET status=1, review_reason=NULL WHERE id=?", (r["id"],))
                    conn.commit()
                    print(f"     ✅ 已确认")
                    total_confirmed += 1
                else:
                    print(f"     ⏭  保留")
                    total_kept += 1

    print(f"\n{'─'*65}")
    print(f"  交互审核完成：确认 {total_confirmed} 条，保留 {total_kept} 条")

    # 打印剩余状态
    remaining = conn.execute("SELECT COUNT(*) FROM funds WHERE status=2").fetchone()[0]
    print(f"  数据库中剩余待审核: {remaining} 条")


def cmd_confirm_ids(conn, id_str: str, *, yes: bool = False):
    """直接按 ID 确认；yes=True 时不询问直接执行"""
    ids = [int(x.strip()) for x in id_str.split(",") if x.strip().isdigit()]
    if not ids:
        print("无效ID列表")
        return
    rows = conn.execute(
        f"SELECT id, fund_name_cn FROM funds WHERE id IN ({','.join('?'*len(ids))}) AND status=2",
        ids
    ).fetchall()
    if not rows:
        print("未找到对应的待审核记录")
        return
    print(f"\n  将确认以下 {len(rows)} 条：")
    for fid, name in rows:
        print(f"  ✅ ID{fid:>4}  {name or '?'}")
    if not yes:
        ans = input("\n  确认？[y/N] ").strip().lower()
        if ans != "y":
            print("已取消")
            return
    real_ids = [r[0] for r in rows]
    conn.execute(
        f"UPDATE funds SET status=1, review_reason=NULL WHERE id IN ({','.join('?'*len(real_ids))})",
        real_ids
    )
    conn.commit()
    print(f"  ✅ 已确认 {len(real_ids)} 条")


def cmd_reject_ids(conn, id_str: str):
    """把指定记录改回 status=0（等待重新解析）"""
    ids = [int(x.strip()) for x in id_str.split(",") if x.strip().isdigit()]
    if not ids:
        return
    conn.execute(
        f"UPDATE funds SET status=0, review_reason='待重新解析' "
        f"WHERE id IN ({','.join('?'*len(ids))})", ids
    )
    conn.commit()
    print(f"  ✅ 已将 {len(ids)} 条改为 status=0（将被 --force 重新解析）")


def cmd_export(conn, output="audit_report.csv"):
    """导出待审核记录到 CSV"""
    records = load_review_records(conn)
    if not records:
        print("没有待审核记录")
        return

    fieldnames = ["id","fund_name_cn","sc_product_codes","fund_manager_company",
                  "sc_risk_rating","mgmt_fee_pct","fund_aum_usd","isin_codes",
                  "review_reason","parsed_at",
                  "null_key_fields","uncertain_fields","validation_errors",
                  "auto_confirm_rule","is_high_risk","high_risk_reasons"]

    rows = []
    for r in records:
        auto_rule = ""
        for rule_name, rule_fn in AUTO_CONFIRM_RULES:
            if rule_fn(r):
                auto_rule = rule_name
                break
        hr = is_high_risk(r)
        rows.append({
            **{k: r.get(k,"") for k in fieldnames[:13]},
            "auto_confirm_rule": auto_rule,
            "is_high_risk": "是" if hr else "否",
            "high_risk_reasons": "; ".join(hr),
        })

    with open(output, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    print(f"  ✅ 已导出 {len(rows)} 条到 {output}")


def print_status(conn):
    ok      = conn.execute("SELECT COUNT(*) FROM funds WHERE status=1").fetchone()[0]
    review  = conn.execute("SELECT COUNT(*) FROM funds WHERE status=2").fetchone()[0]
    pending = conn.execute("SELECT COUNT(*) FROM funds WHERE status=0").fetchone()[0]
    total   = conn.execute("SELECT COUNT(*) FROM funds").fetchone()[0]
    print(f"\n  数据库状态：总计 {total} | ✅正常 {ok} | ⚠️待审 {review} | 🔲待处理 {pending}")


def main():
    ap = argparse.ArgumentParser(description="SC Fund 批量审核工具")
    ap.add_argument("--db",             default="./sc_funds.db", help="数据库路径")
    ap.add_argument("--diagnose",       action="store_true",     help="诊断问题分布")
    ap.add_argument("--auto",           action="store_true",     help="自动确认低风险记录")
    ap.add_argument("--dry-run",        action="store_true",     help="仅预览，不写入")
    ap.add_argument("--batch-confirm",  metavar="KEYWORD",       help="批量确认含关键词的记录")
    ap.add_argument("--interactive",    action="store_true",     help="分组交互审核")
    ap.add_argument("--confirm-id",     metavar="IDS",           help="按ID确认（逗号分隔）")
    ap.add_argument("--yes", "-y",      action="store_true",     help="确认时不再询问，直接执行（用于脚本）")
    ap.add_argument("--reject-id",      metavar="IDS",           help="按ID退回重解析")
    ap.add_argument("--export",         action="store_true",     help="导出CSV")
    ap.add_argument("--output",         default="audit_report.csv")
    args = ap.parse_args()

    db_path = Path(args.db)
    if not db_path.exists():
        print(f"❌ 数据库不存在: {db_path}")
        sys.exit(1)

    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    print_status(conn)

    if args.diagnose:
        cmd_diagnose(conn)
    elif args.auto:
        cmd_auto(conn, dry_run=args.dry_run)
    elif args.batch_confirm:
        cmd_batch_confirm(conn, args.batch_confirm)
    elif args.interactive:
        cmd_interactive(conn)
    elif args.confirm_id:
        cmd_confirm_ids(conn, args.confirm_id, yes=args.yes)
    elif args.reject_id:
        cmd_reject_ids(conn, args.reject_id)
    elif args.export:
        cmd_export(conn, args.output)
    else:
        ap.print_help()

    conn.close()


if __name__ == "__main__":
    main()
