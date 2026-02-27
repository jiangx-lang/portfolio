# -*- coding: utf-8 -*-
"""摩根 (JPMorgan) 基金 Onepage PDF 解析器。"""

import re
from pathlib import Path

from parsers.base_parser import BaseFundParser
from parsers.schemas import BondHolding, FundData, TopHolding

# 样本特征：中文名 + 空格 + 数字，数字后可有可选 %
_ALLOCATION_PATTERN = re.compile(
    r"([\u4e00-\u9fa5]+)\s+(\d+\.?\d*)\s*%?",
    re.UNICODE,
)

# 投资组合分析：时间维度列顺序（与 PDF 文本行中数字顺序一致）
_PERIOD_NAMES = ("近三年", "近五年", "自成立至今")
# 指标行首列关键字
_METRIC_KEYS = ("年化波幅", "Sharpe", "平均每年回报")
# 投资组合分析在页面文本中的行格式：指标名 数 数 数（"-" 表示缺失）
_PA_LINE_PATTERN = re.compile(
    r"^(年化波幅\s*\(?%?\)?|Sharpe\s*比率|平均每年回报\s*\(?%?\)?)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)",
    re.IGNORECASE,
)
# 十大持仓从文本中的模式：名称（英文+空格） 市场 类别 权重（市场/类别为中文）
_MARKETS = "中国内地|中国台湾|韩国|日本|印度|新加坡|中国香港|澳大利亚|马来西亚|泰国|印尼|其他|北美|成熟欧洲|新兴市场|成熟亚太区"
_SECTORS = "资讯科技|通讯服务|工业|非必需消费|金融|必需消费|房地产|健康护理|物料|流动资金"
_HOLDING_LINE_PATTERN = re.compile(
    rf"^(.+?)\s+({_MARKETS})\s+({_SECTORS})\s+(\d+\.?\d*)\s*%?",
    re.UNICODE,
)

# 债券评级（%）：AAA / AA / A / BBB / <BBB，用于计算投资级与高收益占比
_BOND_AAA = re.compile(r"AAA\s*[：:]\s*(\d+\.?\d*)", re.UNICODE)
_BOND_AA = re.compile(r"(?<![A])AA\s*[：:]\s*(\d+\.?\d*)", re.UNICODE)
_BOND_A = re.compile(r"(?<![A])A\s*[：:]\s*(\d+\.?\d*)", re.UNICODE)
_BOND_BBB = re.compile(r"BBB\s*[：:]\s*(\d+\.?\d*)", re.UNICODE)
_BOND_BELOW_BBB = re.compile(r"<BBB\s*[：:]\s*(\d+\.?\d*)", re.UNICODE)
# 平均久期╱平均到期期限（年）：支持全角╱／与半角/，中间可有（年）等
_BOND_DURATION_MATURITY = re.compile(
    r"平均久期\s*[╱/／]\s*平均到期期限[^0-9]*(\d+\.?\d*)\s*[╱/／]\s*(\d+\.?\d*)",
    re.UNICODE,
)
# 期满收益率（%）：括号与%可选，兼容多种排版
_BOND_YTM = re.compile(
    r"期满收益率\s*(?:[（(]%?[)）])?\s*(\d+\.?\d*)",
    re.UNICODE,
)


def _parse_allocation_block(text: str) -> dict[str, float]:
    """从一段文本中提取「名称 数字%」形式的键值对。"""
    result: dict[str, float] = {}
    for m in _ALLOCATION_PATTERN.finditer(text):
        name, num_str = m.group(1).strip(), m.group(2)
        if not name:
            continue
        try:
            value = float(num_str)
            if 0 <= value <= 100:
                result[name] = round(value, 1)
        except ValueError:
            continue
    return result


def _find_block(raw_text: str, start_marker: str, end_marker: str | None) -> str:
    """在全文中的 start_marker 之后、end_marker 之前截取一段文本。"""
    start = raw_text.find(start_marker)
    if start == -1:
        return ""
    block_start = start + len(start_marker)
    if end_marker is None:
        return raw_text[block_start:]
    end = raw_text.find(end_marker, block_start)
    if end == -1:
        return raw_text[block_start:]
    return raw_text[block_start:end]


def _normalize_cell(cell: str | None) -> str:
    """表格单元格标准化：None 或纯空白 -> 空串。"""
    if cell is None:
        return ""
    s = str(cell).strip()
    return s


def _parse_number_cell(cell: str | None) -> float | None:
    """将单元格解析为数值；"-"、空、非数字 -> None。"""
    s = _normalize_cell(cell)
    if s == "" or s == "-" or s.lower() == "n/a":
        return None
    try:
        return float(s)
    except ValueError:
        return None


def _parse_market_sector_from_tables(
    tables: list[list[list[str | None]]],
) -> tuple[dict[str, float], dict[str, float]]:
    """
    从「市场分布/类别分布」表格解析。支持两种布局：
    - 一行两列：首格含「市场分布」、次格含「类别分布」；
    - 两行一列：grid[0][0] 含「市场分布」，grid[1][0] 含「类别分布」。
    """
    market_allocation: dict[str, float] = {}
    sector_allocation: dict[str, float] = {}
    for grid in tables:
        if not grid or len(grid) < 1:
            continue
        first_row = grid[0]
        # 一行两列
        if len(first_row) >= 2:
            c0 = _normalize_cell(first_row[0])
            c1 = _normalize_cell(first_row[1])
            if "市场分布" in c0 and "类别分布" in c1:
                market_allocation = _parse_allocation_block(c0)
                sector_allocation = _parse_allocation_block(c1)
                break
        # 两行一列（市场分布在上，类别分布在下）
        if len(grid) >= 2 and first_row:
            c0 = _normalize_cell(first_row[0])
            if "市场分布" in c0:
                c1 = _normalize_cell(grid[1][0]) if len(grid[1]) > 0 else ""
                if "类别分布" in c1:
                    market_allocation = _parse_allocation_block(c0)
                    sector_allocation = _parse_allocation_block(c1)
                    break
    return market_allocation, sector_allocation


def _find_portfolio_analysis_table(
    tables: list[list[list[str | None]]],
) -> list[list[str | None]] | None:
    """从所有表格中定位「投资组合分析」表：首行含近三年/近五年/自成立至今，首列含年化波幅/Sharpe/平均每年回报。"""
    for grid in tables:
        if not grid or len(grid) < 2:
            continue
        first_row = [_normalize_cell(c) for c in grid[0]]
        # 检查是否包含时间维度列
        if not any(p in " ".join(first_row) for p in _PERIOD_NAMES):
            continue
        # 检查是否有指标行
        for row in grid[1:]:
            c0 = _normalize_cell(row[0] if row else None)
            if any(k in c0 for k in _METRIC_KEYS):
                return grid
    return None


def _parse_portfolio_analysis_from_text(raw_text: str) -> dict[str, dict[str, float | None]]:
    """
    从页面文本解析投资组合分析。文本行格式：年化波幅(%) 19.31 21.40 23.35 / Sharpe比率 0.75 - 0.28 等。
    """
    result: dict[str, dict[str, float | None]] = {}
    for line in raw_text.split("\n"):
        line = line.strip()
        m = _PA_LINE_PATTERN.search(line)
        if not m:
            continue
        metric_raw, v1, v2, v3 = m.group(1), m.group(2), m.group(3), m.group(4)
        if "年化波幅" in metric_raw:
            metric_key = "年化波幅(%)"
        elif "Sharpe" in metric_raw or "sharpe" in metric_raw.lower():
            metric_key = "Sharpe比率"
        elif "平均每年回报" in metric_raw:
            metric_key = "平均每年回报(%)"
        else:
            continue
        result[metric_key] = {
            _PERIOD_NAMES[0]: _parse_number_cell(v1),
            _PERIOD_NAMES[1]: _parse_number_cell(v2),
            _PERIOD_NAMES[2]: _parse_number_cell(v3),
        }
    return result


def _parse_portfolio_analysis(
    grid: list[list[str | None]],
) -> dict[str, dict[str, float | None]]:
    """
    解析投资组合分析表。
    表结构：第一行为时间维度（近三年、近五年、自成立至今），后续行第一列为指标名，其余列为数值；"-" 转为 None。
    """
    result: dict[str, dict[str, float | None]] = {}
    if len(grid) < 2:
        return result

    header = [_normalize_cell(c) for c in grid[0]]
    # 确定时间维度列索引（取能匹配到的）
    period_cols: list[tuple[int, str]] = []
    for i, h in enumerate(header):
        for p in _PERIOD_NAMES:
            if p in h or h in p:
                period_cols.append((i, p))
                break
    if not period_cols:
        return result

    for row in grid[1:]:
        if not row:
            continue
        metric = _normalize_cell(row[0])
        if not metric or not any(k in metric for k in _METRIC_KEYS):
            continue
        # 标准化指标名：保留与样本一致的键
        if "年化波幅" in metric:
            metric_key = "年化波幅(%)"
        elif "Sharpe" in metric or "sharpe" in metric.lower():
            metric_key = "Sharpe比率"
        elif "平均每年回报" in metric:
            metric_key = "平均每年回报(%)"
        else:
            continue
        result[metric_key] = {}
        for col_idx, period_name in period_cols:
            if col_idx < len(row):
                val = _parse_number_cell(row[col_idx])
                result[metric_key][period_name] = val
            else:
                result[metric_key][period_name] = None
    return result


def _parse_top_10_holdings_from_text(raw_text: str) -> list[TopHolding]:
    """从页面文本按行匹配「名称 市场 类别 权重」提取十大持仓（表格未识别时的回退）。"""
    holdings: list[TopHolding] = []
    for line in raw_text.split("\n"):
        line = line.strip()
        m = _HOLDING_LINE_PATTERN.search(line)
        if not m:
            continue
        name, market, sector, weight_str = m.group(1).strip(), m.group(2), m.group(3), m.group(4)
        if not name or name in ("市场", "类别", "十大投资项目"):
            continue
        try:
            w = float(weight_str)
            if 0 <= w <= 100:
                holdings.append(TopHolding(name=name, market=market, sector=sector, weight=round(w, 1)))
        except ValueError:
            continue
        if len(holdings) >= 10:
            break
    return holdings


def _find_top_holdings_table(
    tables: list[list[list[str | None]]],
) -> list[list[str | None]] | None:
    """从所有表格中定位「十大投资项目」表（股票型）：表头含 十大投资项目/市场/类别 及 百分比列。"""
    for grid in tables:
        if not grid or len(grid) < 2:
            continue
        header = " ".join(_normalize_cell(c) for c in (grid[0] or []))
        if "十大投资" in header and ("市场" in header or "类别" in header):
            return grid
    return None


def _find_bond_holdings_table(
    tables: list[list[list[str | None]]],
) -> list[list[str | None]] | None:
    """从所有表格中定位「十大投资项目」表（债券型）：表头含 票息率、到期日 及 %。"""
    for grid in tables:
        if not grid or len(grid) < 1:
            continue
        header = " ".join(_normalize_cell(c) for c in (grid[0] or []))
        if "十大投资" not in header:
            continue
        # 债券表：有票息率、到期日，且无股票型的「市场」「类别」
        if ("票息率" in header or "到期日" in header) and "市场" not in header and "类别" not in header:
            return grid
    return None


def _merge_holding_rows(grid: list[list[str | None]]) -> list[list[str | None]]:
    """
    合并被换行拆开的第一列（股票名称）。
    若某行仅第一列有内容、其余列为空或与上一行同列相同，则将该行第一列拼到上一行第一列后。
    """
    if not grid or len(grid) < 2:
        return grid

    merged: list[list[str | None]] = []
    header = grid[0]
    merged.append(header)

    i = 1
    while i < len(grid):
        row = grid[i]
        if not row:
            i += 1
            continue
        c0 = _normalize_cell(row[0])
        rest = [_normalize_cell(row[j]) for j in range(1, len(row))]

        # 若当前行第一列非空，其余列多为空，且上一行是数据行（非表头），则视为续行
        if merged and len(merged) > 1:
            prev = merged[-1]
            prev_rest = [_normalize_cell(prev[j]) for j in range(1, min(len(prev), len(row)))]
            # 续行特征：第一列有内容，其余列空或与上一行相同
            rest_empty = all(r == "" for r in rest)
            if c0 and rest_empty:
                # 将 c0 拼到上一行第一列
                prev_c0 = _normalize_cell(prev[0])
                new_row = [prev_c0 + " " + c0] + list(prev[1:])
                merged[-1] = new_row
                i += 1
                continue
        merged.append(row)
        i += 1
    return merged


def _parse_top_10_holdings(
    grid: list[list[str | None]],
) -> list[TopHolding]:
    """解析十大投资项目表：列顺序为 名称、市场、类别、权重(%)。"""
    grid = _merge_holding_rows(grid)
    if len(grid) < 2:
        return []

    header = [_normalize_cell(c) for c in grid[0]]
    # 确定列索引：名称(十大投资)、市场、类别、%
    name_col = 0
    market_col = 1
    sector_col = 2
    weight_col = 3
    for i, h in enumerate(header):
        if "十大" in h or "投资" in h or "项目" in h:
            name_col = i
        elif "市场" in h:
            market_col = i
        elif "类别" in h:
            sector_col = i
        elif "%" in h or "比例" in h or h.strip() == "%" or (h.isdigit() is False and h in "％%"):
            weight_col = i
    if weight_col == 3 and sector_col == 2 and market_col == 1:
        pass
    # 兼容仅三列：名称、市场、类别+% 合并等
    if weight_col >= len(header):
        weight_col = max(sector_col, market_col) + 1

    holdings: list[TopHolding] = []
    for row in grid[1:]:
        if not row:
            continue
        name = _normalize_cell(row[name_col]) if name_col < len(row) else ""
        market = _normalize_cell(row[market_col]) if market_col < len(row) else ""
        sector = _normalize_cell(row[sector_col]) if sector_col < len(row) else ""
        weight_val = _parse_number_cell(row[weight_col]) if weight_col < len(row) else None
        # 跳过表头重复行或无效行
        if not name or name in ("市场", "类别", "十大投资项目"):
            continue
        if market and sector and weight_val is not None and 0 <= weight_val <= 100:
            holdings.append(
                TopHolding(
                    name=name,
                    market=market,
                    sector=sector,
                    weight=round(weight_val, 1),
                )
            )
    return holdings[:10]


def _merge_bond_holding_rows(grid: list[list[str | None]]) -> list[list[str | None]]:
    """合并债券表被换行拆开的第一列（债券名称）。"""
    if not grid or len(grid) < 2:
        return grid
    merged: list[list[str | None]] = [grid[0]]
    for i in range(1, len(grid)):
        row = grid[i]
        if not row:
            continue
        c0 = _normalize_cell(row[0])
        rest = [_normalize_cell(row[j]) for j in range(1, len(row))] if len(row) > 1 else []
        if merged and len(merged) > 1 and c0 and all(r == "" for r in rest):
            prev = merged[-1]
            prev_c0 = _normalize_cell(prev[0]) if prev else ""
            merged[-1] = [prev_c0 + " " + c0] + list(prev[1:]) if prev else row
            continue
        merged.append(row)
    return merged


def _parse_top_10_bond_holdings(
    grid: list[list[str | None]],
) -> list[BondHolding]:
    """解析债券型十大投资项目表：列顺序为 名称、票息率、到期日、%。"""
    grid = _merge_bond_holding_rows(grid)
    if len(grid) < 2:
        return []
    header = [_normalize_cell(c) for c in grid[0]]
    name_col = 0
    coupon_col = 1
    maturity_col = 2
    weight_col = 3
    for i, h in enumerate(header):
        if "十大" in h or "投资" in h or "项目" in h:
            name_col = i
        elif "票息" in h:
            coupon_col = i
        elif "到期" in h:
            maturity_col = i
        elif "%" in h or "比例" in h or h.strip() in ("%", "％"):
            weight_col = i
    if weight_col >= len(header):
        weight_col = max(coupon_col, maturity_col) + 1

    holdings: list[BondHolding] = []
    for row in grid[1:]:
        if not row:
            continue
        name = _normalize_cell(row[name_col]) if name_col < len(row) else ""
        coupon_raw = _normalize_cell(row[coupon_col]) if coupon_col < len(row) else ""
        maturity = _normalize_cell(row[maturity_col]) if maturity_col < len(row) else ""
        weight_val = _parse_number_cell(row[weight_col]) if weight_col < len(row) else None
        if not name or name in ("票息率", "到期日", "十大投资项目"):
            continue
        coupon_val: float | None = None
        if coupon_raw:
            coupon_clean = coupon_raw.replace("%", "").replace("％", "").strip()
            coupon_val = _parse_number_cell(coupon_clean if coupon_clean else None)
        if weight_val is not None and 0 <= weight_val <= 100 and maturity:
            holdings.append(
                BondHolding(
                    name=name,
                    coupon_rate=round(coupon_val or 0, 2),
                    maturity=maturity,
                    weight=round(weight_val, 1),
                )
            )
    return holdings[:10]


def _parse_bond_metrics(raw_text: str) -> dict[str, float] | None:
    """
    从页面文本中提取债券指标。纯股票基金无相关字段时返回 None，不抛错。
    投资级 = AAA + AA + A + BBB，高收益 = <BBB；久期/到期期限支持 ／/╱ 等分隔符。
    """
    out: dict[str, float] = {}

    def _pct(m: re.Match | None) -> float | None:
        if not m:
            return None
        try:
            v = float(m.group(1))
            return v if 0 <= v <= 100 else None
        except (ValueError, IndexError):
            return None

    aaa = _pct(_BOND_AAA.search(raw_text))
    aa = _pct(_BOND_AA.search(raw_text))
    a = _pct(_BOND_A.search(raw_text))
    bbb = _pct(_BOND_BBB.search(raw_text))
    below_bbb = _pct(_BOND_BELOW_BBB.search(raw_text))

    if aaa is not None or aa is not None or a is not None or bbb is not None:
        investment_grade = (aaa or 0) + (aa or 0) + (a or 0) + (bbb or 0)
        out["investment_grade_pct"] = round(investment_grade, 1)
    if below_bbb is not None:
        out["high_yield_pct"] = round(below_bbb, 1)

    dm = _BOND_DURATION_MATURITY.search(raw_text)
    if dm:
        try:
            d, m = float(dm.group(1)), float(dm.group(2))
            if d >= 0 and m >= 0:
                out["avg_duration"] = round(d, 1)
                out["avg_maturity"] = round(m, 1)
        except (ValueError, IndexError):
            pass

    ytm = _BOND_YTM.search(raw_text)
    if ytm:
        try:
            y = float(ytm.group(1))
            if 0 <= y <= 100:
                out["yield_to_maturity"] = round(y, 2)
        except (ValueError, IndexError):
            pass

    return out if out else None


class JPMFundParser(BaseFundParser):
    """摩根基金 Onepage PDF 解析器。使用 extract_tables 提取投资组合分析、十大持仓，用文本正则提取市场/类别分布。"""

    def parse(self, file_path: str | Path) -> FundData:
        path = Path(file_path)
        if not path.exists():
            raise FileNotFoundError(f"PDF 文件不存在: {path}")
        if path.suffix.lower() != ".pdf":
            raise ValueError(f"非 PDF 文件: {path}")

        try:
            raw_text = self._extract_text_from_pdf(path)
            tables = self._extract_tables_from_pdf(path)
        except ValueError:
            raise

        fund_name = path.stem

        # 市场 / 类别分布：优先从表格两列单元格解析（准确），否则从文本块+正则
        market_allocation, sector_allocation = _parse_market_sector_from_tables(tables)
        if not market_allocation and not sector_allocation:
            market_block = _find_block(raw_text, "市场分布", "类别分布")
            sector_block = _find_block(raw_text, "类别分布", None)
            market_allocation = _parse_allocation_block(market_block)
            sector_allocation = _parse_allocation_block(sector_block)

        # 投资组合分析：优先从表格解析，否则从页面文本行解析（年化波幅(%) 19.31 21.40 23.35 等）
        portfolio_analysis: dict[str, dict[str, float | None]] = {}
        pa_table = _find_portfolio_analysis_table(tables)
        if pa_table:
            portfolio_analysis = _parse_portfolio_analysis(pa_table)
        if not portfolio_analysis:
            portfolio_analysis = _parse_portfolio_analysis_from_text(raw_text)

        # 十大投资项目（股票型）：优先从表格解析，否则从文本正则解析（名称 市场 类别 权重）
        top_10_holdings: list[TopHolding] = []
        th_table = _find_top_holdings_table(tables)
        if th_table and len(th_table) > 1:
            top_10_holdings = _parse_top_10_holdings(th_table)
        if not top_10_holdings:
            top_10_holdings = _parse_top_10_holdings_from_text(raw_text)

        # 十大投资项目（债券型）：表头含 票息率、到期日
        top_10_bond_holdings: list[BondHolding] = []
        bond_table = _find_bond_holdings_table(tables)
        if bond_table and len(bond_table) > 1:
            top_10_bond_holdings = _parse_top_10_bond_holdings(bond_table)

        bond_metrics = _parse_bond_metrics(raw_text)

        return FundData(
            fund_name=fund_name,
            portfolio_analysis=portfolio_analysis,
            top_10_holdings=top_10_holdings,
            top_10_bond_holdings=top_10_bond_holdings,
            market_allocation=market_allocation,
            sector_allocation=sector_allocation,
            bond_metrics=bond_metrics,
        )
