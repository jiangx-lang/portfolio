"""
渣打 QDII 基金 PDF 爬虫 v2
- 用 Playwright 打开页面、滚动触发懒加载，从 DOM 抓取所有 av.sc.com 的 .pdf 链接
- 用 requests 顺序下载，随机延迟 1.5~3.5s，降低并发求稳
- 输出目录：项目根目录下 sc_funds_pdf_v2/

依赖: pip install playwright requests tqdm && playwright install chromium
运行: 在项目根目录执行  python scripts/sc_fund_scraper_v2.py
"""

import asyncio
import random
import re
import time
from pathlib import Path

import requests
from tqdm import tqdm
from playwright.async_api import async_playwright

# ── 配置 ──
TARGET_URL = "https://www.sc.com/cn/investment/qdii-series/global-fund-selection/"
SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent
OUTPUT_DIR = PROJECT_ROOT / "sc_funds_pdf_v2"
MAX_WORKERS = 2
DOWNLOAD_DELAY = (1.5, 3.5)  # 随机延迟范围（秒）


class SCFundScraper:
    def __init__(self):
        self.output_dir = OUTPUT_DIR
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.headers = {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
            "Accept": "application/pdf,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
            "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
            "Referer": TARGET_URL,
        }
        self.session = requests.Session()
        self.session.headers.update(self.headers)

    async def get_pdf_links(self):
        """使用浏览器渲染页面并抓取所有含有 pdf 的链接"""
        pdf_links = set()
        print(f"[*] 正在打开页面: {TARGET_URL}")

        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            context = await browser.new_context(viewport={"width": 1920, "height": 1080})
            page = await context.new_page()

            await page.goto(TARGET_URL, wait_until="networkidle")

            for i in range(10):
                await page.mouse.wheel(0, 1000)
                await asyncio.sleep(0.5)

            hrefs = await page.eval_on_selector_all("a", "elements => elements.map(el => el.href)")

            for href in hrefs:
                if href and "av.sc.com" in href and ".pdf" in href.lower():
                    clean_url = href.split(".pdf")[0] + ".pdf"
                    pdf_links.add(clean_url)

            await browser.close()

        # 只保留严格格式：cn-fs-qdur数字.pdf 或 cn-fs-qdut数字.pdf（星号为数字）
        def is_fund_pdf(url: str) -> bool:
            name = url.split("/")[-1].split("?")[0]
            return bool(re.match(r"^cn-fs-(qdur|qdut)\d+\.pdf$", name, re.IGNORECASE))

        pdf_links = {u for u in pdf_links if is_fund_pdf(u)}
        print(f"[OK] 页面解析完成，筛选后（cn-fs-qdur*/cn-fs-qdut*）共 {len(pdf_links)} 个基金 PDF 链接")
        return sorted(list(pdf_links))

    def download_file(self, url):
        """带随机延迟的单文件下载"""
        filename = url.split("/")[-1].split("?")[0]
        if not filename.lower().endswith(".pdf"):
            filename += ".pdf"
        filepath = self.output_dir / filename

        if filepath.exists() and filepath.stat().st_size > 1024:
            return "skip", filename

        time.sleep(random.uniform(*DOWNLOAD_DELAY))

        try:
            response = self.session.get(url, timeout=20, stream=True)
            if response.status_code == 200:
                with open(filepath, "wb") as f:
                    for chunk in response.iter_content(chunk_size=8192):
                        f.write(chunk)
                return "ok", filename
            else:
                return "fail", f"{filename} (HTTP {response.status_code})"
        except Exception as e:
            return "err", f"{filename} -> {e}"


async def main():
    scraper = SCFundScraper()

    links = await scraper.get_pdf_links()

    if not links:
        print("[!] 未找到链接，请检查网络或 URL 是否变更。")
        return

    print(f"\n[*] 开始下载至 {OUTPUT_DIR.resolve()} ...")
    ok, skip, fail = 0, 0, 0
    for link in tqdm(links, desc="下载进度"):
        status, msg = scraper.download_file(link)
        if status == "ok":
            ok += 1
        elif status == "skip":
            skip += 1
        else:
            fail += 1
            tqdm.write(f"  [FAIL] {msg}")

    print(f"\n[OK] 成功: {ok}  跳过(已存在): {skip}  失败: {fail}")
    print(f"保存目录: {OUTPUT_DIR.resolve()}")


if __name__ == "__main__":
    asyncio.run(main())
