# -*- coding: utf-8 -*-
"""
东方汇理 (Amundi) 基金 PDF 解析器。
物理坐标网格切割法：第 2 页按「10大持仓/资产配置」「地域分布/行业分布」横向切割，
上半区 3 列（资产配置、股票 Top10、债券 Top10），下半区 2 列（地域、行业）。
仅用 page.extract_words()，禁用 extract_tables 与 OCR。
"""

import re
from pathlib import Path
from typing import Any

from parsers.base_parser import BaseFundParser
from parsers.schemas import BondHolding, FundData, TopHolding

_AMUNDI_TARGET_PAGE_INDEX = 1
_Y_TOL = 5

# 行尾百分比
_PCT_END_RE = re.compile(r"^(\d+\.\d+)%?$")
# 含中文则去空格
_HAS_CJK = re.compile(r"[\u4e00-\u9fa5]")

# 行业分布不得混入的资产配置标签（硬过滤）
ASSET_LABELS = frozenset({
    "股票", "债券", "现金", "现金及现金等值",
    "交易所买卖基金及/或指数基金", "交易所买卖基金及/或指数基金(ETF)", "ETF", "指数基金",
})

# 行业白名单：sector_allocation 只保留 label ∈ 白名单
SECTOR_WHITELIST = frozenset({
    "信息科技", "金融", "工业", "非必需消费品", "必需消费品", "健康护理",
    "通讯服务", "物料", "能源", "公用事业", "房地产", "其他",
})

# 地域词：sector 的 key 不得为或包含以下任一项
SECTOR_REGION_BLACKLIST = frozenset({
    "美国", "英国", "德国", "法国", "意大利", "日本", "中国", "台湾", "韩国",
    "澳大利亚", "其他", "现金及现金等值",
})

# sector_block 结束标记（取最早出现者）
SECTOR_BLOCK_END_MARKERS = ("主要风险因素", "资料来源", "以上资料仅供参考", "1)")


def _is_asset_label(label: str) -> bool:
    """label 在 ASSET_LABELS 中或包含其中任一项则视为资产配置，应排除出 sector_allocation。"""
    if not label:
        return True
    if label in ASSET_LABELS:
        return True
    return any(a in label for a in ASSET_LABELS)


def _is_region_label(label: str) -> bool:
    """sector 的 key 不得为地域词或包含地域词。"""
    if not label:
        return True
    if label in SECTOR_REGION_BLACKLIST:
        return True
    return any(r in label for r in SECTOR_REGION_BLACKLIST)


def _sector_label_ok(label: str) -> bool:
    """仅保留白名单且非地域的 label。"""
    if not label:
        return False
    if label not in SECTOR_WHITELIST:
        return False
    if _is_region_label(label):
        return False
    return True


def _normalize_name(name: str) -> str:
    """若 name 含中文字符则去掉内部空格；英文保留空格。"""
    if not name:
        return name
    if _HAS_CJK.search(name):
        return re.sub(r"\s+", "", name)
    return name.strip()


class AmundiFundParser(BaseFundParser):
    """东方汇理基金 PDF 解析器（物理坐标网格切割）。"""

    def _group_words_to_rows(
        self,
        words: list[dict[str, Any]],
        y_tol: float = 5,
    ) -> list[list[str]]:
        """
        将 extract_words() 得到的 word 列表按 top 合并为行（差 <= y_tol 为同一行），
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

    def _extract_list(
        self,
        word_subset: list[dict[str, Any]],
        is_top10: bool = False,
    ) -> Any:
        """
        对 word_subset 按行聚合，行尾为 % 则取最后为 value、前面 join 为 name。
        过滤：name 含 %、分布、持仓、配置或纯数字则跳过。
        中文名去空格，英文保留空格。
        is_top10=True 返回 [TopHolding 或 BondHolding 的 dict 形态]（由调用方转 BondHolding）；
        False 返回 dict[str, float]。
        """
        if not word_subset:
            return [] if is_top10 else {}

        try:
            rows = self._group_words_to_rows(word_subset, y_tol=_Y_TOL)
        except Exception:
            return [] if is_top10 else {}

        if is_top10:
            result: list[dict[str, Any]] = []
        else:
            result_dict: dict[str, float] = {}

        for toks in rows:
            if not toks:
                continue
            last = toks[-1].strip()
            m = _PCT_END_RE.match(last)
            if not m:
                continue
            try:
                value = float(m.group(1))
                if not (0 <= value <= 100):
                    continue
            except ValueError:
                continue
            name = " ".join(toks[:-1]).strip()
            if not name:
                continue
            # 过滤脏数据：仅排除纯百分比轴标（如 "10%"）、标题词
            if re.match(r"^\d+\.?\d*%?$", name.strip()):
                continue
            if "分布" in name or "持仓" in name or ("配置" in name and "资产" not in name):
                continue
            name = _normalize_name(name)
            if not name:
                continue

            if is_top10:
                result.append({"name": name, "market": "", "sector": "", "weight": round(value, 2)})
            else:
                result_dict[name] = round(value, 2)

        if is_top10:
            return result[:10]
        return result_dict

    def _parse_page2_grid(self, page: Any) -> dict[str, Any]:
        """
        第 2 页：动态横向切割 + 上 3 列、下 2 列，返回各区块解析结果。
        严格捕获异常，单区块为空不阻断。
        """
        out: dict[str, Any] = {
            "asset_allocation": None,
            "top_10_holdings": [],
            "top_10_bond_holdings": [],
            "market_allocation": {},
            "sector_allocation": {},
        }
        try:
            words = page.extract_words()
        except Exception:
            return out
        if not words:
            return out

        try:
            width = float(getattr(page, "width", 612))
            height = float(getattr(page, "height", 792))
        except Exception:
            width, height = 612.0, 792.0

        y_holdings = 0.0
        y_dist = height

        for w in words:
            text = (w.get("text") or "").strip()
            top = w.get("top", 0)
            if "10大持仓" in text or "资产配置" in text:
                if y_holdings == 0 or top < y_holdings:
                    y_holdings = top - 10
            if "地域分布" in text or "行业分布" in text or "地域" == text or "行业" == text:
                if top > y_holdings:
                    if y_dist == height or top < y_dist:
                        y_dist = top - 10
        if y_dist >= height:
            y_dist = height * 0.48

        mid_words = [w for w in words if y_holdings <= w.get("top", 0) < y_dist]
        bot_words = [w for w in words if w.get("top", 0) >= y_dist]

        # sector_block 切片：start = "行业分布（股票分析）", end = 最早出现的结束标记
        y_sector_start: float | None = None
        y_sector_end: float | None = None
        for w in words:
            t = (w.get("text") or "").strip()
            top = w.get("top", 0)
            if y_sector_start is None and (
                "行业分布（股票分析）" in t or ("行业分布" in t and "股票分析" in t) or ("行业分布" in t and "股票" in t)
            ):
                y_sector_start = top - 10
            for m in SECTOR_BLOCK_END_MARKERS:
                if m in t or (m == "1)" and (t == "1)" or t.startswith("1)"))):
                    if y_sector_end is None or top < y_sector_end:
                        y_sector_end = top
                    break

        col1 = [w for w in mid_words if w.get("x0", 0) < width * 0.33]
        col2 = [w for w in mid_words if width * 0.33 <= w.get("x0", 0) < width * 0.66]
        col3 = [w for w in mid_words if w.get("x0", 0) >= width * 0.66]
        left = [w for w in bot_words if w.get("x0", 0) < width * 0.5]
        right_raw = [w for w in bot_words if w.get("x0", 0) >= width * 0.5]
        if y_sector_start is not None and y_sector_end is not None and y_sector_start < y_sector_end:
            right = [w for w in right_raw if y_sector_start <= w.get("top", 0) < y_sector_end]
        else:
            right = right_raw

        # 实际版面：左列=股票 Top10，中列=债券 Top10，右列=资产配置
        try:
            raw = self._extract_list(col1, is_top10=True)
            out["top_10_holdings"] = raw if isinstance(raw, list) else []
        except Exception:
            pass
        try:
            raw = self._extract_list(col2, is_top10=True)
            out["top_10_bond_holdings"] = raw if isinstance(raw, list) else []
        except Exception:
            pass
        try:
            raw = self._extract_list(col3, is_top10=False)
            out["asset_allocation"] = raw if isinstance(raw, dict) and raw else None
        except Exception:
            pass
        try:
            raw = self._extract_list(left, is_top10=False)
            if isinstance(raw, dict):
                out["market_allocation"] = raw
        except Exception:
            pass
        try:
            raw = self._extract_list(right, is_top10=False)
            if isinstance(raw, dict):
                out["sector_allocation"] = {
                    k: v for k, v in raw.items()
                    if not _is_asset_label(k) and _sector_label_ok(k)
                }
                if "股票" in out["sector_allocation"] or "债券" in out["sector_allocation"]:
                    sector_preview = " ".join((w.get("text") or "").strip() for w in right)[:400]
                    print("[Amundi sector_block] 切片异常，前400字符:", sector_preview)
                    out["sector_allocation"] = {}
        except Exception:
            pass

        # 兜底：地域/行业仍为空时，按行正则匹配「名称 数字%」（同一行可多对）
        if not out["market_allocation"] and not out["sector_allocation"]:
            try:
                rows = self._group_words_to_rows(words, y_tol=_Y_TOL)
                region_keywords = (
                    "美国", "欧洲", "日本", "中国", "英国", "亚洲", "其他", "现金",
                    "新兴市场", "大洋洲", "加拿大", "法国", "德国", "澳洲", "香港",
                    "台湾", "韩国", "新加坡", "印度", "印尼", "马来西亚", "泰国",
                    "澳大利亚",
                )
                alloc_re = re.compile(r"([A-Za-z\u4e00-\u9fa5]+)\s*(\d+\.\d+)%?")
                for toks in rows:
                    line = " ".join(toks)
                    for m in alloc_re.finditer(line):
                        name = _normalize_name(m.group(1).strip())
                        if not name or "分布" in name or "持仓" in name or "配置" in name:
                            continue
                        try:
                            val = float(m.group(2))
                            if not (0 <= val <= 100):
                                continue
                        except ValueError:
                            continue
                        if not _HAS_CJK.search(name):
                            continue
                        if any(k in name for k in region_keywords):
                            out["market_allocation"][name] = round(val, 2)
                        else:
                            if not _is_asset_label(name) and _sector_label_ok(name):
                                out["sector_allocation"][name] = round(val, 2)
            except Exception:
                pass

        if "股票" in out["sector_allocation"] or "债券" in out["sector_allocation"]:
            out["sector_allocation"] = {}
        # 最终过滤：仅保留白名单且非地域的 key
        out["sector_allocation"] = {
            k: v for k, v in out["sector_allocation"].items()
            if _sector_label_ok(k)
        }

        return out

    def parse(self, file_path: str | Path) -> FundData:
        path = Path(file_path)
        if not path.exists():
            raise FileNotFoundError(f"PDF 文件不存在: {path}")
        if path.suffix.lower() != ".pdf":
            raise ValueError(f"非 PDF 文件: {path}")

        fund_name = path.stem
        asset_allocation: dict[str, float] | None = None
        top_10_holdings: list[TopHolding] = []
        top_10_bond_holdings: list[BondHolding] = []
        market_allocation: dict[str, float] = {}
        sector_allocation: dict[str, float] = {}

        try:
            import pdfplumber
            with pdfplumber.open(path) as pdf:
                if len(pdf.pages) > _AMUNDI_TARGET_PAGE_INDEX:
                    page = pdf.pages[_AMUNDI_TARGET_PAGE_INDEX]
                    grid = self._parse_page2_grid(page)
                    asset_allocation = grid.get("asset_allocation")
                    market_allocation = grid.get("market_allocation") or {}
                    sector_allocation = grid.get("sector_allocation") or {}
                    raw_equity = grid.get("top_10_holdings") or []
                    raw_bond = grid.get("top_10_bond_holdings") or []
                    for item in raw_equity:
                        if isinstance(item, dict) and "name" in item and "weight" in item:
                            top_10_holdings.append(
                                TopHolding(
                                    name=item["name"],
                                    market=item.get("market", ""),
                                    sector=item.get("sector", ""),
                                    weight=float(item["weight"]),
                                )
                            )
                    for item in raw_bond:
                        if isinstance(item, dict) and "name" in item and "weight" in item:
                            top_10_bond_holdings.append(
                                BondHolding(
                                    name=item["name"],
                                    coupon_rate=0.0,
                                    maturity="",
                                    weight=float(item["weight"]),
                                )
                            )
        except Exception:
            pass

        return FundData(
            fund_name=fund_name,
            portfolio_analysis={},
            top_10_holdings=top_10_holdings,
            top_10_bond_holdings=top_10_bond_holdings,
            market_allocation=market_allocation,
            sector_allocation=sector_allocation,
            bond_metrics=None,
            asset_allocation=asset_allocation,
        )
