"""
Database connection and schema init for fund tagging.
SQLite by default; use same API with a different driver for PostgreSQL.
"""
import sqlite3
from pathlib import Path


def get_connection(db_path: str | Path):
    """Return a connection to the tagging DB. Default: in-memory or file."""
    path = Path(db_path)
    conn = sqlite3.connect(str(path))
    conn.row_factory = sqlite3.Row
    return conn


def init_schema(conn):
    """Execute schema.sql to create tables. Idempotent."""
    schema_path = Path(__file__).parent / "schema.sql"
    sql = schema_path.read_text(encoding="utf-8")
    conn.executescript(sql)
    conn.commit()
