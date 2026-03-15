# config.py
# 统一管理所有数据库和文件路径
# 腾讯云路径为准，本地开发可通过环境变量覆盖

import os
from pathlib import Path

# 项目根目录
PROJECT_ROOT = Path(__file__).parent

# ── 腾讯云路径（生产环境）────────────────────────────────────────
# 所有数据库统一放 /root/data/ 目录，方便备份
TENCENT_DATA_DIR = Path("/root/data")

# ── 各数据库路径 ──────────────────────────────────────────────────
# fund_tagging.db：QDII 标签库（持仓打标 + 聚合结果）
FUND_TAGGING_DB = Path(
    os.environ.get("FUND_TAGGING_DB",
                   str(TENCENT_DATA_DIR / "fund_tagging.db")
                   if TENCENT_DATA_DIR.exists()
                   else str(PROJECT_ROOT / "qdii_portfolio" / "fund_tagging.db"))
)

# nav_history.db：QD 基金历史净值
NAV_HISTORY_DB = Path(
    os.environ.get("NAV_HISTORY_DB",
                   str(TENCENT_DATA_DIR / "nav_history.db")
                   if TENCENT_DATA_DIR.exists()
                   else str(PROJECT_ROOT / "data" / "nav_history.db"))
)

# market_files：MRF 的 PDF 和播客文件
MARKET_FILES_BASE = Path(
    os.environ.get("MARKET_FILES_DIR",
                   "/root/market_files"
                   if Path("/root/market_files").exists()
                   else str(PROJECT_ROOT / "market_files"))
)
MARKET_PDFS = MARKET_FILES_BASE / "pdfs"
MARKET_PODCASTS = MARKET_FILES_BASE / "podcasts"
