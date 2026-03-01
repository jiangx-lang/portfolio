# -*- coding: utf-8 -*-
"""
渣打银行境内理财产品 (WMP) 每日净值抓取器
优先尝试 XHR/API 或 requests 解析；无公开 API 时使用 Playwright 无头浏览器。
"""
from __future__ import annotations

import re
from datetime import datetime
from typing import Any

import requests
from bs4 import BeautifulSoup

WMP_URL = "https://www.sc.com/cn/investment/wmp/"

# 请求头，模拟浏览器
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
}


def _parse_nav_date(date_str: str) -> str:
    """将页面日期格式转为 YYYY-MM-DD。支持 2/26/2026、2026-02-26 等。"""
    if not date_str or not date_str.strip():
        return ""
    date_str = date_str.strip()
    # M/D/YYYY 或 MM/DD/YYYY
    m = re.match(r"(\d{1,2})/(\d{1,2})/(\d{4})", date_str)
    if m:
        month, day, year = m.group(1), m.group(2), m.group(3)
        try:
            dt = datetime(int(year), int(month), int(day))
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            pass
    # 已是 YYYY-MM-DD
    if re.match(r"\d{4}-\d{2}-\d{2}", date_str):
        return date_str[:10]
    return date_str


def _parse_float_nav(val: str) -> float | None:
    """解析净值为 float。"""
    if not val:
        return None
    val = re.sub(r"[^\d.]", "", str(val).strip())
    if not val:
        return None
    try:
        return float(val)
    except ValueError:
        return None


def _strip_html_name(cell_text: str) -> str:
    """去掉 [xxx](url) 形式的链接，只保留产品名称。"""
    if not cell_text:
        return ""
    # Markdown 风格 [text](url)
    m = re.match(r"\[([^\]]+)\]", cell_text.strip())
    if m:
        return m.group(1).strip()
    return cell_text.strip()


def scrape_via_requests() -> list[dict[str, Any]] | None:
    """
    通过 requests + BeautifulSoup 解析 WMP 页面表格。
    若页面为静态或服务端渲染，可直接拿到表格 HTML。
    """
    try:
        resp = requests.get(WMP_URL, headers=HEADERS, timeout=15)
        resp.raise_for_status()
        resp.encoding = resp.apparent_encoding or "utf-8"
        soup = BeautifulSoup(resp.text, "html.parser")
    except Exception:
        return None

    rows: list[dict[str, Any]] = []
    # 目标：第一个主表格（代销理财产品信息），表头含 产品销售代码、产品净值、产品净值日期
    tables = soup.find_all("table")
    for table in tables:
        thead = table.find("thead") or table.find("tr")
        if not thead:
            continue
        header_cells = thead.find_all(["th", "td"])
        header_texts = [c.get_text(strip=True) for c in header_cells]
        if "产品净值" not in header_texts or "产品销售代码" not in header_texts:
            continue

        # 确定列索引
        try:
            idx_code = header_texts.index("产品销售代码")
        except ValueError:
            continue
        idx_name = header_texts.index("产品名称") if "产品名称" in header_texts else idx_code + 1
        idx_risk = header_texts.index("渣打产品风险评级") if "渣打产品风险评级" in header_texts else -1
        idx_term = header_texts.index("投资期限") if "投资期限" in header_texts else -1
        idx_nav = header_texts.index("产品净值")
        idx_date = header_texts.index("产品净值日期") if "产品净值日期" in header_texts else -1

        tbody = table.find("tbody") or table
        for tr in tbody.find_all("tr")[1:]:  # 跳过表头
            cells = tr.find_all(["td", "th"])
            if len(cells) <= max(idx_code, idx_nav):
                continue
            code = cells[idx_code].get_text(strip=True) if idx_code < len(cells) else ""
            name = _strip_html_name(cells[idx_name].get_text()) if idx_name < len(cells) else ""
            risk = cells[idx_risk].get_text(strip=True) if idx_risk >= 0 and idx_risk < len(cells) else ""
            term = cells[idx_term].get_text(strip=True) if idx_term >= 0 and idx_term < len(cells) else ""
            nav_raw = cells[idx_nav].get_text(strip=True) if idx_nav < len(cells) else ""
            date_raw = cells[idx_date].get_text(strip=True) if idx_date >= 0 and idx_date < len(cells) else ""

            nav = _parse_float_nav(nav_raw)
            if nav is None:
                continue
            date_ymd = _parse_nav_date(date_raw)
            if not date_ymd:
                continue
            rows.append({
                "product_code": code,
                "product_name": name,
                "risk_level": risk,
                "term": term,
                "nav": nav,
                "date": date_ymd,
            })
        if rows:
            return rows
    return rows if rows else None


def scrape_via_playwright() -> list[dict[str, Any]] | None:
    """
    使用 Playwright 无头浏览器抓取动态页面。
    仅在 scrape_via_requests 无法拿到表格时使用。
    """
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        return None

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        try:
            page = browser.new_page()
            page.goto(WMP_URL, wait_until="networkidle", timeout=20000)
            page.wait_for_timeout(2000)
            html = page.content()
        finally:
            browser.close()

    soup = BeautifulSoup(html, "html.parser")
    rows = []
    tables = soup.find_all("table")
    for table in tables:
        thead = table.find("thead") or table.find("tr")
        if not thead:
            continue
        header_cells = thead.find_all(["th", "td"])
        header_texts = [c.get_text(strip=True) for c in header_cells]
        if "产品净值" not in header_texts or "产品销售代码" not in header_texts:
            continue
        try:
            idx_code = header_texts.index("产品销售代码")
        except ValueError:
            continue
        idx_name = header_texts.index("产品名称") if "产品名称" in header_texts else idx_code + 1
        idx_risk = header_texts.index("渣打产品风险评级") if "渣打产品风险评级" in header_texts else -1
        idx_term = header_texts.index("投资期限") if "投资期限" in header_texts else -1
        idx_nav = header_texts.index("产品净值")
        idx_date = header_texts.index("产品净值日期") if "产品净值日期" in header_texts else -1

        tbody = table.find("tbody") or table
        for tr in tbody.find_all("tr")[1:]:
            cells = tr.find_all(["td", "th"])
            if len(cells) <= max(idx_code, idx_nav):
                continue
            code = cells[idx_code].get_text(strip=True) if idx_code < len(cells) else ""
            name = _strip_html_name(cells[idx_name].get_text()) if idx_name < len(cells) else ""
            risk = cells[idx_risk].get_text(strip=True) if idx_risk >= 0 and idx_risk < len(cells) else ""
            term = cells[idx_term].get_text(strip=True) if idx_term >= 0 and idx_term < len(cells) else ""
            nav_raw = cells[idx_nav].get_text(strip=True) if idx_nav < len(cells) else ""
            date_raw = cells[idx_date].get_text(strip=True) if idx_date >= 0 and idx_date < len(cells) else ""
            nav = _parse_float_nav(nav_raw)
            if nav is None:
                continue
            date_ymd = _parse_nav_date(date_raw)
            if not date_ymd:
                continue
            rows.append({
                "product_code": code,
                "product_name": name,
                "risk_level": risk,
                "term": term,
                "nav": nav,
                "date": date_ymd,
            })
        if rows:
            return rows
    return rows if rows else None


def scrape_wmp() -> list[dict[str, Any]]:
    """
    主入口：优先 requests，失败则 Playwright。
    返回字段：product_code, product_name, risk_level, term, nav, date (YYYY-MM-DD)。
    """
    result = scrape_via_requests()
    if result:
        return result
    result = scrape_via_playwright()
    if result:
        return result
    return []


if __name__ == "__main__":
    data = scrape_wmp()
    print(f"抓取到 {len(data)} 条记录")
    for row in data[:3]:
        print(row)
