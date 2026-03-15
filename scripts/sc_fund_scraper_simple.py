"""
渣打 QDII 基金 PDF 简单爬虫
============================
URL 规律：https://av.sc.com/cn/content/docs/cn-fs-{qdur|qdut}{三位数字}.pdf
直接枚举 qdur001~qdur200、qdut001~qdut200，HEAD 探测存在则下载，无需 Playwright。

运行：在项目根目录  py -3 scripts/sc_fund_scraper_simple.py
"""

import random
import time
from pathlib import Path
from typing import Optional

import requests
from tqdm import tqdm

BASE_URL = "https://av.sc.com/cn/content/docs/"
SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent
OUTPUT_DIR = PROJECT_ROOT / "sc_funds_pdf_v2"
DELAY_PROBE = 0.5   # 探测间隔（秒）
DELAY_DOWNLOAD = (1.2, 2.8)  # 下载间隔随机范围

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36",
    "Accept": "application/pdf,*/*",
    "Referer": "https://www.sc.com/cn/investment/qdii-series/global-fund-selection/",
}


def probe_url(session: requests.Session, prefix: str, num: int) -> Optional[str]:
    """HEAD 请求，存在返回 URL，否则返回 None"""
    url = f"{BASE_URL}{prefix}{num:03d}.pdf"
    try:
        r = session.head(url, timeout=10, allow_redirects=True)
        if r.status_code == 200:
            return url
    except Exception:
        pass
    return None


def download_one(session: requests.Session, url: str, out_dir: Path) -> tuple[bool, str]:
    """下载一个 PDF，返回 (成功, 消息)"""
    name = url.split("/")[-1]
    path = out_dir / name
    if path.exists() and path.stat().st_size > 1024:
        return True, f"skip {name}"

    time.sleep(random.uniform(*DELAY_DOWNLOAD))
    try:
        r = session.get(url, timeout=25, stream=True)
        r.raise_for_status()
        path.write_bytes(r.content)
        return True, f"ok {name} ({path.stat().st_size / 1024:.0f} KB)"
    except Exception as e:
        return False, f"fail {name} -> {e}"


def main():
    out_dir = OUTPUT_DIR
    out_dir.mkdir(parents=True, exist_ok=True)
    session = requests.Session()
    session.headers.update(HEADERS)

    # 1. 枚举探测：qdur001~qdur200, qdut001~qdut200（数字最多到 200）
    print("[*] 探测 cn-fs-qdur001~200 与 cn-fs-qdut001~200 ...")
    found = []
    for prefix in ["cn-fs-qdur", "cn-fs-qdut"]:
        for i in range(1, 201):
            u = probe_url(session, prefix, i)
            if u:
                found.append(u)
            time.sleep(DELAY_PROBE)

    found = sorted(set(found))
    print(f"[OK] 发现 {len(found)} 个有效 PDF 链接")

    if not found:
        print("[!] 未发现任何链接，请检查网络或 BASE_URL")
        return

    # 2. 逐个下载
    print(f"[*] 下载到 {out_dir.resolve()} ...")
    ok, fail = 0, 0
    for url in tqdm(found, desc="下载"):
        success, msg = download_one(session, url, out_dir)
        if success:
            ok += 1
        else:
            fail += 1
            tqdm.write(f"  {msg}")

    print(f"\n[OK] 成功: {ok}  失败: {fail}  目录: {out_dir.resolve()}")


if __name__ == "__main__":
    main()
