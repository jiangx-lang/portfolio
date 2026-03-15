"""
migrate_to_your_taxonomy.py
══════════════════════════════════════════════════════════════════
精确迁移脚本：把当前 pipeline 的 tag_id 体系完整替换为
你们 fund_tagging.db 里的 64 条 taxonomy（tag_id 1–123）

执行顺序：
  1. 重建 tag_taxonomy（64 条，保持你们的 tag_id）
  2. 把当前 holding_tag_map 的 tag_id 重映射
  3. 把当前 fund_tag_map 的 tag_id 重映射
  4. 补充你们系统有但我们未覆盖的标签规则
  5. 重新聚合

用法：
  python migrate_to_your_taxonomy.py --db fund_tagging.db --dry-run
  python migrate_to_your_taxonomy.py --db fund_tagging.db --run
  python migrate_to_your_taxonomy.py --db fund_tagging.db --run --reaggregate
  python migrate_to_your_taxonomy.py --db fund_tagging.db --verify

Note: 若 tag_taxonomy 的 category 有 CHECK 约束，需包含 'asset_class'（或先放宽约束）。
"""

import argparse
import json
import logging
import re
import sqlite3
import sys
from pathlib import Path
from collections import defaultdict

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger(__name__)


# ══════════════════════════════════════════════════════════════════
# 1. 你们完整的 64 条 Taxonomy（tag_id 严格按你文档）
# ══════════════════════════════════════════════════════════════════
# (tag_id, tag_name, category, parent_tag_id, aliases)
YOUR_TAXONOMY: list[tuple] = [
    # ── Region ──────────────────────────────────────────────────
    (1,   "US",                    "region",     None,  ["usa","united states","american","美国","美股"]),
    (2,   "Europe",                "region",     None,  ["eu","eurozone","欧洲"]),
    (3,   "Asia",                  "region",     None,  ["apac","asia pacific","亚洲"]),
    (4,   "China",                 "region",     3,     ["china mainland","中国","A股"]),
    (5,   "Japan",                 "region",     3,     ["japan","日本","日股"]),
    (6,   "Global",                "region",     None,  ["world","global markets","全球"]),
    (7,   "Emerging Markets",      "region",     None,  ["emerging markets","em","新兴市场"]),
    # ── Sector ──────────────────────────────────────────────────
    (20,  "Technology",            "sector",     None,  ["tech","it","科技"]),
    (21,  "Financials",            "sector",     None,  ["finance","banking","金融"]),
    (22,  "Healthcare",            "sector",     None,  ["health","biotech","医疗"]),
    (23,  "Industrials",           "sector",     None,  ["industrial","manufacturing","工业"]),
    (24,  "Consumer",              "sector",     None,  ["consumer discretionary","consumer staples","消费"]),
    (25,  "Energy",                "sector",     None,  ["oil","gas","能源"]),
    (26,  "Materials",             "sector",     None,  ["basic materials","metals","材料"]),
    (27,  "Utilities",             "sector",     None,  ["power","electricity","公用事业"]),
    (28,  "Real Estate",           "sector",     None,  ["reit","property","房地产"]),
    (29,  "Communication Services","sector",     None,  ["media","telecom","通信"]),
    # ── Theme: AI cluster ───────────────────────────────────────
    (40,  "AI",                    "theme",      None,  ["artificial intelligence","人工智能","生成式AI"]),
    (111, "AI Software",           "theme",      40,    ["ai software","ai application","ai platform"]),
    (112, "AI Hardware",           "theme",      40,    ["ai hardware","ai chips","ai infrastructure"]),
    (113, "AI Infrastructure",     "theme",      40,    ["ai infrastructure","datacenter","ai datacenter"]),
    (115, "AI Datacenter",         "theme",      113,   ["ai datacenter","data center"]),
    (116, "Datacenter",            "theme",      None,  ["datacenter","data center","数据中心"]),
    # ── Theme: Software & Internet ──────────────────────────────
    (41,  "SaaS",                  "theme",      None,  ["software as a service","cloud software","云软件"]),
    (43,  "Cloud",                 "theme",      None,  ["cloud computing","云计算"]),
    (44,  "Internet",              "theme",      None,  ["internet platform","在线平台"]),
    (117, "China Internet",        "theme",      4,     ["china internet","中国互联网"]),
    (118, "Enterprise Software",   "theme",      None,  ["enterprise software","企业软件"]),
    # ── Theme: Chips ────────────────────────────────────────────
    (42,  "Semiconductor",         "theme",      None,  ["chips","semis","半导体"]),
    (114, "Semiconductor Equipment","theme",     None,  ["semi equipment","semiconductor equipment"]),
    # ── Theme: Other tech ───────────────────────────────────────
    (45,  "Robotics",              "theme",      None,  ["robot","automation","机器人"]),
    (46,  "Cybersecurity",         "theme",      None,  ["security software","网络安全"]),
    # ── Theme: Real economy ─────────────────────────────────────
    (47,  "Gold",                  "theme",      None,  ["gold miners","precious metals","黄金"]),
    (48,  "Infrastructure",        "theme",      None,  ["infrastructure","基建"]),
    (49,  "Defense",               "theme",      None,  ["defense","aerospace","军工"]),
    (119, "Energy Transition",     "theme",      None,  ["energy transition","clean energy","能源转型"]),
    (120, "EV",                    "theme",      None,  ["ev","electric vehicle","电动车"]),
    (121, "Logistics",             "theme",      None,  ["logistics","物流"]),
    # ── Theme: Finance ──────────────────────────────────────────
    (122, "Insurance",             "theme",      None,  ["insurance","保险"]),
    (123, "Asset Management",      "theme",      None,  ["asset management","资产管理"]),
    # ── Style ───────────────────────────────────────────────────
    (60,  "Value",                 "style",      None,  ["value investing","价值"]),
    (61,  "Growth",                "style",      None,  ["growth investing","成长"]),
    (62,  "Blend",                 "style",      None,  ["core blend","混合"]),
    (63,  "Quality",               "style",      None,  ["high quality","高质量"]),
    (64,  "Low Vol",               "style",      None,  ["low volatility","低波动"]),
    (65,  "Income",                "style",      None,  ["income strategy","收益型"]),
    (66,  "Broad Market",          "style",      None,  ["index market","broad exposure","宽基"]),
    (67,  "Concentrated",          "style",      None,  ["high conviction","集中持仓"]),
    (68,  "Mega Cap",              "style",      None,  ["mega cap","mega-cap","large cap","超大市值"]),
    # ── Asset Class ─────────────────────────────────────────────
    (80,  "Equity",                "asset_class",None,  ["stocks","股票"]),
    (81,  "Bond",                  "asset_class",None,  ["fixed income","债券"]),
    (86,  "Investment Grade",      "asset_class",81,    ["投资级别","IG","investment grade"]),
    (87,  "Non-Investment Grade",  "asset_class",81,    ["非投资级别","高收益","垃圾债","high yield","HY"]),
    (82,  "Multi Asset",           "asset_class",None,  ["balanced","multi asset","多资产"]),
    (83,  "Commodity",             "asset_class",None,  ["commodities","大宗商品"]),
    (84,  "REIT",                  "asset_class",None,  ["real estate investment trust","房地产信托"]),
    (85,  "Money Market",          "asset_class",None,  ["cash fund","货币基金"]),
    # ── Custom ──────────────────────────────────────────────────
    (100, "halo",                  "custom",     None,  ["halo strategy"]),
    (110, "HALO",                  "custom",     None,  ["halo strategy","halo portfolio"]),
    (101, "core",                  "custom",     None,  ["core holding","核心仓"]),
    (102, "satellite",             "custom",     None,  ["satellite position","卫星仓"]),
    (103, "defensive",             "custom",     None,  ["defense portfolio","防守"]),
    (104, "aggressive",            "custom",     None,  ["aggressive strategy","进攻"]),
    (105, "watchlist",             "custom",     None,  ["watch list","观察池"]),
]

# tag_name → your_tag_id  (for rule lookup)
_NAME_TO_YOUR_ID: dict[str, int] = {row[1]: row[0] for row in YOUR_TAXONOMY}

# ── Old tag_name → new tag_id remap ─────────────────────────────
# Keys are names that exist in the current pipeline but differ in id.
# Extra entries handle our pipeline names not in your 64 but mappable.
REMAP_EXTRAS: dict[str, int] = {
    # Our name         → your tag_id
    "EM":              7,    # "Emerging Markets"
    "MiddleEast":      6,    # closest: Global (or add as custom later)
    "LatAm":           7,    # treat as EM
    "Korea":           3,    # treat as Asia region
    "Taiwan":          3,    # treat as Asia region
    "India":           7,    # treat as Emerging Markets
    "Telecom":         29,   # Communication Services
    "LowVol":          64,   # Low Vol
    "Cash":            85,   # Money Market
    "Momentum":        62,   # Blend (no exact match — keep as Blend)
    "HALO":            110,
    "halo":            100,
    "AI Hardware":     112,
    "AI Software":     111,
    "AI Infrastructure": 113,
}


# ══════════════════════════════════════════════════════════════════
# 2. Tagging rules — mapping to YOUR tag_ids
#    Covers the 10 tags not in your 64 that we want to keep
#    plus enriches coverage for Korea, Taiwan, India etc.
# ══════════════════════════════════════════════════════════════════
def _id(name: str) -> int | None:
    return _NAME_TO_YOUR_ID.get(name) or REMAP_EXTRAS.get(name)

# Rules format: (regex_pattern, tag_name_in_your_system, confidence)
EXTRA_RULES: list[tuple[str, str, float]] = [
    # Korea → Asia (3)
    (r"SAMSUNG ELECTRONICS|SK HYNIX|HD HYUNDAI|HYUNDAI\b|KAKAO\b|NAVER\b|CELLTRION|LG \b",
     "Asia", 0.90),
    # Taiwan → Asia (3)
    (r"TAIWAN SEMICONDUCTOR|TSMC\b|TAIWAN SEMICONDUCTOR MANUFACTU|TAIWAN SEMICONDUCTOR-SP ADR",
     "Asia", 0.90),
    # India → Emerging Markets (7)
    (r"\bHDFC\b|\bRELIANCE\b|\bINFOSYS\b|BHARTI AIRTEL|TATA\b|\bWIPRO\b|ICICI BANK",
     "Emerging Markets", 0.90),
    # MiddleEast energy → Energy sector + HALO
    (r"\bARAMCO\b|SAUDI ARAMCO|ADNOC\b",
     "Energy", 1.00),
    (r"\bARAMCO\b|SAUDI ARAMCO",
     "HALO", 0.85),
    # Gold theme (47)
    (r"GOLD\b|AGNICO EAGLE|BARRICK|NEWMONT|FRANCO.NEVADA|WHEATON PRECIOUS",
     "Gold", 0.95),
    # Infrastructure theme (48)
    (r"AIRPORT|PIPELINE|AMERICAN ELECTRIC POWER|CENTERPPOINT|CHENIERE"
     r"|NATIONAL GRID|TRANSURBAN|ATLAS ARTERIA",
     "Infrastructure", 0.90),
    # AI Datacenter (115)
    (r"EQUINIX\b|DIGITAL REALTY|IRON MOUNTAIN|CYRUSONE\b",
     "AI Datacenter", 0.95),
    # HALO custom (110) — AI hardware
    (r"\bNVIDIA\b|\bASML\b|TAIWAN SEMICONDUCTOR|\bAMD\b|\bBROADCOM\b|\bSK HYNIX\b",
     "HALO", 0.85),
    # HALO — infrastructure/hard assets
    (r"REIT\b|REAL ESTATE INVESTMENT|AIRPORT|PIPELINE|AMERICAN ELECTRIC POWER"
     r"|EQUINIX\b|DIGITAL REALTY",
     "HALO", 0.80),
    # Low Vol (64)
    (r"TREASURY|USTN|USTB|US T \d|GOVT BOND|ISHARES.*GOVT|BUND|GILTS",
     "Low Vol", 0.90),
    # Investment Grade (86) — IG bond indicators
    (r"INVESTMENT GRADE|IG BOND|ISHARES.*CORP BOND|ISHARES.*TREASURY"
     r"|AAAAAA.*REGS|BBB.*MTN",
     "Investment Grade", 0.80),
    # Non-Investment Grade (87) — HY
    (r"HIGH YIELD|HY BOND|PIK REGS|NON.INVESTMENT|JUNK BOND",
     "Non-Investment Grade", 0.85),
    # Communication Services (29)
    (r"\bNETFLIX\b|\bSPOTIFY\b|\bTWITTER\b|\bSNAP\b|COMCAST\b|VERIZON\b",
     "Communication Services", 0.85),
    # Blend style (62) — diversified / multi-asset holdings
    (r"ISHARES.*MSCI WORLD|ISHARES.*ALL WORLD|VANGUARD.*WORLD",
     "Blend", 0.85),
    # REIT asset_class (84)
    (r"REIT\b|REAL ESTATE INVESTMENT TRUST|CAPITALAND.*REIT|KEPPEL.*REIT"
     r"|LINK.*REIT|EMBASSY.*REIT|AGREE.*REIT|CAMDEN.*REIT|EQUITY.*REIT",
     "REIT", 0.95),
]


# ══════════════════════════════════════════════════════════════════
# 3. Build complete old→new tag_id remap from DB + extras
# ══════════════════════════════════════════════════════════════════
def build_id_remap(conn: sqlite3.Connection) -> dict[int, int]:
    """
    Returns {old_tag_id: new_tag_id} for all tags currently in the DB.
    """
    old_rows = conn.execute(
        "SELECT tag_id, tag_name FROM tag_taxonomy"
    ).fetchall()

    remap: dict[int, int] = {}
    no_match: list[str] = []

    for row in old_rows:
        old_id   = row["tag_id"]
        tag_name = row["tag_name"]
        # Direct name match
        new_id = _NAME_TO_YOUR_ID.get(tag_name)
        if new_id is None:
            new_id = REMAP_EXTRAS.get(tag_name)
        if new_id is not None:
            remap[old_id] = new_id
        else:
            no_match.append(f"  {old_id} → {tag_name}")

    if no_match:
        log.warning("Tags with no mapping (will be dropped):\n%s", "\n".join(no_match))
    return remap


# ══════════════════════════════════════════════════════════════════
# 4. Migration
# ══════════════════════════════════════════════════════════════════
def migrate(conn: sqlite3.Connection, dry_run: bool = False) -> None:
    remap = build_id_remap(conn)

    log.info("Tag id remap: %d entries", len(remap))
    for old, new in sorted(remap.items()):
        log.debug("  %d → %d", old, new)

    if dry_run:
        log.info("[DRY RUN] No changes written.")
        _print_remap_summary(conn, remap)
        return

    # ── A. Snapshot current holding_tag_map with remapped ids ────
    old_htm = conn.execute(
        "SELECT holding_name_std, tag_id, confidence_score, source FROM holding_tag_map"
    ).fetchall()

    remapped_htm: list[tuple] = []
    skipped_htm = 0
    for row in old_htm:
        new_id = remap.get(row["tag_id"])
        if new_id is None:
            skipped_htm += 1
            continue
        remapped_htm.append((row["holding_name_std"], new_id,
                              row["confidence_score"], row["source"]))
    log.info("holding_tag_map: %d rows to migrate, %d skipped", len(remapped_htm), skipped_htm)

    # ── B. Snapshot current fund_tag_map with remapped ids ───────
    old_ftm = conn.execute(
        "SELECT fund_id, tag_id, aggregated_score, explanation FROM fund_tag_map"
    ).fetchall()

    remapped_ftm: list[tuple] = []
    skipped_ftm = 0
    for row in old_ftm:
        new_id = remap.get(row["tag_id"])
        if new_id is None:
            skipped_ftm += 1
            continue
        remapped_ftm.append((row["fund_id"], new_id,
                              row["aggregated_score"], row["explanation"]))
    log.info("fund_tag_map: %d rows to migrate, %d skipped", len(remapped_ftm), skipped_ftm)

    # ── C. Rebuild taxonomy with YOUR tag_ids ────────────────────
    conn.execute("DELETE FROM fund_tag_map")
    conn.execute("DELETE FROM holding_tag_map")
    conn.execute("DELETE FROM tag_taxonomy")
    log.info("Cleared all three tables")

    # Insert taxonomy (no parent_tag_id first)
    for tag_id, tag_name, category, parent_id, aliases in YOUR_TAXONOMY:
        conn.execute("""
            INSERT INTO tag_taxonomy(tag_id, tag_name, category, aliases)
            VALUES(?,?,?,?)
            ON CONFLICT(tag_id) DO UPDATE SET
                tag_name=excluded.tag_name,
                category=excluded.category,
                aliases=excluded.aliases
        """, (tag_id, tag_name, category,
              json.dumps(aliases, ensure_ascii=False)))

    # Set parent_tag_id in second pass
    for tag_id, tag_name, category, parent_id, aliases in YOUR_TAXONOMY:
        if parent_id is not None:
            conn.execute(
                "UPDATE tag_taxonomy SET parent_tag_id=? WHERE tag_id=?",
                (parent_id, tag_id)
            )
    log.info("Inserted %d taxonomy tags", len(YOUR_TAXONOMY))

    # ── D. Restore holding_tag_map (remapped ids) ─────────────────
    conn.executemany("""
        INSERT INTO holding_tag_map(holding_name_std, tag_id, confidence_score, source)
        VALUES(?,?,?,?)
        ON CONFLICT(holding_name_std, tag_id) DO UPDATE SET
            confidence_score=MAX(confidence_score, excluded.confidence_score)
    """, remapped_htm)
    log.info("Restored %d holding_tag_map rows", len(remapped_htm))

    # ── E. Apply extra rules for new tags ─────────────────────────
    extra_rows = _apply_extra_rules(conn)
    log.info("Extra rules: %d new (holding,tag) rows", extra_rows)

    # ── F. Restore fund_tag_map (remapped ids) ────────────────────
    conn.executemany("""
        INSERT INTO fund_tag_map(fund_id, tag_id, aggregated_score, explanation)
        VALUES(?,?,?,?)
        ON CONFLICT(fund_id, tag_id) DO UPDATE SET
            aggregated_score=excluded.aggregated_score,
            explanation=excluded.explanation
    """, remapped_ftm)
    log.info("Restored %d fund_tag_map rows", len(remapped_ftm))

    conn.commit()
    log.info("Migration committed.")


def _apply_extra_rules(conn: sqlite3.Connection) -> int:
    """Apply EXTRA_RULES to all holdings in fund_holding_exposure."""
    compiled = []
    for pattern, tag_name, conf in EXTRA_RULES:
        tag_id = _NAME_TO_YOUR_ID.get(tag_name)
        if tag_id is None:
            log.warning("Extra rule tag '%s' not found — skip", tag_name)
            continue
        compiled.append((re.compile(pattern, re.IGNORECASE), tag_id, conf))

    # fund_holding_exposure may not have holding_type in older DBs
    try:
        holdings = conn.execute(
            "SELECT DISTINCT holding_name_std FROM fund_holding_exposure"
        ).fetchall()
    except Exception:
        holdings = []
    rows: list[tuple] = []
    seen: set[tuple] = set()
    for h in holdings:
        std = h["holding_name_std"]
        for pat, tag_id, conf in compiled:
            if pat.search(std):
                key = (std, tag_id)
                if key not in seen:
                    rows.append((std, tag_id, conf, "rule"))
                    seen.add(key)

    if rows:
        conn.executemany("""
            INSERT INTO holding_tag_map(holding_name_std, tag_id, confidence_score, source)
            VALUES(?,?,?,?)
            ON CONFLICT(holding_name_std, tag_id) DO UPDATE SET
                confidence_score=MAX(confidence_score, excluded.confidence_score)
        """, rows)
    return len(rows)


# ══════════════════════════════════════════════════════════════════
# 5. Re-aggregation
# ══════════════════════════════════════════════════════════════════
def reaggregate(db_path: str) -> int:
    root = Path(db_path).resolve().parent
    if str(root) not in sys.path:
        sys.path.insert(0, str(root))
    import fund_tagging.db as ftdb
    ftdb.configure(db_path)
    from fund_tagging.aggregation import recalculate_all_funds
    return recalculate_all_funds()


# ══════════════════════════════════════════════════════════════════
# 6. Verification
# ══════════════════════════════════════════════════════════════════
def verify(conn: sqlite3.Connection) -> None:
    print("\n" + "═" * 68)
    print("  Verification Report")
    print("═" * 68)

    # Taxonomy
    cats = conn.execute("""
        SELECT category, COUNT(*) n FROM tag_taxonomy GROUP BY category ORDER BY category
    """).fetchall()
    total_tags = sum(r["n"] for r in cats)
    print(f"\n  tag_taxonomy: {total_tags} tags")
    for r in cats:
        print(f"    {r['category']:<15} {r['n']:>3}")

    # Key tag check
    print("\n  Key tag_id verification:")
    for tag_id, name in [(1,"US"),(4,"China"),(40,"AI"),(110,"HALO"),
                          (80,"Equity"),(81,"Bond"),(112,"AI Hardware"),(111,"AI Software")]:
        row = conn.execute(
            "SELECT tag_id, tag_name, category FROM tag_taxonomy WHERE tag_id=?",
            (tag_id,)
        ).fetchone()
        if row:
            match = "✅" if row["tag_name"] == name else f"⚠️ got {row['tag_name']}"
            print(f"    tag_id={tag_id:<4} {match} {row['tag_name']}")
        else:
            print(f"    tag_id={tag_id:<4} ❌ NOT FOUND")

    # Coverage
    tagged = conn.execute(
        "SELECT COUNT(DISTINCT holding_name_std) FROM holding_tag_map"
    ).fetchone()[0]
    total  = conn.execute(
        "SELECT COUNT(DISTINCT holding_name_std) FROM fund_holding_exposure"
    ).fetchone()[0]
    pairs  = conn.execute("SELECT COUNT(*) FROM holding_tag_map").fetchone()[0]
    pct = (tagged / total * 100) if total else 0
    print(f"\n  holding_tag_map: {tagged}/{total} holdings ({pct:.0f}%),  {pairs} pairs")

    # fund_tag_map
    funds  = conn.execute("SELECT COUNT(DISTINCT fund_id) FROM fund_tag_map").fetchone()[0]
    ftotal = conn.execute("SELECT COUNT(*) FROM fund_tag_map").fetchone()[0]
    print(f"  fund_tag_map:    {funds} funds,  {ftotal} rows")

    # Tag coverage leaderboard
    print(f"\n  Top 20 tags by fund coverage:")
    print(f"  {'tag_id':>7}  {'tag_name':<28} {'cat':10} {'funds':>6}  {'avg%':>8}")
    print("  " + "─" * 65)
    rows = conn.execute("""
        SELECT tt.tag_id, tt.tag_name, tt.category,
               COUNT(DISTINCT ftm.fund_id) AS fund_count,
               ROUND(AVG(ftm.aggregated_score),2) AS avg_score
        FROM fund_tag_map ftm
        JOIN tag_taxonomy tt ON tt.tag_id=ftm.tag_id
        GROUP BY ftm.tag_id
        ORDER BY fund_count DESC
        LIMIT 20
    """).fetchall()
    for r in rows:
        print(f"  {r['tag_id']:>7}  {r['tag_name']:<28} {r['category']:<10} "
              f"{r['fund_count']:>6}  {r['avg_score']:>8.2f}%")

    # Sample search: HALO
    print(f"\n  Sample search — HALO (tag_id=110), top 5 funds:")
    halo_funds = conn.execute("""
        SELECT ftm.fund_id, ftm.aggregated_score, ftm.explanation
        FROM fund_tag_map ftm
        WHERE ftm.tag_id=110
        ORDER BY ftm.aggregated_score DESC LIMIT 5
    """).fetchall()
    for r in halo_funds:
        expl = json.loads(r["explanation"] or "{}")
        top3 = sorted(expl.items(), key=lambda x: -x[1])[:3]
        driven = ", ".join(f"{h}:{c:.1f}%" for h, c in top3)
        print(f"    fund_id={r['fund_id']:>4}  score={r['aggregated_score']:>7.2f}%  ← {driven}")


def _print_remap_summary(conn: sqlite3.Connection, remap: dict[int, int]) -> None:
    print("\n  Remap summary (old_id → new_id  tag_name):")
    for row in conn.execute("SELECT tag_id, tag_name FROM tag_taxonomy ORDER BY tag_id"):
        new = remap.get(row["tag_id"], "—")
        print(f"  {row['tag_id']:>4} → {str(new):>4}   {row['tag_name']}")


# ══════════════════════════════════════════════════════════════════
# CLI
# ══════════════════════════════════════════════════════════════════
def main() -> None:
    ap = argparse.ArgumentParser(description="Migrate to your 64-tag taxonomy")
    ap.add_argument("--db",          required=True, help="Path to fund_tagging.db")
    ap.add_argument("--dry-run",     action="store_true", help="Preview remap, no writes")
    ap.add_argument("--run",         action="store_true", help="Execute migration")
    ap.add_argument("--reaggregate", action="store_true", help="Re-run aggregation after migrate")
    ap.add_argument("--verify",      action="store_true", help="Print verification report")
    args = ap.parse_args()

    conn = sqlite3.connect(args.db)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys=OFF")   # allow id reshuffling
    conn.execute("PRAGMA journal_mode=WAL")

    try:
        if args.dry_run:
            migrate(conn, dry_run=True)

        elif args.run:
            migrate(conn, dry_run=False)
            if args.reaggregate:
                log.info("Re-aggregating...")
                total = reaggregate(args.db)
                log.info("Aggregation complete: %d fund_tag_map rows", total)
            verify(conn)

        elif args.verify:
            verify(conn)

        else:
            ap.print_help()
    finally:
        conn.close()


if __name__ == "__main__":
    main()
