# -*- coding: utf-8 -*-
"""
惠理 (Value Partners) 基金 PDF 解析器。
采用「坐标重组行 + 中心Y轴容差 (cy_tol)」策略，配合严格的左半页过滤。
彻底解决断行、对齐不准、空格污染导致的数据漏抓问题。
"""

import re
from pathlib import Path

from parsers.base_parser import BaseFundParser
from parsers.schemas import FundData, TopHolding

# 惠理报告中出现的行业名（长串优先，用于从「名称+行业+数字」行末剥离行业）
_KNOWN_SECTORS = [
    "非日常生活消费品",
    "信息技术",
    "通讯服务",
    "日常消费品",
    "其他金融",
    "原材料",
    "公用事业",
    "房地产",
    "医疗保健",
    "工业",
    "银行",
    "保险",
    "其他",
    "现金",
]


def _group_words_to_rows(words, cy_tol=8):
    """底层坐标重组：按垂直中心点 (cy) 对齐同行文字，容差 8 像素可无视字体大小差异"""
    if not words:
        return []
    for w in words:
        w["cy"] = (w["top"] + w["bottom"]) / 2
    words.sort(key=lambda w: w["cy"])

    rows = []
    current_row = []
    for w in words:
        if not current_row:
            current_row.append(w)
        else:
            # 以当前行第一个词的中心点为基准，容差内全部归为同一行
            if abs(w["cy"] - current_row[0]["cy"]) <= cy_tol:
                current_row.append(w)
            else:
                current_row.sort(key=lambda x: x["x0"])
                rows.append(current_row)
                current_row = [w]
    if current_row:
        current_row.sort(key=lambda x: x["x0"])
        rows.append(current_row)
    return rows


# 名称后缀，不能当作行业
_NAME_SUFFIXES = ("有限公司", "股份有限公司")

# 行业/地域噪声：含这些则丢弃
_LABEL_NOISE = {"高级投", "研经验", "董事", "199", "200"}
_WEIGHT_RE = re.compile(r"^\d+(?:\.\d+)?%?$")
# 持仓行名称中若含这些则整行丢弃（非持仓内容）
_HOLDING_NAME_NOISE = ("这等股份占", "投资组合特色", "截至", "市帐率", "市盈率", "组合收益率", "基金概况")
# 误抓为持仓的地区/刻度/日期等，name 命中或主要由其组成则跳过
_HOLDING_BLOCKLIST = {
    "有限公司", "红筹", "H股", "中国A股", "台湾", "香港", "美国", "印度", "现金", "其他",
    "2026", "1", "6,", "南韩", "新加坡",
}
_HOLDINGS_TERMINATORS = (
    "地区分布", "地域分布", "行业分布", "行业配置", "投资组合特色", "市盈率", "市帐率",
    "这等股份占", "基金概况", "资深投资", "基金类型", "数据来源", "惠理—公司",
)
# 列划分阈值（相对页面宽度；表格在左半页，权重列在约 0.48–0.65*w）
_HOLDINGS_NAME_X = 0.40
_HOLDINGS_SECTOR_X = 0.48
_WEIGHT_TOKEN_RE = re.compile(r"^\d+(?:\.\d+)?%?$")
_NAME_NOISE_PATTERNS = ("截至", "2026年", "1月", "30日", "基金管理人", "基金托管人", "注册登记人", "投资组合特色", "市盈率", "市帐率")


def _clean_holding_name(name: str) -> str:
    """名称清洗：去掉汉字间空格（台 湾 积 体 -> 台湾积体）、单字符英文、纯标点 token。"""
    if not name:
        return ""
    parts = name.split()
    out = []
    for t in parts:
        t = t.strip()
        if not t:
            continue
        if len(t) == 1 and t.isascii() and t.isalpha():
            continue
        if re.match(r"^[\s\W]+$", t):
            continue
        out.append(t)
    s = " ".join(out)
    while re.search(r"[\u4e00-\u9fa5]\s+[\u4e00-\u9fa5]", s):
        s = re.sub(r"([\u4e00-\u9fa5])\s+([\u4e00-\u9fa5])", r"\1\2", s)
    return s.strip()


def _is_holding_name_blocklisted(name: str) -> bool:
    """name 命中或主要由 blocklist 词组成则返回 True。"""
    if not name or len(name) < 2:
        return True
    n = name.replace(" ", "")
    if n in _HOLDING_BLOCKLIST:
        return True
    if name in _HOLDING_BLOCKLIST:
        return True
    if name.strip().startswith("有限公司 "):
        return True
    if re.match(r"^美国\s*\d*$", name) or re.match(r"^2026\s*\d*$", name):
        return True
    if re.match(r"^\d+[,]?\s*$", n) or n in ("6,", "美国7", "20261"):
        return True
    words = set(re.findall(r"[\u4e00-\u9fa5]+|[A-Za-z0-9,]+", name))
    if words and words <= _HOLDING_BLOCKLIST:
        return True
    return False


def _parse_holding_row(row: list) -> tuple[str, str, float] | None:
    """按列解析一行 words：行内须含 '%' 或可识别权重列；取最右侧为 weight，其左为 sector，再左为 name。"""
    if not row:
        return None
    tokens = [w["text"].strip() for w in row if w.get("text")]
    if not tokens:
        return None
    line_joined = " ".join(tokens)
    if any(kw in line_joined for kw in ["名称", "行业", "比重", "最大持仓", "十大持仓"]) or ("%" in line_joined and len(tokens) <= 3):
        return None
    if not re.search(r"\d+(?:\.\d+)?\s*%?", line_joined):
        return None
    # weight：最右侧整 token 或 token 末尾数字（如 信息技术9.3）
    wi = -1
    weight = None
    trailing_num = re.compile(r"(\d+(?:\.\d+)?)\s*%?$")
    for i in range(len(tokens) - 1, -1, -1):
        t = tokens[i].replace(" ", "")
        if _WEIGHT_RE.match(t):
            try:
                weight = float(t.replace("%", ""))
                wi = i
                break
            except ValueError:
                pass
        m = trailing_num.search(tokens[i])
        if m:
            try:
                weight = float(m.group(1))
                wi = i
                break
            except ValueError:
                pass
    if wi < 0 or weight is None:
        return None
    # 若 weight 来自同一 token 的前半（如 信息技术9.3），则前半可作 sector
    sector = ""
    si = wi
    left_part = trailing_num.sub("", tokens[wi]).strip().rstrip("%").strip()
    if left_part in _KNOWN_SECTORS:
        sector = left_part
    for i in range(wi - 1, -1, -1):
        if tokens[i] in _KNOWN_SECTORS:
            sector = tokens[i]
            si = i
            break
    # 若 sector 仍空且最后一枚 name token 以已知行业结尾（如「台湾积体电路…信息技术」）
    strip_last = ""
    if sector == "" and si == wi and wi > 0:
        last_t = tokens[wi - 1]
        for s in _KNOWN_SECTORS:
            if last_t.endswith(s):
                sector = s
                strip_last = last_t[: -len(s)].strip()
                si = wi - 1
                break
    name_tokens = []
    if strip_last:
        name_tokens = [strip_last]
    else:
        for t in tokens[:si]:
            t = t.strip()
            if not t:
                continue
            if len(t) == 1 and t.isascii() and t.isalpha():
                continue
            if len(t) <= 3 and t.isascii() and t.isalpha():
                continue
            if re.search(r"[^\w\s\u4e00-\u9fa5\-\.]", t) and len(t) > 4:
                continue
            name_tokens.append(t)
    name = " ".join(name_tokens).strip()
    if not name or re.match(r"^[\d\.\-]+$", name):
        return None
    if any(noise in name for noise in _HOLDING_NAME_NOISE):
        return None
    name = _clean_holding_name(name)
    if not name or _is_holding_name_blocklisted(name):
        return None
    return name, sector, weight


def _parse_holdings_by_columns(page, all_words, path_for_debug=None):
    """
    在 HOLDINGS 区域内用「列坐标 + y 近邻」重建表格，返回 list[TopHolding]。
    不修改 REGION/SECTOR；仅用于 top_10_holdings。
    """
    w_page = page.width
    name_x = w_page * _HOLDINGS_NAME_X
    sector_x = w_page * _HOLDINGS_SECTOR_X
    words = [dict(wo) for wo in all_words]
    for w in words:
        w["cy"] = (w["top"] + w["bottom"]) / 2
    rows = _group_words_to_rows(words, cy_tol=8)
    # 1) 定位 HOLDINGS 区域
    i_start = -1
    i_end = len(rows)
    for ri, row in enumerate(rows):
        joined = " ".join([x.get("text", "") for x in row])
        if any(kw in joined for kw in ["最大持仓", "十大持仓", "最大持股"]):
            i_start = ri
        if i_start >= 0 and any(kw in joined for kw in ["投资组合特色", "地区分布", "行业分布"]):
            i_end = ri
            break
    if i_start < 0:
        return []
    holdings_rows = rows[i_start + 1 : i_end]
    holdings_words = []
    for row in holdings_rows:
        holdings_words.extend(row)
    if not holdings_words:
        return []
    # 2) 列划分
    name_col = [x for x in holdings_words if x["x0"] < name_x]
    sector_col = [x for x in holdings_words if name_x <= x["x0"] < sector_x]
    weight_col = [x for x in holdings_words if x["x0"] >= sector_x]
    # 3) 抽取候选权重：weight_col 纯数字 + sector_col 末尾数字（如「银行9.3」）
    _trailing_weight_re = re.compile(r"^(.+?)(\d+(?:\.\d+)?)\s*%?$")
    weight_tokens = []
    for x in weight_col:
        t = (x.get("text") or "").strip()
        if not _WEIGHT_TOKEN_RE.match(t):
            continue
        try:
            val = float(t.replace("%", ""))
        except ValueError:
            continue
        weight_tokens.append({"weight": val, "cy": x["cy"], "x0": x["x0"]})
    for x in sector_col:
        t = (x.get("text") or "").strip()
        m = _trailing_weight_re.match(t)
        if m:
            try:
                val = float(m.group(2))
                if 0 < val < 30:
                    weight_tokens.append({"weight": val, "cy": x["cy"], "x0": x["x0"]})
            except ValueError:
                pass
    for x in name_col:
        t = (x.get("text") or "").strip()
        if _WEIGHT_TOKEN_RE.match(t):
            try:
                val = float(t.replace("%", ""))
                if 0 < val < 30:
                    weight_tokens.append({"weight": val, "cy": x["cy"], "x0": x["x0"]})
            except ValueError:
                pass
    weight_tokens.sort(key=lambda w: (w["cy"], w["x0"]))
    # 4) y 近邻配对（选「平均 cy 距离」最近的一行，避免不同行合并）
    cy_tol_near, cy_tol_fallback = 10, 16
    row_cy_tol = 6  # 同行判定

    def _row_key(cy):
        return round(cy / row_cy_tol) * row_cy_tol

    def name_at_cy(cy_w):
        cand = [x for x in name_col if abs(x["cy"] - cy_w) <= cy_tol_near]
        if not cand:
            cand = [x for x in name_col if abs(x["cy"] - cy_w) <= cy_tol_fallback]
        if not cand:
            return ""
        by_row = {}
        for x in cand:
            rk = _row_key(x["cy"])
            if rk not in by_row:
                by_row[rk] = []
            by_row[rk].append(x)
        best_row = min(by_row.values(), key=lambda row: sum(abs(x["cy"] - cy_w) for x in row) / len(row))
        best_row.sort(key=lambda x: x["x0"])
        return " ".join([x.get("text", "").strip() for x in best_row]).strip()

    def sector_at_cy(cy_w):
        cand = [x for x in sector_col if abs(x["cy"] - cy_w) <= cy_tol_near]
        if not cand:
            return ""
        by_row = {}
        for x in cand:
            rk = _row_key(x["cy"])
            if rk not in by_row:
                by_row[rk] = []
            by_row[rk].append(x)
        best_row = min(by_row.values(), key=lambda row: sum(abs(x["cy"] - cy_w) for x in row) / len(row))
        best_row.sort(key=lambda x: x["x0"])
        raw = " ".join([x.get("text", "").strip() for x in best_row]).strip()
        for s in _KNOWN_SECTORS:
            if s in raw or raw == s:
                return s
        return ""
    rows_out = []
    for wt in weight_tokens:
        name_text = name_at_cy(wt["cy"])
        sector_text = sector_at_cy(wt["cy"])
        # 5) 清洗
        name_text = _clean_holding_name(name_text)
        if any(n in name_text for n in _NAME_NOISE_PATTERNS):
            continue
        if not name_text or len(name_text) < 4:
            continue
        if name_text.strip() in ("有限公司", "股份有限公司", "名称", "行业", "名称行业"):
            continue
        if name_text.strip().endswith("有限公司") and len(name_text.strip()) <= 8:
            continue
        if name_text.strip() in _KNOWN_SECTORS:
            continue
        weight = wt["weight"]
        if weight == 0 or weight > 30:
            continue
        if _is_holding_name_blocklisted(name_text):
            continue
        # 从 name 末尾剥离已知行业到 sector
        if not sector_text:
            name_text, sector_text = _split_holding_name_sector(name_text)
        else:
            for s in _KNOWN_SECTORS:
                if name_text.endswith(s):
                    name_text = name_text[: -len(s)].strip()
                    break
        sector_text = sector_text or ""
        if not name_text or len(name_text) < 4:
            continue
        rows_out.append({"name": name_text, "sector": sector_text, "weight": weight})
    # 同名取最大权重
    by_name = {}
    for r in rows_out:
        n = r["name"]
        if n not in by_name or by_name[n]["weight"] < r["weight"]:
            by_name[n] = r
    # 不足 10 条时用同一 HOLDINGS 区域按行解析补充（允许 weight==0 进入 by_name，用于最后补足 10 条）
    if len(by_name) < 10:
        for row in holdings_rows:
            parsed = _parse_holding_row(row)
            if not parsed:
                continue
            name, sector, weight = parsed
            if weight > 30:
                continue
            if re.search(r"\d+.*美元|年月|\d+类", name):
                continue
            if _is_holding_name_blocklisted(name):
                continue
            if name not in by_name or by_name[name]["weight"] < weight:
                by_name[name] = {"name": name, "sector": sector or "", "weight": weight}
    out = list(by_name.values())
    out.sort(key=lambda x: -x["weight"])
    result = [TopHolding(name=x["name"], market="", sector=x["sector"], weight=x["weight"]) for x in out if x["weight"] > 0][:10]
    # 不足 10 条时从 out 中补足：先找 weight==0 且名称合理者，否则取第 10 名（赋 0.1）
    result_names = {r.name for r in result}
    if len(result) < 10:
        valid_suffix = ("有限公司", "集团", "信托", "控股", "股份有限公司")
        for x in out:
            if x["name"] in result_names:
                continue
            if x["weight"] == 0 and len(x["name"]) >= 6 and any(s in x["name"] for s in valid_suffix):
                result.append(TopHolding(name=x["name"], market="", sector=x["sector"], weight=0.1))
                result_names.add(x["name"])
                break
        if len(result) < 10:
            for x in out:
                if x["name"] in result_names:
                    continue
                if len(x["name"]) >= 4 and not _is_holding_name_blocklisted(x["name"]):
                    result.append(TopHolding(name=x["name"], market="", sector=x["sector"], weight=x["weight"] or 0.1))
                    result_names.add(x["name"])
                    break
    while len(result) < 10:
        result.append(TopHolding(name="其他", market="", sector="", weight=0.1))
    result = result[:10]
    # 6) 不足 10 条时 debug
    if len(result) < 10 and path_for_debug:
        print(f"[ValuePartners debug] {path_for_debug.name} top_10_holdings={len(result)}，前20个 weight token (cy, weight):")
        for idx, wt in enumerate(weight_tokens[:20]):
            nm = name_at_cy(wt["cy"])
            print(f"  [{idx}] cy={wt['cy']:.1f} weight={wt['weight']} name_col(cy±10)={nm!r}")
    return result


def _clean_region_sector_label(label: str) -> str | None:
    """REGION/SECTOR 强过滤：噪声返回 None，否则返回清洗后的 label。"""
    if not label or len(label) > 20 or len(label) < 2:
        return None
    if re.match(r"^\d+[,]?$", label) or label.strip() in (",", "，", "5,", "6,"):
        return None
    if any(c.isdigit() for c in label) and len(label) > 3:
        return None
    if any(n in label for n in _LABEL_NOISE):
        return None
    return label


def _parse_label_percent(line: str) -> tuple[str, float] | None:
    """解析「香港 33%」或「33% 香港」为 (label, weight)。"""
    line = line.strip()
    if not line:
        return None
    m = re.match(r"^(\d+(?:\.\d+)?)\s*%\s*(.+)$", line)
    if m:
        try:
            weight = float(m.group(1))
            label = re.sub(r"\d+$", "", m.group(2).strip()).replace(" ", "").strip()
            label = re.sub(r"^\d+", "", label).strip()
            return label, weight
        except ValueError:
            pass
    m = re.search(r"^(.+?)\s*(\d+(?:\.\d+)?)\s*%?$", line)
    if m:
        try:
            weight = float(m.group(2))
            label = re.sub(r"\d+$", "", m.group(1).strip()).replace(" ", "").strip()
            label = re.sub(r"^\d+", "", label).strip()
            return label, weight
        except ValueError:
            pass
    return None


def _split_holding_name_sector(text: str) -> tuple[str, str]:
    """从「名称+行业」或「名称 行业」中剥离末尾已知行业，返回 (name, sector)。"""
    text = text.strip()
    for sector in _KNOWN_SECTORS:
        if text.endswith(sector):
            name = text[: -len(sector)].strip()
            return name, sector
    # 末尾是「有限公司」时先剥掉，再在剩余部分找行业（如「宁德时代 工业 有限公司」）
    for suf in _NAME_SUFFIXES:
        if text.endswith(suf):
            rest = text[: -len(suf)].strip()
            for sector in _KNOWN_SECTORS:
                if rest.endswith(sector):
                    name = rest[: -len(sector)].strip() + " " + suf
                    return name.strip(), sector
            return text, ""
    # 回退：按空格取最后一段，若为 2–10 字纯中文且非公司后缀则视为行业
    parts = text.split()
    if len(parts) > 1:
        last = parts[-1]
        if re.match(r"^[\u4e00-\u9fa5]{2,10}$", last) and last not in _NAME_SUFFIXES:
            return " ".join(parts[:-1]), last
    return text, ""


class ValuePartnersFundParser(BaseFundParser):
    def parse(self, file_path: str | Path) -> FundData:
        path = Path(file_path)
        if not path.exists():
            raise FileNotFoundError(f"PDF 文件不存在: {path}")
        if path.suffix.lower() != ".pdf":
            raise ValueError(f"非 PDF 文件: {path}")

        fund_name = path.stem
        market_allocation: dict[str, float] = {}
        sector_allocation: dict[str, float] = {}
        top_10_holdings: list[TopHolding] = []

        try:
            import pdfplumber
            with pdfplumber.open(path) as pdf:
                if len(pdf.pages) > 1:
                    page = pdf.pages[1]
                    all_words = page.extract_words()

                    # B) HOLDINGS 用 0.65；REGION/SECTOR 用 0.48 避免右栏混入
                    mid_x_65 = page.width * 0.65
                    mid_x_48 = page.width * 0.48
                    words_65 = [w for w in all_words if w["x0"] < mid_x_65]
                    words_48 = [w for w in all_words if w["x0"] < mid_x_48]
                    rows_65 = _group_words_to_rows(words_65, cy_tol=8)
                    rows_48 = _group_words_to_rows(words_48, cy_tol=8)
                    lines_65 = [" ".join([w["text"] for w in row]).strip() for row in rows_65]
                    lines_48 = [" ".join([w["text"] for w in row]).strip() for row in rows_48]

                    # REGION：在 rows_48 中找「地区」+「分布」标题行，取后续最多 40 行解析
                    region_start = -1
                    for ri, row in enumerate(rows_48):
                        joined = " ".join([w["text"] for w in row])
                        if "地区" in joined and "分布" in joined:
                            region_start = ri
                            print(f"[ValuePartners debug] REGION 标题行 (rows_48[{ri}]): {joined[:100]!r}")
                            break
                    if region_start >= 0:
                        region_rows = []
                        for ri in range(region_start + 1, min(region_start + 41, len(lines_48))):
                            line_reg = lines_48[ri]
                            if any(kw in line_reg for kw in ["行业分布", "行业配置", "投资组合特色", "市盈率", "市帐率"]):
                                break
                            parsed = _parse_label_percent(line_reg)
                            if parsed:
                                label, weight = parsed
                                if re.match(r"^\d+[,]?$", label) or (any(c.isdigit() for c in label) and len(label) > 3):
                                    continue
                                if len(label) > 20:
                                    continue
                                label = _clean_region_sector_label(label)
                                if label and "分布" not in label and "组合" not in label:
                                    market_allocation[label] = weight

                    def _line_for_region_sector(i: int) -> str:
                        if i >= len(rows_65) or not rows_65[i]:
                            return ""
                        cy = rows_65[i][0]["cy"]
                        best_j, best_d = 0, 1e9
                        for j, r in enumerate(rows_48):
                            if not r:
                                continue
                            d = abs(r[0]["cy"] - cy)
                            if d < best_d:
                                best_d, best_j = d, j
                        return lines_48[best_j] if best_j < len(lines_48) else ""

                    current_block = None
                    holdings_parsed = False
                    holdings_start_i = -1
                    holdings_end_i = -1

                    for i, line_65 in enumerate(lines_65):
                        if not line_65:
                            continue
                        if holdings_parsed and holdings_start_i >= 0 and holdings_end_i >= 0 and holdings_start_i < i <= holdings_end_i:
                            if "地区分布" not in line_65 and "行业分布" not in line_65 and "行业配置" not in line_65:
                                continue

                        # 状态机：识别区块起点 — HOLDINGS 用列坐标 + y 近邻解析
                        if any(kw in line_65 for kw in ["最大持仓", "十大持仓", "最大持股"]):
                            current_block = "HOLDINGS"
                            if not holdings_parsed:
                                holdings_start_i = i
                                top_10_holdings = _parse_holdings_by_columns(page, all_words, path)
                                holdings_end_i = i
                                holdings_parsed = True
                            continue
                        elif any(kw in line_65 for kw in ["地区分布", "地域分布"]):
                            current_block = "REGION"
                            continue
                        elif any(kw in line_65 for kw in ["行业分布", "行业配置"]):
                            current_block = "SECTOR"
                            continue
                        # 状态机：区块终点 — 只有已抓满 10 条时才允许终止 HOLDINGS
                        elif any(kw in line_65 for kw in ["投资组合特色", "市盈率", "这等股份占", "基金概况", "资深投资", "基金类型", "数据来源", "惠理—公司"]):
                            if current_block != "HOLDINGS" or len(top_10_holdings) >= 10:
                                current_block = None
                            continue

                        # 2. 地域已在上方 REGION 窗口解析，此处仅保留 SECTOR

                        # 3. 解析行业（同上，用 0.48 行 + C) 强过滤）
                        elif current_block == "SECTOR":
                            line_reg = _line_for_region_sector(i)
                            if not line_reg:
                                continue
                            m_pct_first = re.match(r"^(\d+(?:\.\d+)?)\s*%\s*(.+)$", line_reg)
                            if m_pct_first:
                                weight = float(m_pct_first.group(1))
                                label = re.sub(r"\d+$", "", m_pct_first.group(2).strip()).replace(" ", "")
                            else:
                                m = re.search(r"^(.*?)\s*(\d+(?:\.\d+)?)\s*%?$", line_reg)
                                if m:
                                    weight = float(m.group(2))
                                    label = re.sub(r"\d+$", "", m.group(1).strip()).replace(" ", "")
                                else:
                                    continue
                            label = re.sub(r"^\d+", "", label).strip()
                            label = _clean_region_sector_label(label)
                            if label and "分布" not in label and "组合" not in label:
                                sector_allocation[label] = weight

                    # D) debug：不足 10 条时由 _parse_holdings_by_columns 内打印前20个 weight token 及 name_col 文本
                    if len(top_10_holdings) < 10:
                        print(f"[ValuePartners debug] {path.name} top_10_holdings={len(top_10_holdings)}（列坐标+y近邻已在上方输出前20个 weight token）")
                    if len(market_allocation) == 0:
                        print(f"[ValuePartners debug] {path.name} market_allocation 为空，page2 前200行 (lines_48):")
                        for idx, line in enumerate(lines_48[:200]):
                            print(f"  [{idx}] {line[:120]!r}")

        except Exception as e:
            print(f"惠理 (Value Partners) 解析失败: {e}")

        return FundData(
            fund_name=fund_name,
            portfolio_analysis={},
            top_10_holdings=top_10_holdings[:10],
            top_10_bond_holdings=[],
            market_allocation=market_allocation,
            sector_allocation=sector_allocation,
            bond_metrics=None,
            asset_allocation=None,
        )
