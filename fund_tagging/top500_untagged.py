"""
从真实基金持仓统计 Top-N 持仓频率，找出尚未在 holding_tag_map 中打标的公司。
用于自动补齐到 Top-500：先得到未打标列表，再通过规则/LLM 分类后插入 holding_tag_map。
"""
import csv
from pathlib import Path
from typing import List, Tuple



def get_top_holdings_by_frequency(conn, limit: int = 500) -> List[Tuple[str, int]]:
    """
    从 fund_holding_exposure 统计持仓出现次数，降序取前 limit 个。
    返回 [(holding_name_std, freq), ...]。
    """
    rows = conn.execute(
        """
        SELECT holding_name_std, COUNT(*) AS freq
        FROM fund_holding_exposure
        GROUP BY holding_name_std
        ORDER BY freq DESC
        LIMIT ?
        """,
        (limit,),
    ).fetchall()
    return [(r[0], r[1]) for r in rows]


def get_untagged_holdings(conn, limit: int = 500) -> List[Tuple[str, int]]:
    """
    在 Top-{limit} 持仓中，找出尚未在 holding_tag_map 中有任何标签的 holding。
    返回 [(holding_name_std, freq), ...]，便于后续用规则/LLM 打标。
    """
    top = get_top_holdings_by_frequency(conn, limit=limit)
    tagged = {
        r[0]
        for r in conn.execute(
            "SELECT DISTINCT holding_name_std FROM holding_tag_map"
        ).fetchall()
    }
    return [(h, f) for h, f in top if h not in tagged]


def export_untagged_to_csv(conn, limit: int = 500, out_path: str | Path = None) -> str | None:
    """
    将未打标持仓导出为 CSV（holding,freq），便于人工或 LLM 补标签后导入。
    若 out_path 为 None，写入 fund_tagging/stock_tag_untagged.csv。
    返回写入路径。
    """
    rows = get_untagged_holdings(conn, limit=limit)
    if not rows:
        return None
    path = Path(out_path) if out_path else Path(__file__).parent / "stock_tag_untagged.csv"
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8", newline="") as f:
        w = csv.writer(f)
        w.writerow(["holding", "freq"])
        w.writerows(rows)
    return str(path)
