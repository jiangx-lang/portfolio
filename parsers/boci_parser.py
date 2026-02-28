# -*- coding: utf-8 -*-
"""
中银香港 (BOCI) 基金 PDF 解析器。
核心修复：
1. 目标数据全在第 1 页 (pages[0])。
2. 采用物理裁切 (Crop) 分离双饼图，使用 re.DOTALL 跨行捕获折行标签。
3. 采纳业务建议：针对"香港股票基金"直接硬编码市场分布为香港 100%。
"""

import re
from pathlib import Path

from parsers.base_parser import BaseFundParser
from parsers.schemas import FundData, TopHolding

def _group_words_to_rows(words, cy_tol=5):
    """按垂直中心点重组行，专治错位表格"""
    if not words: return []
    for w in words:
        w['cy'] = (w['top'] + w['bottom']) / 2
    words.sort(key=lambda w: w['cy'])
    
    rows = []
    current_row = []
    for w in words:
        if not current_row:
            current_row.append(w)
        else:
            if abs(w['cy'] - current_row[0]['cy']) <= cy_tol:
                current_row.append(w)
            else:
                current_row.sort(key=lambda x: x['x0'])
                rows.append(current_row)
                current_row = [w]
    if current_row:
        current_row.sort(key=lambda x: x['x0'])
        rows.append(current_row)
    return rows

class BOCIFundParser(BaseFundParser):
    def parse(self, file_path: str | Path) -> FundData:
        path = Path(file_path)
        if not path.exists():
            raise FileNotFoundError(f"PDF 文件不存在: {path}")

        fund_name = path.stem
        portfolio_analysis = {}
        top_10 = []
        market_alloc = {}
        sector_alloc = {}

        try:
            import pdfplumber
            with pdfplumber.open(path) as pdf:
                if len(pdf.pages) > 0:
                    page = pdf.pages[0]  # 数据全在第一页
                    width, height = page.width, page.height
                    
                    # 寻找上下半区的切割线 (锚定"持有最大比重")
                    split_y = height * 0.55
                    words = page.extract_words()
                    for w in words:
                        if "最大比重" in w['text'] or "十大投资" in w['text'] or "十大投資" in w['text']:
                            split_y = w['top'] - 10
                            break

                    # ---------------------------------------------------------
                    # 1. 提取波幅 (右下角区块)
                    # ---------------------------------------------------------
                    br_bbox = (width * 0.5, split_y, width, height)
                    br_text = page.crop(br_bbox).extract_text() or ""
                    # 跨行非贪婪匹配：寻找"标准偏差"后面的第一个百分比（兼容繁体）
                    vol_m = re.search(r'(?:标准偏差|標準偏差).*?(\d+\.\d+)\s*%', br_text, re.DOTALL)
                    if vol_m:
                        portfolio_analysis["年化波幅(%)"] = {"近三年": float(vol_m.group(1))}

                    # ---------------------------------------------------------
                    # 2. 提取十大持仓 (左下角区块)
                    # ---------------------------------------------------------
                    bl_words = [w for w in words if w['top'] > split_y and w['x0'] < width * 0.55]
                    bl_rows = _group_words_to_rows(bl_words, cy_tol=6)
                    for row in bl_rows:
                        row_text = " ".join([w['text'] for w in row])
                        # 匹配：(可选数字序号) + 任意名称 + 权重数字%
                        m = re.search(r'(?:^\d+\s+)?(.*?)\s+(\d+\.\d+)\s*%?$', row_text)
                        if m:
                            name = m.group(1).strip()
                            # 过滤掉偶尔黏连的数字序号 (如 "12345678 小米集团")
                            name = re.sub(r'^[\d\s]+', '', name)
                            if len(name) > 1 and "十大" not in name and "比重" not in name:
                                if len(top_10) < 10:
                                    weight = float(m.group(2))
                                    top_10.append(TopHolding(name=name, market="", sector="", weight=weight))

                    # ---------------------------------------------------------
                    # 3. 提取地区与行业分布 (上半区双饼图)
                    # ---------------------------------------------------------
                    is_hk_fund = "香港股票" in fund_name
                    
                    # 通用解析方法：处理跨行断裂的标签 (如 "其他一\n基金 2.1%")
                    def parse_pie_chart(bbox):
                        text = page.crop(bbox).extract_text() or ""
                        alloc = {}
                        pairs = re.finditer(r'([A-Za-z\u4e00-\u9fa5\(\)（）\-\—\.\&\s\n]+?)\s*(\d+\.\d+)\s*%', text)
                        for p in pairs:
                            # 替换回车，去除首尾引线残留
                            label = p.group(1).replace('\n', '').strip()
                            label = re.sub(r'^[\-\—\.\s]+|[\-\—\.\s]+$', '', label)
                            label = re.sub(r'^其他[一\-\—]', '其他-', label) # 统一"其他"前缀
                            
                            if len(label) > 1 and "配置" not in label:
                                alloc[label] = float(p.group(2))
                        return alloc

                    if is_hk_fund:
                        # 香港股票基金：根据你的业务建议，直接硬编码！
                        market_alloc["香港"] = 100.0
                        # 行业饼图在右侧
                        sector_bbox = (width * 0.4, 0, width, split_y)
                        sector_alloc = parse_pie_chart(sector_bbox)
                    else:
                        # 环球股票基金：中间是行业，右边是地区
                        sector_bbox = (width * 0.25, 0, width * 0.65, split_y)
                        market_bbox = (width * 0.65, 0, width, split_y)
                        sector_alloc = parse_pie_chart(sector_bbox)
                        market_alloc = parse_pie_chart(market_bbox)

        except Exception as e:
            print(f"中银香港 (BOCI) 解析失败: {e}")

        return FundData(
            fund_name=fund_name,
            portfolio_analysis=portfolio_analysis,
            top_10_holdings=top_10,
            top_10_bond_holdings=[],
            market_allocation=market_alloc,
            sector_allocation=sector_alloc,
            bond_metrics=None,
            asset_allocation=None,
        )
