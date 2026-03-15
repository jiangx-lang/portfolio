"""
渣打银行 QDII 全球基金系列 PDF 爬虫
=====================================
策略：
  1. 先用 Playwright 渲染页面，抓取所有 PDF 链接（动态加载内容）
  2. 如果 Playwright 抓不全，补充按规律批量尝试 cn-fs-qdut001 ~ cn-fs-qdut300
  3. 并发下载所有 PDF 到本地 sc_funds_pdf/ 目录（项目根目录下）

依赖（见项目 requirements.txt）：
  pip install playwright requests tqdm
  playwright install chromium

运行（在项目根目录）：
  python scripts/sc_fund_scraper.py
  或仅用规律探测（不装 Playwright）：python scripts/sc_fund_scraper.py --probe-only
"""

import argparse
import asyncio
import re
import time
from pathlib import Path
from urllib.parse import urlparse

import requests
from tqdm import tqdm

# 输出目录：项目根目录下的 sc_funds_pdf
SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent

# ── 配置 ──────────────────────────────────────────────────────────
TARGET_URL = "https://www.sc.com/cn/investment/qdii-series/global-fund-selection/"
PDF_BASE_URL = "https://av.sc.com/cn/content/docs/"
OUTPUT_DIR = PROJECT_ROOT / "sc_funds_pdf"
MAX_WORKERS = 5
REQUEST_DELAY = 0.8

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/122.0.0.0 Safari/537.36"
    ),
    "Referer": "https://www.sc.com/cn/investment/qdii-series/global-fund-selection/",
    "Accept": "application/pdf,*/*",
}


async def fetch_pdf_links_playwright() -> set:
    """渲染页面，提取所有 av.sc.com .pdf 链接"""
    try:
        from playwright.async_api import async_playwright
    except ImportError:
        print("[!] Playwright 未安装，跳过动态页面抓取")
        return set()

    pdf_links = set()
    print("[*] 启动 Playwright 渲染页面...")

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent=HEADERS["User-Agent"],
            locale="zh-CN",
        )
        page = await context.new_page()

        async def intercept(request):
            url = request.url
            if "av.sc.com" in url and url.endswith(".pdf"):
                pdf_links.add(url)

        page.on("request", intercept)

        try:
            await page.goto(TARGET_URL, wait_until="networkidle", timeout=60000)
            await page.wait_for_timeout(3000)

            for _ in range(5):
                await page.evaluate("window.scrollBy(0, window.innerHeight)")
                await page.wait_for_timeout(800)

            hrefs = await page.eval_on_selector_all(
                "a[href*='.pdf'], a[href*='av.sc.com']",
                "els => els.map(e => e.href)",
            )
            for href in hrefs:
                if "av.sc.com" in href and href.endswith(".pdf"):
                    pdf_links.add(href)

            content = await page.content()
            found = re.findall(r'https://av\.sc\.com/cn/content/docs/[^\s"\'<>]+\.pdf', content)
            pdf_links.update(found)

        except Exception as e:
            print(f"[WARN] Playwright 渲染出错: {e}")
        finally:
            await browser.close()

    print(f"[OK] Playwright 找到 {len(pdf_links)} 个 PDF 链接")
    return pdf_links


def probe_sequential_urls() -> set:
    """已知 PDF URL 规律：cn-fs-qdut001.pdf ~ cn-fs-qdutNNN.pdf，HEAD 探测"""
    print("\n[*] 开始探测规律 URL (cn-fs-qdut001 ~ cn-fs-qdut300)...")
    found = set()
    session = requests.Session()
    session.headers.update(HEADERS)

    for i in range(1, 301):
        code = f"cn-fs-qdut{i:03d}"
        url = f"{PDF_BASE_URL}{code}.pdf"
        try:
            r = session.head(url, timeout=8, allow_redirects=True)
            if r.status_code == 200:
                found.add(url)
                print(f"  [OK] {code}.pdf")
            elif r.status_code == 404:
                pass
            else:
                print(f"  [WARN] {code}.pdf -> HTTP {r.status_code}")
        except Exception as e:
            print(f"  [FAIL] {code}.pdf -> {e}")
        time.sleep(REQUEST_DELAY)

    print(f"[OK] 规律探测找到 {len(found)} 个 PDF")
    return found


def download_pdf(url: str, output_dir: Path) -> tuple[bool, str]:
    """下载单个 PDF，返回 (成功?, 消息)"""
    filename = urlparse(url).path.split("/")[-1]
    out_path = output_dir / filename

    if out_path.exists() and out_path.stat().st_size > 1024:
        return True, f"跳过（已存在）: {filename}"

    try:
        session = requests.Session()
        session.headers.update(HEADERS)
        r = session.get(url, timeout=30, stream=True)
        r.raise_for_status()

        content_type = r.headers.get("Content-Type", "")
        if "pdf" not in content_type.lower() and len(r.content) < 1024:
            return False, f"非PDF内容: {filename}"

        out_path.write_bytes(r.content)
        size_kb = out_path.stat().st_size / 1024
        return True, f"[OK] {filename} ({size_kb:.0f} KB)"
    except Exception as e:
        return False, f"[FAIL] {filename} -> {e}"


def download_all(urls: set, output_dir: Path):
    from concurrent.futures import ThreadPoolExecutor, as_completed

    output_dir.mkdir(parents=True, exist_ok=True)
    urls_list = sorted(urls)
    print(f"\n[*] 开始下载 {len(urls_list)} 个 PDF -> {output_dir.resolve()}\n")

    success, failed = 0, 0
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        futures = {executor.submit(download_pdf, url, output_dir): url for url in urls_list}
        for future in tqdm(as_completed(futures), total=len(futures), desc="下载进度"):
            ok, msg = future.result()
            print(f"  {msg}")
            if ok:
                success += 1
            else:
                failed += 1
            time.sleep(0.3)

    print(f"\n{'='*50}")
    print(f"[OK] 成功: {success} 个")
    print(f"[FAIL] 失败: {failed} 个")
    print(f"保存目录: {output_dir.resolve()}")


async def main(probe_only: bool = False):
    print("=" * 55)
    print("  渣打银行 QDII 全球基金 PDF 下载器")
    print("=" * 55)
    print(f"  输出目录: {OUTPUT_DIR.resolve()}\n")

    if probe_only:
        sequential_links = probe_sequential_urls()
        all_links = sequential_links
    else:
        playwright_links = await fetch_pdf_links_playwright()
        sequential_links = probe_sequential_urls()
        all_links = playwright_links | sequential_links

    fund_links = {
        url for url in all_links
        if "cn-fs-" in url or "qdut" in url.lower()
    }
    target_links = fund_links if len(fund_links) >= 10 else all_links

    if not target_links:
        print("\n[WARN] 没有找到任何 PDF 链接，请检查网络或使用 --probe-only 仅探测")
        return

    print(f"\n[*] 共找到 {len(target_links)} 个基金 PDF")

    download_all(target_links, OUTPUT_DIR)

    print("\n已下载文件清单:")
    pdfs = sorted(OUTPUT_DIR.glob("*.pdf"))
    for i, p in enumerate(pdfs, 1):
        size_kb = p.stat().st_size / 1024
        print(f"  {i:3d}. {p.name}  ({size_kb:.0f} KB)")
    print(f"\n合计：{len(pdfs)} 个文件")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="渣打 QDII 基金 PDF 爬虫")
    parser.add_argument(
        "--probe-only",
        action="store_true",
        help="仅用规律探测（cn-fs-qdut001~300），不启动 Playwright",
    )
    args = parser.parse_args()
    asyncio.run(main(probe_only=args.probe_only))
