# -*- coding: utf-8 -*-
"""共享工具：基于 extract_words() 坐标的行合并，供各解析器复用。"""

from typing import Any


def group_words_to_rows(
    words: list[dict[str, Any]],
    y_tol: float = 5,
) -> list[list[str]]:
    """
    将 extract_words() 得到的 word 列表按 top 合并为行（top 差 <= y_tol 为同一行），
    行内按 x0 排序，返回 [[token, ...], ...]。
    """
    if not words:
        return []
    out: list[list[str]] = []
    sorted_w = sorted(words, key=lambda w: (w.get("top", 0), w.get("x0", 0)))
    row_y: float = sorted_w[0].get("top", 0)
    row: list[tuple[float, str]] = []
    for w in sorted_w:
        top = w.get("top", 0)
        text = (w.get("text") or "").strip()
        if not text:
            continue
        if top - row_y <= y_tol:
            row.append((w.get("x0", 0), text))
        else:
            if row:
                row.sort(key=lambda x: x[0])
                out.append([t for _, t in row])
            row = [(w.get("x0", 0), text)]
            row_y = top
    if row:
        row.sort(key=lambda x: x[0])
        out.append([t for _, t in row])
    return out
