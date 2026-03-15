"""
Single source of truth for database connections.
All other modules import `get_conn` from here.
"""

import sqlite3
from pathlib import Path

_DB_PATH: Path | None = None


def configure(db_path: str | Path) -> None:
    """Call once at startup with the chosen SQLite file path."""
    global _DB_PATH
    _DB_PATH = Path(db_path)


def get_conn() -> sqlite3.Connection:
    """
    Return a thread-local connection with:
      - WAL mode enabled
      - foreign keys ON
      - row_factory set so rows are accessible by column name
    """
    if _DB_PATH is None:
        raise RuntimeError("Call db.configure(path) before using get_conn().")
    conn = sqlite3.connect(_DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_schema() -> None:
    """Create all tables from schema.sql if they don't already exist."""
    schema_file = Path(__file__).parent / "schema.sql"
    sql = schema_file.read_text(encoding="utf-8")
    conn = get_conn()
    try:
        conn.executescript(sql)
    finally:
        conn.close()
