#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
独立 WMP 净值抓取：复用仓库根目录 wmp_scraper / wmp_csv，写入 data/wmp_history.csv。
供 crontab 与 Next.js /api/admin/scrape-wmp 调用。

布局：…/portfolio/mf-holdings-dashboard/scripts/scrape_wmp.py → 仓库根 = scripts 上两级目录。
"""
from __future__ import annotations

import json
import sys
import traceback
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

# 仓库根（含 wmp_scraper.py、wmp_csv.py、data/）
REPO_ROOT = Path(__file__).resolve().parent.parent.parent
LOG_DIR = REPO_ROOT / "logs"
LOG_FILE = LOG_DIR / "wmp_scraper.log"
TZ_SH = ZoneInfo("Asia/Shanghai")


def _ts() -> str:
    return datetime.now(TZ_SH).strftime("%Y-%m-%d %H:%M:%S")


def log_error(msg: str) -> None:
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    line = f"[{_ts()}] [ERROR] {msg}\n"
    try:
        with open(LOG_FILE, "a", encoding="utf-8") as f:
            f.write(line)
    except OSError:
        pass
    print(line, end="", file=sys.stderr)


def log_info(msg: str) -> None:
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    line = f"[{_ts()}] [INFO] {msg}\n"
    try:
        with open(LOG_FILE, "a", encoding="utf-8") as f:
            f.write(line)
    except OSError:
        pass


def emit_result(
    *,
    success: bool,
    message: str,
    written: int = 0,
    scraped: int = 0,
    skipped: bool = False,
) -> None:
    payload = {
        "success": success,
        "message": message,
        "written": written,
        "scraped": scraped,
        "skipped": skipped,
    }
    print("__WMP_JSON__" + json.dumps(payload, ensure_ascii=False), flush=True)


def main() -> int:
    sys.path.insert(0, str(REPO_ROOT))
    try:
        from wmp_scraper import scrape_wmp
        from wmp_csv import append_wmp_records, read_wmp_csv
    except Exception as e:
        log_error(f"import failed: {e}\n{traceback.format_exc()}")
        emit_result(success=False, message=f"导入失败: {e}", written=0, scraped=0)
        return 1

    today = datetime.now(TZ_SH).strftime("%Y-%m-%d")

    try:
        existing = read_wmp_csv()
        if not existing.empty and "date" in existing.columns:
            dates = existing["date"].astype(str).str.strip()
            if (dates == today).any():
                msg = f"跳过：CSV 已含今日 {today} 数据，不重复抓取"
                log_info(msg)
                print(msg, flush=True)
                emit_result(
                    success=True,
                    message=msg,
                    written=0,
                    scraped=0,
                    skipped=True,
                )
                return 0
    except Exception as e:
        log_error(f"read_wmp_csv: {e}\n{traceback.format_exc()}")
        emit_result(success=False, message=f"读取 CSV 失败: {e}", written=0, scraped=0)
        return 1

    try:
        records = scrape_wmp()
    except Exception as e:
        log_error(f"scrape_wmp: {e}\n{traceback.format_exc()}")
        emit_result(success=False, message=f"抓取异常: {e}", written=0, scraped=0)
        return 1

    y = len(records)
    if not records:
        msg = "未抓取到数据，请检查网络或页面结构是否变更"
        log_error(msg)
        print(msg, flush=True)
        emit_result(success=False, message=msg, written=0, scraped=0)
        return 1

    try:
        n = append_wmp_records(records)
    except Exception as e:
        log_error(f"append_wmp_records: {e}\n{traceback.format_exc()}")
        emit_result(
            success=False,
            message=f"写入 CSV 失败: {e}",
            written=0,
            scraped=y,
        )
        return 1

    summary = f"已写入 {n} 条新记录（共抓取 {y} 条）"
    print(summary, flush=True)
    log_info(summary)
    emit_result(success=True, message=summary, written=n, scraped=y, skipped=False)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
