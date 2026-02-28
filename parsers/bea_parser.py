# -*- coding: utf-8 -*-
"""
东亚联丰 (BEA) 基金 PDF 解析器。
基于 extract_words() 坐标：group_words_to_rows 按 y 合并行，四象限分区后按行抽取
地域/行业/主要投资/债券统计摘要；波幅从第 1 页投资表现表首条份额行取。禁用 OCR 与 extract_tables。
"""

import re
from pathlib import Path
from typing import Any

from parsers.base_parser import BaseFundParser
from parsers.schemas import FundData, TopHolding

# ---------------------------------------------------------------------------
# A) 高鲁棒性工具：按 top 合并为行，行内按 x0 排序
# ---------------------------------------------------------------------------

PERCENT_RE = re.compile(r"^\d+\.\d+%?$")
TITLE_SKIP = frozenset({"地域分布", "行业分布", "债券", "股票"})
HEADER_SKIP = frozenset({"主要投资", "市场", "比重"})


def group_words_to_rows(
    words: list[dict[str, Any]],
    y_tol: float = 6,
) -> list[list[str]]:
    """
    将 extract_words() 得到的 word 列表按 top 合并为行（top 差 <= y_tol 为同一行），
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


def _quadrant_words_and_rows(
    page: Any,
    split_y: float,
    mid_x: float,
    y_tol: float = 6,
) -> dict[str, list[list[str]]]:
    """第 2 页：动态四象限分区，每象限 group_words_to_rows。返回四块 rows。"""
    words = page.extract_words() if hasattr(page, "extract_words") else []
    if not words:
        return {
            "upper_left": [],
            "upper_right": [],
            "lower_left": [],
            "lower_right": [],
        }
    ul: list[dict[str, Any]] = []
    ur: list[dict[str, Any]] = []
    ll: list[dict[str, Any]] = []
    lr: list[dict[str, Any]] = []
    for w in words:
        t = w.get("top", 0)
        x0 = w.get("x0", 0)
        if t < split_y:
            if x0 < mid_x:
                ul.append(w)
            else:
                ur.append(w)
        else:
            if x0 < mid_x:
                ll.append(w)
            else:
                lr.append(w)
    return {
        "upper_left": group_words_to_rows(ul, y_tol),
        "upper_right": group_words_to_rows(ur, y_tol),
        "lower_left": group_words_to_rows(ll, y_tol),
        "lower_right": group_words_to_rows(lr, y_tol),
    }


# ---------------------------------------------------------------------------
# C) 分布图：每行找 percent token，label 为其左侧最近非标题 token
# ---------------------------------------------------------------------------

def _extract_distribution_from_rows(rows: list[list[str]]) -> dict[str, float]:
    """不写死国家/行业；跳过标题词；地域/行业分别由 upper_left / upper_right 调用，保留「其他」。"""
    res: dict[str, float] = {}
    for toks in rows:
        if not toks:
            continue
        pct_idx = -1
        for i, t in enumerate(toks):
            if PERCENT_RE.match(t):
                pct_idx = i
                break
        if pct_idx <= 0:
            continue
        try:
            val = float(re.sub(r"%", "", toks[pct_idx]))
            if not (0 <= val <= 100):
                continue
        except ValueError:
            continue
        label = toks[pct_idx - 1].strip()
        if not label:
            continue
        if label in TITLE_SKIP:
            continue
        if len(label) > 30:
            continue
        if label not in res:
            res[label] = round(val, 2)
    return res


# ---------------------------------------------------------------------------
# D) 主要投资 Top10：逆向寻址 weight=最右 percent, market=其左一, name=剩余拼接
# ---------------------------------------------------------------------------

def _extract_top10_from_rows(rows: list[list[str]]) -> list[TopHolding]:
    holdings: list[TopHolding] = []
    for toks in rows:
        if not toks:
            continue
        if any(h in " ".join(toks) for h in HEADER_SKIP):
            continue
        pct_idx = -1
        for i in range(len(toks) - 1, -1, -1):
            if PERCENT_RE.match(toks[i]):
                pct_idx = i
                break
        if pct_idx < 0:
            continue
        try:
            weight = float(re.sub(r"%", "", toks[pct_idx]))
            if not (0 < weight <= 100):
                continue
        except ValueError:
            continue
        if pct_idx == 0:
            continue
        market = toks[pct_idx - 1].strip()
        if not market or len(market) > 25:
            continue
        name = " ".join(toks[: pct_idx - 1]).strip()
        if not name:
            continue
        holdings.append(TopHolding(name=name, market=market, sector="", weight=round(weight, 2)))
        if len(holdings) >= 10:
            break
    return holdings[:10]


# ---------------------------------------------------------------------------
# E) 债券统计摘要：标签跨行扫描，含平均信贷评级(字符串)
# ---------------------------------------------------------------------------

def _first_percent_in_rows(rows: list[list[str]], start: int = 0, max_rows: int = 3) -> float | None:
    """从 start 行起在最多 max_rows 行内找第一个 percent token，返回 float。"""
    for j in range(start, min(start + max_rows, len(rows))):
        for t in rows[j]:
            m = re.match(r"^(\d+\.\d+)%?$", t)
            if m:
                try:
                    v = float(m.group(1))
                    if 0 <= v <= 100:
                        return round(v, 2)
                except ValueError:
                    pass
    return None


def _extract_bond_summary_from_rows(rows: list[list[str]]) -> dict[str, float | str] | None:
    """仅在 lower_right 块做标签扫描：到期收益率/投资级别(不含非)/非投资级别/平均信贷评级/存续期；返回含 avg_credit_rating(str) 与 avg_duration(float) 的 dict。"""
    metrics: dict[str, float | str] = {}
    rating_re = re.compile(r"^[A-Z]{1,3}[+-]?$")
    for i, toks in enumerate(rows):
        line = " ".join(toks)
        if "到期收益率" in line:
            v = _first_percent_in_rows(rows, i, 3)
            if v is not None and "yield_to_maturity" not in metrics:
                metrics["yield_to_maturity"] = v
        if "投资级别" in line and "非投资级别" not in line:
            v = _first_percent_in_rows(rows, i, 2)
            if v is not None and "investment_grade_pct" not in metrics:
                metrics["investment_grade_pct"] = v
        if "非投资级别" in line:
            v = _first_percent_in_rows(rows, i, 2)
            if v is not None and "high_yield_pct" not in metrics:
                metrics["high_yield_pct"] = v
        if "平均信贷评级" in line:
            for j in range(i, min(i + 2, len(rows))):
                for t in rows[j]:
                    if rating_re.match(t.strip()):
                        metrics["avg_credit_rating"] = t.strip()
                        break
                if "avg_credit_rating" in metrics:
                    break
        if "存续期" in line:
            for t in toks:
                m = re.search(r"(\d+\.\d+)\s*年?", t)
                if m:
                    try:
                        metrics["avg_duration"] = round(float(m.group(1)), 2)
                        break
                    except ValueError:
                        pass
            if "avg_duration" not in metrics:
                for j in range(i + 1, min(i + 3, len(rows))):
                    for t in rows[j]:
                        m = re.search(r"(\d+\.\d+)\s*年?", t)
                        if m:
                            try:
                                metrics["avg_duration"] = round(float(m.group(1)), 2)
                                break
                            except ValueError:
                                pass
                    if "avg_duration" in metrics:
                        break
    return metrics if metrics else None


# ---------------------------------------------------------------------------
# F) 第 1 页波幅：投资表现表首条份额行最后一个数字
# ---------------------------------------------------------------------------

def _extract_volatility_from_page1_rows(rows: list[list[str]]) -> float | None:
    """定位投资表现区域，首条含 USD/R HKD/或数字最多的行，取最后一个纯数字 token。"""
    found_table = False
    best_row: list[str] | None = None
    for toks in rows:
        line = " ".join(toks)
        if "投资表现" in line:
            found_table = True
            continue
        if not found_table:
            continue
        if any(h in line for h in ("USD", "R HKD", "HKD", "R类别", "类别")):
            nums = [t for t in toks if re.match(r"^\d+\.?\d*$", t)]
            if nums:
                try:
                    return float(nums[-1])
                except ValueError:
                    pass
        num_count = sum(1 for t in toks if re.match(r"^\d+\.?\d*$", t))
        if best_row is None or num_count > sum(1 for t in best_row if re.match(r"^\d+\.?\d*$", t)):
            if num_count >= 2:
                best_row = toks
    if best_row:
        nums = [t for t in best_row if re.match(r"^\d+\.?\d*$", t)]
        if nums:
            try:
                return float(nums[-1])
            except ValueError:
                pass
    return None


def extract_blocks(page: Any) -> dict[str, str]:
    """
    通用工具函数：基于坐标将页面切分为四大区块 (上左/上右/下左/下右)。
    锚定「主要投资」或「十大持仓」动态确定上下分界线。
    """
    try:
        import pdfplumber
    except ImportError:
        return {"upper_left": "", "upper_right": "", "lower_left": "", "lower_right": ""}
    words = page.extract_words() if hasattr(page, "extract_words") else []
    if not words:
        return {"upper_left": "", "upper_right": "", "lower_left": "", "lower_right": ""}

    mid_x = page.width / 2
    mid_y = page.height / 2

    for w in words:
        if "主要投资" in w.get("text", "") or "十大持仓" in w.get("text", ""):
            mid_y = w["top"] - 10
            break

    blocks: dict[str, list[tuple[float, float, str]]] = {
        "upper_left": [],
        "upper_right": [],
        "lower_left": [],
        "lower_right": [],
    }

    for w in words:
        line_y = round(w["top"] / 4) * 4
        text = w.get("text", "")
        x0 = w.get("x0", 0)
        if w["top"] < mid_y:
            if x0 < mid_x:
                blocks["upper_left"].append((line_y, x0, text))
            else:
                blocks["upper_right"].append((line_y, x0, text))
        else:
            if x0 < mid_x:
                blocks["lower_left"].append((line_y, x0, text))
            else:
                blocks["lower_right"].append((line_y, x0, text))

    def build_text(word_list: list[tuple[float, float, str]]) -> str:
        word_list.sort(key=lambda x: (x[0], x[1]))
        lines: dict[float, list[str]] = {}
        for y, _x, text in word_list:
            lines.setdefault(y, []).append(text)
        return "\n".join(" ".join(parts) for _y, parts in sorted(lines.items()))

    return {k: build_text(v) for k, v in blocks.items()}


def parse_distribution_block(text_block: str) -> dict[str, float]:
    """解析地域/行业分布（支持中文、连字符、空格），防覆盖只保留首次。"""
    res: dict[str, float] = {}
    if not text_block:
        return res
    for line in text_block.split("\n"):
        line = line.strip()
        if not line:
            continue
        match = re.search(r"^([A-Za-z\u4e00-\u9fa5\-\s]+?)\s+(\d+\.\d+)%?\s*$", line)
        if match:
            name = match.group(1).strip()
            if len(name) < 20 and name not in res:
                try:
                    val = float(match.group(2))
                    if 0 <= val <= 100:
                        res[name] = round(val, 2)
                except ValueError:
                    pass
    return res


def parse_top_holdings_block(text_block: str) -> list[TopHolding]:
    """解析主要投资（Top 10）：名称 + 市场 + 比重%。"""
    holdings: list[TopHolding] = []
    if not text_block:
        return holdings
    for line in text_block.split("\n"):
        line = line.strip()
        if not line:
            continue
        if any(kw in line for kw in ["主要投资", "市场", "比重", "行业", "资产"]):
            continue
        match = re.search(r"^(.+?)\s+([A-Za-z\u4e00-\u9fa5]+)\s+(\d+\.\d+)%?\s*$", line)
        if match:
            name = match.group(1).strip()
            market = match.group(2).strip()
            if len(market) >= 15:
                continue
            try:
                weight = float(match.group(3))
                if 0 < weight <= 100:
                    holdings.append(
                        TopHolding(name=name, market=market, sector="", weight=round(weight, 2))
                    )
            except ValueError:
                pass
        if len(holdings) >= 10:
            break
    return holdings[:10]


def parse_bond_summary_block(text_block: str) -> dict[str, float] | None:
    """解析债券统计摘要：到期收益率、投资级别、非投资级别、存续期等，仅返回数值型。"""
    if not text_block:
        return None
    metrics: dict[str, Any] = {}

    ytm = re.search(r"到期收益率[^\d]*(\d+\.\d+)%?", text_block)
    if ytm:
        try:
            metrics["yield_to_maturity"] = float(ytm.group(1))
        except ValueError:
            pass

    ig = re.search(r"投资级别\+?[^\d]*(\d+\.\d+)%?", text_block)
    if ig:
        try:
            metrics["investment_grade_pct"] = float(ig.group(1))
        except ValueError:
            pass

    hy = re.search(r"非投资级别\+?[^\d]*(\d+\.\d+)%?", text_block)
    if hy:
        try:
            metrics["high_yield_pct"] = float(hy.group(1))
        except ValueError:
            pass

    duration = re.search(r"存续期[^\d]*(\d+\.\d+)\s*年?", text_block)
    if duration:
        try:
            metrics["avg_duration"] = float(duration.group(1))
        except ValueError:
            pass

    float_only = {k: v for k, v in metrics.items() if isinstance(v, (int, float))}
    return float_only if float_only else None


_BEA_PAGE_VOLATILITY = 0
_BEA_PAGE_HOLDINGS_AND_ALLOC = 1

# 仅用于分拣：首次捕获的「名称 -> 数值」中，名称在此集合的归入 market_allocation，其余归 sector_allocation
_REGION_KEYS = frozenset({
    "美国", "日本", "中国", "法国", "英国", "加拿大", "其他", "现金",
    "中国台湾", "台湾", "其他-欧洲", "其他-亚洲", "印度", "印尼", "印度尼西亚",
    "中国澳门", "澳门", "中国香港", "香港", "泰国", "新加坡", "韩国", "马来西亚",
    "蒙古", "斯里兰卡", "澳大利亚", "政府",
})

# 持仓行过滤：名称若为此类（地域/行业标签）则不计入十大持仓
_HOLDING_BLOCKLIST = _REGION_KEYS | frozenset({
    "资讯科技", "金融", "工业", "非必需消费品", "健康护理", "通讯服务",
    "物料", "必需消费品", "能源", "公共事业",
})


def _parse_volatility_page1(text: str) -> dict[str, dict[str, float | None]]:
    """第 1 页：含「R类别*」的行，split 后取最后一个元素转 float -> 年化波幅 近三年。"""
    result: dict[str, dict[str, float | None]] = {}
    template = {"近三年": None, "近五年": None, "自成立至今": None}
    if not text or not isinstance(text, str):
        return result
    try:
        for line in text.split("\n"):
            line = line.strip()
            if "R类别" not in line or "*" not in line:
                continue
            parts = line.split()
            if not parts:
                continue
            try:
                v = float(parts[-1])
                if 2 <= v < 100:
                    result["年化波幅(%)"] = {**template, "近三年": v}
                    break
            except (ValueError, TypeError):
                continue
    except Exception:
        pass
    return result


def _parse_alloc_first_only(text: str) -> dict[str, float]:
    """
    第 2 页逐行：行首文本 + 行尾百分比，不写死关键字。
    只保留首次出现的键，名称过长(>20)跳过。返回临时字典，主流程再分拣到 market/sector。
    """
    temp: dict[str, float] = {}
    if not text or not isinstance(text, str):
        return temp
    pattern = re.compile(r"^([A-Za-z\u4e00-\u9fa5\-\s]+?)\s+(\d+\.\d+)%\s*$")
    try:
        for line in text.split("\n"):
            line = line.strip()
            if not line:
                continue
            m = pattern.match(line)
            if not m:
                continue
            name = m.group(1).strip()
            if len(name) > 20:
                continue
            if name in temp:
                continue
            try:
                val = float(m.group(2))
                if 0 <= val <= 100:
                    temp[name] = round(val, 2)
            except ValueError:
                continue
    except Exception:
        pass
    return temp


def _split_alloc(temp: dict[str, float]) -> tuple[dict[str, float], dict[str, float]]:
    """将首次捕获的临时字典分拣：在 _REGION_KEYS 的归 market，其余归 sector。"""
    market: dict[str, float] = {}
    sector: dict[str, float] = {}
    for name, val in temp.items():
        if name in _REGION_KEYS:
            market[name] = val
        else:
            sector[name] = val
    return market, sector


def _parse_top_holdings_from_text(text: str) -> list[TopHolding]:
    """
    第 2 页逐行：名称 + 市场 + 百分比（行尾为数字%）。
    过滤：市场列过长、名称含「分布」「投资」等表头词、名称（去尾空格/数字/%）为地域/行业标签则跳过。
    """
    holdings: list[TopHolding] = []
    if not text or not isinstance(text, str):
        return holdings
    pattern = re.compile(r"^(.+?)\s+(\S+)\s+(\d+\.\d+)%\s*$", re.UNICODE)
    header_noise = ("分布", "投资", "地域", "行业", "比重", "市场", "主要")
    try:
        for line in text.split("\n"):
            line = line.strip()
            if not line:
                continue
            m = pattern.match(line)
            if not m:
                continue
            name = m.group(1).strip()
            market = m.group(2).strip()
            try:
                weight = float(m.group(3))
            except ValueError:
                continue
            if not (0 < weight <= 100):
                continue
            if len(market) > 20:
                continue
            if any(w in name for w in header_noise):
                continue
            name_clean = re.sub(r"[\s\d.%]+$", "", name).strip()
            if name_clean in _HOLDING_BLOCKLIST:
                continue
            holdings.append(TopHolding(name=name, market=market, sector="", weight=round(weight, 2)))
            if len(holdings) >= 10:
                break
    except Exception:
        pass
    return holdings[:10]


def _parse_bond_metrics_from_text(text: str) -> dict[str, float] | None:
    """第 2 页全文正则：到期收益率、投资级别、非投资级别、存续期 -> bond_metrics。要求为独立标签行，避免债券名称误匹配。"""
    if not text or not isinstance(text, str):
        return None
    bond: dict[str, float] = {}
    patterns = [
        (r"(?:^|\n)\s*到期收益率\s*[：:]*\s*(\d+\.\d+)", "yield_to_maturity"),
        (r"(?:^|\n)\s*投资级别\+?\s*[：:]*\s*(\d+\.\d+)", "investment_grade_pct"),
        (r"(?:^|\n)\s*非投资级别\+?\s*[：:]*\s*(\d+\.\d+)", "high_yield_pct"),
        (r"(?:^|\n)\s*存续期\s*[：:]*\s*(\d+\.\d+)", "avg_duration"),
    ]
    try:
        for regex, key in patterns:
            m = re.search(regex, text)
            if m:
                try:
                    v = float(m.group(1))
                    if key == "yield_to_maturity" and not (0 <= v <= 100):
                        continue
                    if key in ("investment_grade_pct", "high_yield_pct") and not (0 <= v <= 100):
                        continue
                    if key == "avg_duration" and v < 0:
                        continue
                    bond[key] = round(v, 2)
                except (ValueError, TypeError):
                    pass
    except Exception:
        pass
    return bond if bond else None


class BEAFundParser(BaseFundParser):
    """
    东亚联丰 (BEA) 解析器：仅用 layout 文本 + 正则，不用 extract_tables()。
    地域/行业不写死国家名；十大持仓、债券指标、波幅均从文本正则提取。
    """

    def parse(self, file_path: str | Path) -> FundData:
        path = Path(file_path)
        if not path.exists():
            raise FileNotFoundError(f"PDF 文件不存在: {path}")
        if path.suffix.lower() != ".pdf":
            raise ValueError(f"非 PDF 文件: {path}")

        fund_name = path.stem
        portfolio_analysis: dict[str, dict[str, float | None]] = {}
        top_10_holdings: list[TopHolding] = []
        market_allocation: dict[str, float] = {}
        sector_allocation: dict[str, float] = {}
        bond_metrics: dict[str, float | str] | None = None

        try:
            import pdfplumber
            with pdfplumber.open(path) as pdf:
                if len(pdf.pages) > _BEA_PAGE_VOLATILITY:
                    try:
                        page0 = pdf.pages[_BEA_PAGE_VOLATILITY]
                        page0_words = page0.extract_words() or []
                        page0_rows = group_words_to_rows(page0_words, y_tol=6)
                        vol = _extract_volatility_from_page1_rows(page0_rows)
                        if vol is not None and 2 <= vol < 100:
                            portfolio_analysis["年化波幅(%)"] = {
                                "近三年": vol,
                                "近五年": None,
                                "自成立至今": None,
                            }
                        if not portfolio_analysis:
                            page0_text = page0.extract_text(layout=True) or ""
                            portfolio_analysis = _parse_volatility_page1(page0_text)
                    except Exception:
                        pass

                if len(pdf.pages) > _BEA_PAGE_HOLDINGS_AND_ALLOC:
                    page1 = pdf.pages[_BEA_PAGE_HOLDINGS_AND_ALLOC]
                    try:
                        page1_text = page1.extract_text(layout=True) or ""
                    except Exception:
                        page1_text = ""

                    try:
                        mid_x = page1.width / 2
                        split_y = page1.height / 2
                        for w in (page1.extract_words() or []):
                            t = w.get("text", "") or ""
                            if "主要投资" in t or "十大持仓" in t:
                                split_y = w.get("top", split_y) - 5
                                break
                        quad = _quadrant_words_and_rows(page1, split_y, mid_x, y_tol=6)
                        ul_rows, ur_rows = quad["upper_left"], quad["upper_right"]
                        ll_rows, lr_rows = quad["lower_left"], quad["lower_right"]
                        bl_market = _extract_distribution_from_rows(ul_rows)
                        bl_sector = _extract_distribution_from_rows(ur_rows)
                        bl_holdings = _extract_top10_from_rows(ll_rows)
                        bl_bond = _extract_bond_summary_from_rows(lr_rows)
                        if bl_market or bl_sector:
                            if bl_market:
                                market_allocation = bl_market
                            if bl_sector:
                                sector_allocation = bl_sector
                        if bl_holdings:
                            top_10_holdings = bl_holdings
                        if bl_bond is not None:
                            bond_metrics = bl_bond
                    except Exception:
                        pass

                    if not market_allocation and not sector_allocation:
                        try:
                            blocks = extract_blocks(page1)
                            bl_market = parse_distribution_block(blocks.get("upper_left", ""))
                            bl_sector = parse_distribution_block(blocks.get("upper_right", ""))
                            if bl_market:
                                market_allocation = bl_market
                            if bl_sector:
                                sector_allocation = bl_sector
                        except Exception:
                            pass
                    if not market_allocation and not sector_allocation:
                        try:
                            temp_alloc = _parse_alloc_first_only(page1_text)
                            market_allocation, sector_allocation = _split_alloc(temp_alloc)
                        except Exception:
                            pass

                    if not top_10_holdings:
                        try:
                            blocks = extract_blocks(page1)
                            top_10_holdings = parse_top_holdings_block(blocks.get("lower_left", ""))
                        except Exception:
                            pass
                    if not top_10_holdings:
                        try:
                            top_10_holdings = _parse_top_holdings_from_text(page1_text)
                        except Exception:
                            pass

                    if bond_metrics is None:
                        try:
                            bond_metrics = _parse_bond_metrics_from_text(page1_text)
                        except Exception:
                            pass
        except Exception:
            pass

        if not portfolio_analysis:
            try:
                full_text = self._extract_text_from_pdf(path)
                portfolio_analysis = _parse_volatility_page1(full_text)
            except Exception:
                pass

        return FundData(
            fund_name=fund_name,
            portfolio_analysis=portfolio_analysis,
            top_10_holdings=top_10_holdings,
            top_10_bond_holdings=[],
            market_allocation=market_allocation,
            sector_allocation=sector_allocation,
            bond_metrics=bond_metrics,
            asset_allocation=None,
        )


# ---------------------------------------------------------------------------
# G) 自测 main()：占位符路径，打印各维度长度与样例；空象限打印前 300 字符
# ---------------------------------------------------------------------------

def _debug_quadrant(name: str, rows: list[list[str]], extracted: Any) -> None:
    if not rows and not extracted:
        print(f"  [{name}] 无数据")
        return
    text_preview = "\n".join(" ".join(t) for t in rows[:20])
    if len(text_preview) > 300:
        text_preview = text_preview[:300] + "..."
    if not extracted:
        print(f"  [{name}] 提取为空，前 300 字符:\n{text_preview}")
        return
    if isinstance(extracted, dict):
        print(f"  [{name}] keys={len(extracted)} 样例={list(extracted.items())[:3]}")
    elif isinstance(extracted, list):
        print(f"  [{name}] len={len(extracted)} 样例={extracted[:2]}")
    else:
        print(f"  [{name}] {extracted}")


if __name__ == "__main__":
    import sys
    _root = Path(__file__).resolve().parent.parent
    if str(_root) not in sys.path:
        sys.path.insert(0, str(_root))
    PDF_PATHS = [
        Path(__file__).resolve().parent.parent / "onepage" / "东亚联丰环球股票基金每月基金报告（2026年1月）.pdf",
        Path(__file__).resolve().parent.parent / "onepage" / "东亚联丰亚洲债券及货币基金每月基金报告（2026年1月）.pdf",
    ]
    PDF_PATHS = [p for p in PDF_PATHS if p.exists()]
    if not PDF_PATHS:
        PDF_PATHS = [Path(r"D:\portoflio for mrf\onepage\东亚联丰环球股票基金每月基金报告（2026年1月）.pdf")]
    for path in PDF_PATHS:
        print(f"\n{'='*60}\n{path.name}")
        try:
            parser = BEAFundParser()
            data = parser.parse(path)
            print("  portfolio_analysis:", len(data.portfolio_analysis), data.portfolio_analysis)
            print("  market_allocation:", len(data.market_allocation), list(data.market_allocation.items())[:4])
            print("  sector_allocation:", len(data.sector_allocation), list(data.sector_allocation.items())[:4])
            print("  top_10_holdings:", len(data.top_10_holdings), [{"name": h.name[:30], "market": h.market, "weight": h.weight} for h in data.top_10_holdings[:3]])
            print("  bond_metrics:", data.bond_metrics)
        except Exception as e:
            print(f"  解析异常: {e}")
            import traceback
            traceback.print_exc()
        try:
            import pdfplumber
            with pdfplumber.open(path) as pdf:
                if len(pdf.pages) < 2:
                    continue
                page1 = pdf.pages[1]
                mid_x = page1.width / 2
                split_y = page1.height / 2
                for w in (page1.extract_words() or []):
                    t = w.get("text", "") or ""
                    if "主要投资" in t or "十大持仓" in t:
                        split_y = w.get("top", split_y) - 5
                        break
                quad = _quadrant_words_and_rows(page1, split_y, mid_x, y_tol=6)
                bl_market = _extract_distribution_from_rows(quad["upper_left"])
                bl_sector = _extract_distribution_from_rows(quad["upper_right"])
                bl_holdings = _extract_top10_from_rows(quad["lower_left"])
                bl_bond = _extract_bond_summary_from_rows(quad["lower_right"])
                print("  --- 象限 Debug ---")
                _debug_quadrant("upper_left", quad["upper_left"], bl_market)
                _debug_quadrant("upper_right", quad["upper_right"], bl_sector)
                _debug_quadrant("lower_left", quad["lower_left"], bl_holdings)
                _debug_quadrant("lower_right", quad["lower_right"], bl_bond)
                print("  market_allocation 项数:", len(data.market_allocation), "含「其他」:", "其他" in data.market_allocation)
                print("  sector_allocation 项数:", len(data.sector_allocation), "含「其他」:", "其他" in data.sector_allocation)
                print("  bond_metrics 全字段:", data.bond_metrics)
                is_bond = "债券" in path.name
                has_other = "其他" in data.market_allocation or "其他" in data.sector_allocation
                bond_ok = data.bond_metrics is None or (data.bond_metrics.get("investment_grade_pct") != 94.3 if isinstance(data.bond_metrics.get("investment_grade_pct"), (int, float)) else True)
                meet = (is_bond and len(data.market_allocation) >= 10 and len(data.sector_allocation) >= 12 and has_other and bond_ok) or (
                    (not is_bond) and len(data.market_allocation) >= 11 and len(data.sector_allocation) >= 12 and has_other
                )
                if not meet:
                    print("  [未达标] lower_right rows 便于调试:")
                    for r in quad["lower_right"][:25]:
                        print("    ", r)
        except Exception as e:
            print("  象限 Debug 失败:", e)
    print("\n完成")
