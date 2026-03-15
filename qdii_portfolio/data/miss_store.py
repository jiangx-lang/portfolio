"""
data/miss_store.py
未命中主题持久化 — 存在 SQLite 的 miss_log 表
（复用 fund_tagging.db，加一张轻量表）
"""

import datetime
from pathlib import Path

_APP_ROOT = Path(__file__).resolve().parent.parent
if str(_APP_ROOT) not in __import__("sys").path:
    __import__("sys").path.insert(0, str(_APP_ROOT))
if str(_APP_ROOT.parent) not in __import__("sys").path:
    __import__("sys").path.insert(0, str(_APP_ROOT.parent))

from fund_tagging.db import get_conn


def _ensure_table():
    conn = get_conn()
    conn.execute("""
        CREATE TABLE IF NOT EXISTS miss_log (
            id      INTEGER PRIMARY KEY AUTOINCREMENT,
            query   TEXT NOT NULL,
            source  TEXT DEFAULT 'search',
            ts      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
        )
    """)
    conn.commit()
    conn.close()


def log_miss(query: str, source: str = "search") -> None:
    """Record a miss. Deduplicates by query within same day."""
    if not query or not str(query).strip():
        return
    _ensure_table()
    today = datetime.date.today().isoformat()
    conn  = get_conn()
    try:
        exists = conn.execute(
            "SELECT 1 FROM miss_log WHERE query=? AND ts LIKE ?",
            (query.strip(), f"{today}%")
        ).fetchone()
        if not exists:
            conn.execute(
                "INSERT INTO miss_log(query, source) VALUES(?,?)",
                (query.strip(), source)
            )
            conn.commit()
    finally:
        conn.close()


def get_miss_log(limit: int = 500) -> list[dict]:
    _ensure_table()
    conn = get_conn()
    try:
        rows = conn.execute(
            "SELECT id, query, source, ts FROM miss_log ORDER BY ts DESC LIMIT ?",
            (limit,)
        ).fetchall()
        return [dict(zip(r.keys(), r)) for r in rows]
    finally:
        conn.close()


def clear_miss_log() -> None:
    _ensure_table()
    conn = get_conn()
    try:
        conn.execute("DELETE FROM miss_log")
        conn.commit()
    finally:
        conn.close()


def delete_miss_entry(entry_id: int) -> None:
    conn = get_conn()
    try:
        conn.execute("DELETE FROM miss_log WHERE id=?", (entry_id,))
        conn.commit()
    finally:
        conn.close()
