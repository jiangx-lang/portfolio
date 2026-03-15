"""
sc_fund_parser_qwen_v2.py
══════════════════════════════════════════════════════════════════
渣打 QDII 基金 PDF → SQLite  |  v2  |  Qwen-VL 驱动
目标：精准解析 · 异常捕获 · 人机协同验证

新增（v2）：
  • funds.status / funds.review_reason（置信度标记）
  • parsing_logs 表（详细解析日志，parse_log 保留）
  • uncertain_fields / null_key_fields / field_positions（坐标）
  • 反幻觉 Prompt v2（仅提取图中可见内容，占位示例，严禁捏造）
  • validate_and_fix v2（权重总和异常 → 中止入库）
  • jsonschema 校验（失败自动重试一次）
  • CLI 三色汇总：[OK] 成功 / [!] 需审核 / [ERR] 失败
  • --audit 命令：逐条审核 needs_review 记录（y/n 确认入库）
  • 文件错误时自动重新下载一次：PDF 缺失、损坏或 0 页时，会从渣打 CDN 重下再重试（仅 cn-fs-qdur/qdut）

用法：
  python sc_fund_parser_qwen_v2.py --dir ./sc_funds_qdii
  python sc_fund_parser_qwen_v2.py --file cn-fs-qdur048.pdf
  python sc_fund_parser_qwen_v2.py --audit          # 人工审核待确认记录
  python sc_fund_parser_qwen_v2.py --summary         # 数据库摘要
  python sc_fund_parser_qwen_v2.py --review          # 查看待确认新字段
  python sc_fund_parser_qwen_v2.py --confirm 3       # 确认新字段 #3
  python sc_fund_parser_qwen_v2.py --ignore  3       # 忽略新字段 #3
  python sc_fund_parser_qwen_v2.py --dir ... --pause-on-new-pending
      # 一旦出现新 pending 就暂停，方便你 --review/添加列后再次运行断点继续
"""

import os, re, sys, json, sqlite3, base64, argparse, datetime, time
from pathlib import Path
from typing import Optional

try:
    import requests
except ImportError:
    requests = None  # 重下载功能可选

# Windows 下强制 stdout/stderr 使用 UTF-8，避免 GBK 无法编码 emoji 等字符导致崩溃
if sys.platform == "win32":
    import io
    if hasattr(sys.stdout, "buffer"):
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    if hasattr(sys.stderr, "buffer"):
        sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

import fitz          # pymupdf
from openai import OpenAI

# ── 依赖检查 ──────────────────────────────────────────────────────
try:
    import jsonschema
    HAS_JSONSCHEMA = True
except ImportError:
    HAS_JSONSCHEMA = False
    print("[WARN] jsonschema 未安装，跳过 JSON schema 校验。"
          "  pip install jsonschema")

# ══════════════════════════════════════════════════════════════════
# 0. 配置
# ══════════════════════════════════════════════════════════════════
DB_PATH       = Path("./sc_funds.db")
MAX_PAGES     = 6      # 每份 PDF 最多渲染前 N 页
DPI           = 150    # 渲染分辨率
MAX_RETRIES   = 1      # JSON 校验失败后重试次数

# 文件错误时自动重新下载一次（渣打 PDF 的 CDN 地址）
REDOWNLOAD_BASE_URL = "https://av.sc.com/cn/content/docs/"
REDOWNLOAD_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36",
    "Accept": "application/pdf,*/*",
    "Referer": "https://www.sc.com/cn/investment/qdii-series/global-fund-selection/",
}


def redownload_pdf_once(pdf_path: Path) -> bool:
    """
    当 PDF 无法打开或页数为 0 时，尝试从渣打 CDN 重新下载一次（仅支持 cn-fs-qdur*.pdf / cn-fs-qdut*.pdf）。
    返回 True 表示已成功下载并覆盖本地文件。
    """
    if not requests:
        return False
    name = pdf_path.name
    if not name.endswith(".pdf"):
        return False
    if not (name.startswith("cn-fs-qdur") or name.startswith("cn-fs-qdut")):
        return False
    url = REDOWNLOAD_BASE_URL + name
    try:
        r = requests.get(url, timeout=25, headers=REDOWNLOAD_HEADERS)
        r.raise_for_status()
        pdf_path.parent.mkdir(parents=True, exist_ok=True)
        pdf_path.write_bytes(r.content)
        return True
    except Exception:
        return False


# Qwen 模型：qwen-vl-max（最强）/ qwen-vl-plus（快+省钱）
QWEN_MODEL    = "qwen-vl-max"
QWEN_BASE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1"

# API 计费（元/千 tokens，仅供参考，以阿里云控制台为准）
# 通义千问 VL 降价后约：输入 0.003 元/千tokens，输出约 0.012 元/千tokens
PRICE_INPUT_CNY_PER_1K  = 0.003   # 输入
PRICE_OUTPUT_CNY_PER_1K = 0.012   # 输出

# 关键字段列表：这些字段为 null 时触发 needs_review
KEY_FIELDS = [
    "fund_name_cn", "isin_codes", "sc_product_codes",
    "inception_date", "mgmt_fee_pct", "sc_risk_rating",
    "investment_objective",
]

# 已知字段白名单（不触发 pending_new_fields 提示）
KNOWN_FIELDS = {
    "sc_product_codes","reg_codes","series_prefix","fund_number",
    "fund_name_cn","fund_name_en","fund_manager_company",
    "inception_date","base_currency","available_currencies",
    "fund_aum_usd","aum_date","isin_codes","bloomberg_codes",
    "mgmt_fee_pct","custody_fee_pct","admin_fee_pct","other_fees_note",
    "sc_risk_rating","annualized_std_3y","avg_ytm","avg_duration",
    "investment_objective","data_source","data_as_of",
    "share_class","currency","ret_3m","ret_6m","ret_ytd",
    "ret_1y","ret_3y","ret_5y","ret_since_inception",
    "ret_2025","ret_2024","ret_2023","ret_2022","ret_2021",
    "ret_2020","ret_2019","ret_2018","ret_2017","ret_2016",
    "ret_2015","ret_2014","ret_2013",
    "benchmark_name","bench_ret_3m","bench_ret_1y","bench_ret_3y",
    "bench_ret_5y","bench_ret_since_inception","nav","nav_currency",
    "holding_name","holding_type","weight_pct","rank",
    "region","sector","asset_class","rating",
    "record_date","ex_div_date","dividend_per_share",
    "nav_on_ex_date","annualized_yield_pct",
    "name","title","bio",
    "uncertain_fields","unknown_fields","field_positions",
    "asset_value_note","inception_dates_note",
    "代客境外理财系列","全球基金精选",
    "风险提示",
    "产品发行人的权益",
    "资料来源",
    "基金资料",
    "基金表现",
    "请致电",
    "www.sc.com/cn",
    "特别声明",
    "产品红利",
    "基金经理",
    "基金过往派息记录", "A股-累积-欧元", "A股-累积-美元(对冲)", "A股-累积-美元", "派息政策", "最不利投资情形", "可认购单位类别", "分红频率", "拟分配频率", "年化派息率", "注册地", "十大持仓", "资产配置", "管理费 (年费率)", "信托管理人费用 (年费率)", "其他费用", "自推出以来", "同类基金平均值", "投资经理", "投资管理人", "行业分布", "十大主要投资", "持续性收费", "投资组合的主要持仓", "贝他 (β年)", "夏普比率 (3年)", "行业投资分布", "资产分布", "产品红利的派发行为", "A(累计) - 人民币对冲类别", "A(累计) - 欧元对冲类别", "相关费用", "持有份额", "境外基金十大投资项目", "基金存续规模可参见基金资产值", "若因市场内部和外部原因，基金产品如不能按约定及时变现，投资者可能会蒙受损失", "关于持仓规模", "境外基金定收益资产分布", "基金类别", "派息频率", "资产类别分布", "十一大持股", "主要投资 (%)", "其他", "美国", "德国", "意大利", "加拿大", "荷兰", "法国", "西班牙", "英国", "管理及顾问费", "经营及行政开支", "A类美元对冲", "主题分布(%)",     "行业资产分布 (%)", "资产分布 (%)", "业务分布(%)", "产品红利的频率和具体金额由境外产品发行人决定",     "境外基金行业资产分布 (%)",
    "十大发行人",
    "到日期日分布", "到期日分布", "期限分布",
    "行业区域分布",
    "投资范围",
}

# 备注分项：这些字段从 unknown 中识别后写入 fund_notes 表，不进入 pending
NOTE_FIELDS = ("投资目标摘要", "分散投资策略", "捕捉理想投资机会", "投资经验丰富", "投资组合多元化", "亚洲经济增长强劲", "投资风格审慎", "为什么要投资于邓普顿环球债券基金", "境外基金投资目标与特色", "为什么投资于宏利环球基金 — 巨龙增长基金", "表现卓越", "投资范围")

# 业绩基准（benchmark）单独项目：写入 funds.performance_benchmark
BENCHMARK_FIELDS = ("产品业绩", "业绩基准", "产品业绩基准", "业绩比较基准", "基准", "基准名称", "产品投资基准", "参考指数", "参考指数*", "业绩表现", "基准指数", "基准表现", "基金累积表现", "基金年度表现", "产品所投资境外基金的业绩基准", "基准比较", "彭博环球Multiverse指数", "产品业绩比较基准", "基准^", "MSCI 综合世界总回报（净额）指数", "累计表现(%)", "历年报酬(%)", "单年度表现", "累计回报按美元计算(%)", "历月回报按美元计算(%)", "累计回报(%)", "基金总回报(%)", "年度表现(%)", "累计表现(%)", "境外基金表现（以计价货币计）", "境外基金表现*", "境外基金表现", "年度表现")

# 中文别名 -> 主表 funds 列名，解析到后写入主表对应列
MAIN_TABLE_ALIASES = {"彭博代码": "bloomberg_codes", "产品代码": "sc_product_codes", "ISIN代码": "isin_codes", "成立日期": "inception_date", "计价货币": "available_currencies", "基金存续规模": "fund_size_note", "ISIN号码": "isin_codes", "彭博编码": "bloomberg_codes", "彭博代号": "bloomberg_codes", "投资目标": "investment_objective", "基金总值": "fund_size_note"}

# 单位资产净值：写入 fund_performance.nav（解析 "39.20美元" -> nav=39.20, nav_currency=USD）
NAV_ALIASES = ("单位资产净值", "本月最后交易日净值", "当月基金净值", "本月最后一个交易日单位净值", "当月基金净值**", "基金净资产净值")

# 年化标准差（3年）：衡量波动性，写入 funds.annualized_std_3y
STD_ALIASES = ("年化标准差(3年)", "年化标准差")

# 地区分布：解析「国家 比例%」写入 regional_allocation (region + weight_pct)
REGION_DISTRIBUTION_ALIASES = ("地区分布", "国家/地区分布", "国家／地区分布", "地区投资分布", "国家/地区分布(%)", "投资地区分布")

# 货币分布：解析「货币 比例%」写入 currency_allocation (currency + weight_pct)
CURRENCY_DISTRIBUTION_ALIASES = ("货币分布",)

# 十大发行人：解析「名称 比例%」写入 top_holdings，与十大持仓并存（rank 从 11 起避免覆盖）
TOP_HOLDINGS_ALIASES = ("十大发行人",)

# 到期日/期限分布：解析「区间: 比例」写入 maturity_allocation（债券/货币基金）
MATURITY_ALIASES = ("到日期日分布", "到期日分布", "期限分布")

# 行业区域分布：解析「类别: 比例」写入 sector_allocation（与行业分布同表）
SECTOR_ALLOCATION_ALIASES = ("行业区域分布",)

# CIP 渣打风险评级：1-6 对应备注，方便阅读
SC_RISK_RATING_CIP_MAP = {
    "风险规避型": 1, "保守型": 2, "稳健型": 3,
    "适度积极型": 4, "积极型": 5, "非常积极型": 6,
}


# ══════════════════════════════════════════════════════════════════
# 1. 数据库 Schema（v2）
# ══════════════════════════════════════════════════════════════════
SCHEMA_V2 = """
PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;

-- ── 主表：新增 status / review_reason ──────────────────────────
CREATE TABLE IF NOT EXISTS funds (
    id                   INTEGER PRIMARY KEY AUTOINCREMENT,
    source_file          TEXT NOT NULL UNIQUE,
    parsed_at            TEXT,
    -- 置信度标记
    status               INTEGER DEFAULT 0,
        -- 0=待处理  1=已入库(正常)  2=需人工确认
    review_reason        TEXT,   -- "nav为空; mgmt_fee不确定"
    -- 产品标识
    sc_product_codes     TEXT,
    reg_codes            TEXT,
    series_prefix        TEXT,
    fund_number          TEXT,
    -- 基金信息
    fund_name_cn         TEXT,
    fund_name_en         TEXT,
    fund_manager_company TEXT,
    inception_date       TEXT,
    base_currency        TEXT,
    available_currencies TEXT,
    fund_aum_usd         REAL,
    aum_date             TEXT,
    fund_size_note       TEXT,   -- 存续规模原文/说明（如 可参见基金资产值）
    isin_codes           TEXT,
    bloomberg_codes      TEXT,
    -- 费用
    mgmt_fee_pct         REAL,
    custody_fee_pct      REAL,
    admin_fee_pct        REAL,
    other_fees_note      TEXT,
    -- 风险
    sc_risk_rating       TEXT,
    sc_risk_rating_cip   INTEGER,  -- CIP 渣打风险评级 1-6，见备注
    annualized_std_3y    REAL,
    avg_ytm              REAL,
    avg_duration         REAL,
    -- 其他
    investment_objective TEXT,
    data_source          TEXT,
    data_as_of           TEXT,
    -- 方便查询：资产净值/成立日期 原文或按份额说明
    asset_value_note    TEXT,   -- 基金总值、基金资产净值按份额说明（图中原文）
    inception_dates_note TEXT,  -- 成立日期按份额说明（如 2001-05-14 A美元 2005-10-25 A欧元）
    performance_benchmark TEXT  -- 业绩基准/产品业绩（benchmark）单独项目
);

CREATE TABLE IF NOT EXISTS fund_managers (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    fund_id   INTEGER NOT NULL REFERENCES funds(id) ON DELETE CASCADE,
    name      TEXT NOT NULL,
    title     TEXT,
    bio       TEXT,
    UNIQUE(fund_id, name)
);

CREATE TABLE IF NOT EXISTS fund_performance (
    id                   INTEGER PRIMARY KEY AUTOINCREMENT,
    fund_id              INTEGER NOT NULL REFERENCES funds(id) ON DELETE CASCADE,
    share_class          TEXT,
    currency             TEXT,
    as_of_date           TEXT NOT NULL,
    ret_3m  REAL, ret_6m  REAL, ret_ytd REAL,
    ret_1y  REAL, ret_3y  REAL, ret_5y  REAL,
    ret_since_inception  REAL,
    ret_2025 REAL, ret_2024 REAL, ret_2023 REAL, ret_2022 REAL,
    ret_2021 REAL, ret_2020 REAL, ret_2019 REAL, ret_2018 REAL,
    ret_2017 REAL, ret_2016 REAL, ret_2015 REAL, ret_2014 REAL,
    ret_2013 REAL,
    benchmark_name              TEXT,
    bench_ret_3m  REAL, bench_ret_1y  REAL, bench_ret_3y  REAL,
    bench_ret_5y  REAL, bench_ret_since_inception REAL,
    nav          REAL,
    nav_currency TEXT,
    UNIQUE(fund_id, share_class, as_of_date)
);

CREATE TABLE IF NOT EXISTS dividend_history (
    id                   INTEGER PRIMARY KEY AUTOINCREMENT,
    fund_id              INTEGER NOT NULL REFERENCES funds(id) ON DELETE CASCADE,
    sc_product_code      TEXT,
    share_class          TEXT,
    currency             TEXT,
    record_date          TEXT,
    ex_div_date          TEXT NOT NULL,
    dividend_per_share   REAL,
    nav_on_ex_date       REAL,
    annualized_yield_pct REAL,
    UNIQUE(fund_id, sc_product_code, ex_div_date)
);

CREATE TABLE IF NOT EXISTS top_holdings (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    fund_id      INTEGER NOT NULL REFERENCES funds(id) ON DELETE CASCADE,
    as_of_date   TEXT,
    rank         INTEGER,
    holding_name TEXT NOT NULL,
    holding_type TEXT,
    weight_pct   REAL,
    UNIQUE(fund_id, as_of_date, rank)
);

CREATE TABLE IF NOT EXISTS regional_allocation (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    fund_id    INTEGER NOT NULL REFERENCES funds(id) ON DELETE CASCADE,
    as_of_date TEXT,
    region     TEXT NOT NULL,
    weight_pct REAL,
    page_region TEXT,   -- Qwen 返回的页面位置描述
    UNIQUE(fund_id, as_of_date, region)
);

CREATE TABLE IF NOT EXISTS currency_allocation (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    fund_id    INTEGER NOT NULL REFERENCES funds(id) ON DELETE CASCADE,
    as_of_date TEXT,
    currency   TEXT NOT NULL,
    weight_pct REAL,
    UNIQUE(fund_id, as_of_date, currency)
);

CREATE TABLE IF NOT EXISTS sector_allocation (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    fund_id    INTEGER NOT NULL REFERENCES funds(id) ON DELETE CASCADE,
    as_of_date TEXT,
    sector     TEXT NOT NULL,
    weight_pct REAL,
    UNIQUE(fund_id, as_of_date, sector)
);

CREATE TABLE IF NOT EXISTS asset_class_allocation (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    fund_id     INTEGER NOT NULL REFERENCES funds(id) ON DELETE CASCADE,
    as_of_date  TEXT,
    asset_class TEXT NOT NULL,
    weight_pct  REAL,
    UNIQUE(fund_id, as_of_date, asset_class)
);

CREATE TABLE IF NOT EXISTS credit_rating_allocation (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    fund_id    INTEGER NOT NULL REFERENCES funds(id) ON DELETE CASCADE,
    as_of_date TEXT,
    rating     TEXT NOT NULL,
    weight_pct REAL,
    UNIQUE(fund_id, as_of_date, rating)
);

-- 到期日/期限分布（债券、货币基金：1-7天、8-30天等区间占比）
CREATE TABLE IF NOT EXISTS maturity_allocation (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    fund_id      INTEGER NOT NULL REFERENCES funds(id) ON DELETE CASCADE,
    as_of_date   TEXT,
    bucket_label TEXT NOT NULL,
    weight_pct   REAL,
    UNIQUE(fund_id, as_of_date, bucket_label)
);

-- ── 备注分项（单独存说明类字段，如投资目标摘要、分散投资策略等）────────────
CREATE TABLE IF NOT EXISTS fund_notes (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    fund_id  INTEGER NOT NULL REFERENCES funds(id) ON DELETE CASCADE,
    note_type TEXT NOT NULL,
    content   TEXT,
    UNIQUE(fund_id, note_type)
);

-- ── 旧日志表（保留，不删）───────────────────────────────────────
CREATE TABLE IF NOT EXISTS parse_log (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    source_file   TEXT,
    parsed_at     TEXT,
    status        TEXT,
    fields_found  TEXT,
    fields_missing TEXT,
    error_msg     TEXT
);

-- ── 新详细日志表 ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS parsing_logs (
    id                    INTEGER PRIMARY KEY AUTOINCREMENT,
    source_file           TEXT NOT NULL,
    parsed_at             TEXT NOT NULL,
    status                TEXT NOT NULL,  -- success/partial/failed
    -- 模型不确定的字段
    uncertain_fields      TEXT,   -- JSON: [{"field":"nav","reason":"...","position":"..."}]
    -- 关键字段中为 null 的
    null_key_fields       TEXT,   -- JSON: ["fund_name_cn","isin_codes"]
    -- 校验错误
    validation_errors     TEXT,   -- JSON: ["region合计=112%","ret_3m==ret_1y"]
    -- 模型返回的字段坐标
    field_positions       TEXT,   -- JSON: {"fund_name_cn":{"page":1,"region":"top-center"}}
    -- 原始响应前500字（调试用）
    raw_response_preview  TEXT,
    -- 错误信息
    error_msg             TEXT,
    -- 重试次数
    retry_count           INTEGER DEFAULT 0
);

-- ── 待确认新字段 ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pending_new_fields (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    source_file     TEXT,
    term_found      TEXT,
    sample_value    TEXT,
    suggested_table TEXT,
    suggested_col   TEXT,
    confirmed       INTEGER DEFAULT 0,
    created_at      TEXT
);

-- ── 视图 ─────────────────────────────────────────────────────────
CREATE VIEW IF NOT EXISTS v_fund_overview AS
SELECT f.fund_number, f.fund_name_cn, f.fund_manager_company,
       f.sc_risk_rating, f.sc_product_codes, f.fund_aum_usd,
       f.aum_date, f.mgmt_fee_pct, f.annualized_std_3y,
       f.avg_ytm, f.avg_duration, f.base_currency,
       f.status, f.review_reason, f.source_file
FROM funds f;

CREATE VIEW IF NOT EXISTS v_needs_review AS
SELECT f.id, f.fund_name_cn, f.sc_product_codes,
       f.review_reason, f.source_file, f.parsed_at
FROM funds f WHERE f.status = 2;

CREATE VIEW IF NOT EXISTS v_latest_performance AS
SELECT f.fund_name_cn, f.sc_risk_rating, p.share_class, p.currency,
       p.as_of_date, p.ret_ytd, p.ret_1y, p.ret_3y, p.ret_5y, p.nav
FROM fund_performance p JOIN funds f ON f.id = p.fund_id;

-- 累积表现表格：YTD、3/6/1/3/5年，方便查询
CREATE VIEW IF NOT EXISTS v_fund_cumulative_performance AS
SELECT f.id AS fund_id, f.fund_name_cn, f.sc_product_codes,
       p.share_class, p.currency, p.as_of_date,
       p.ret_ytd AS ytd_pct,
       p.ret_3m AS ret_3m_pct,
       p.ret_6m AS ret_6m_pct,
       p.ret_1y AS ret_1y_pct,
       p.ret_3y AS ret_3y_pct,
       p.ret_5y AS ret_5y_pct,
       p.ret_since_inception AS ret_since_inception_pct,
       p.nav AS nav_last_trading_day,
       p.nav_currency,
       p.benchmark_name,
       p.bench_ret_3m, p.bench_ret_1y, p.bench_ret_3y, p.bench_ret_5y,
       p.bench_ret_since_inception
FROM funds f
JOIN fund_performance p ON p.fund_id = f.id;

-- 年度表现表格：按会计年度单独年份，方便查询
CREATE VIEW IF NOT EXISTS v_fund_annual_performance AS
SELECT f.id AS fund_id, f.fund_name_cn, f.sc_product_codes,
       p.share_class, p.currency, p.as_of_date,
       p.ret_2013 AS y2013, p.ret_2014 AS y2014, p.ret_2015 AS y2015,
       p.ret_2016 AS y2016, p.ret_2017 AS y2017, p.ret_2018 AS y2018,
       p.ret_2019 AS y2019, p.ret_2020 AS y2020, p.ret_2021 AS y2021,
       p.ret_2022 AS y2022, p.ret_2023 AS y2023, p.ret_2024 AS y2024,
       p.ret_2025 AS y2025,
       p.benchmark_name
FROM funds f
JOIN fund_performance p ON p.fund_id = f.id;

-- CIP 渣打风险评级：数字 1-6 + 备注，方便阅读
CREATE VIEW IF NOT EXISTS v_fund_risk_cip AS
SELECT f.id AS fund_id, f.fund_name_cn, f.sc_product_codes,
       f.sc_risk_rating_cip AS cip,
       CASE f.sc_risk_rating_cip
           WHEN 1 THEN '风险规避型' WHEN 2 THEN '保守型' WHEN 3 THEN '稳健型'
           WHEN 4 THEN '适度积极型' WHEN 5 THEN '积极型' WHEN 6 THEN '非常积极型'
           ELSE NULL END AS cip_label,
       f.sc_risk_rating AS sc_risk_rating_text
FROM funds f
WHERE f.sc_risk_rating_cip IS NOT NULL OR f.sc_risk_rating IS NOT NULL;

-- 波动性单独项目：标准差等，衡量基金波动性，方便查询
CREATE VIEW IF NOT EXISTS v_fund_volatility AS
SELECT f.id AS fund_id, f.fund_name_cn, f.sc_product_codes,
       f.sc_risk_rating,
       f.annualized_std_3y AS std_3y_pct,
       f.avg_ytm, f.avg_duration,
       f.data_as_of
FROM funds f
WHERE f.annualized_std_3y IS NOT NULL OR f.avg_ytm IS NOT NULL OR f.avg_duration IS NOT NULL;

-- 成立日期单独项目：方便查询基金有多少历史
CREATE VIEW IF NOT EXISTS v_fund_inception AS
SELECT f.id AS fund_id, f.fund_name_cn, f.sc_product_codes,
       f.inception_date,
       f.inception_dates_note,
       CASE WHEN f.inception_date GLOB '[0-9][0-9][0-9][0-9]-*'
            THEN ROUND((julianday('now') - julianday(f.inception_date)) / 365.25, 1)
            ELSE NULL END AS history_years
FROM funds f
WHERE f.inception_date IS NOT NULL OR f.inception_dates_note IS NOT NULL;
"""

# ── Schema 迁移（为已有数据库添加新列）────────────────────────────
MIGRATIONS = [
    "ALTER TABLE funds ADD COLUMN status INTEGER DEFAULT 0",
    "ALTER TABLE funds ADD COLUMN review_reason TEXT",
    "ALTER TABLE regional_allocation ADD COLUMN page_region TEXT",
    "ALTER TABLE funds ADD COLUMN asset_value_note TEXT",
    "ALTER TABLE funds ADD COLUMN inception_dates_note TEXT",
    "ALTER TABLE funds ADD COLUMN performance_benchmark TEXT",
    "ALTER TABLE funds ADD COLUMN fund_size_note TEXT",
    "ALTER TABLE funds ADD COLUMN sc_risk_rating_cip INTEGER",
]

def init_db(db_path: Path) -> sqlite3.Connection:
    conn = sqlite3.connect(db_path)
    conn.executescript(SCHEMA_V2)
    # 迁移：忽略"已存在"错误
    for sql in MIGRATIONS:
        try:
            conn.execute(sql)
        except sqlite3.OperationalError:
            pass
    conn.commit()
    return conn


# ══════════════════════════════════════════════════════════════════
# 2. JSON Schema（用于 jsonschema 校验）
# ══════════════════════════════════════════════════════════════════
RESPONSE_JSONSCHEMA = {
    "type": "object",
    "required": ["fund_info", "managers", "performance", "dividends",
                 "top_holdings", "regional_allocation", "sector_allocation",
                 "asset_class_allocation", "credit_rating_allocation",
                 "uncertain_fields", "unknown_fields", "field_positions"],
    "properties": {
        "fund_info": {
            "type": "object",
            "properties": {
                "fund_name_cn":    {"type": ["string", "null"]},
                "fund_aum_usd":    {"type": ["number", "null"]},
                "mgmt_fee_pct":    {"type": ["number", "null"]},
                "custody_fee_pct": {"type": ["number", "null"]},
                "admin_fee_pct":   {"type": ["number", "null"]},
                "sc_risk_rating":  {"type": ["string", "null"]},
                "inception_date":  {"type": ["string", "null"]},
                "data_as_of":      {"type": ["string", "null"]},
            }
        },
        "managers":               {"type": "array"},
        "performance":            {"type": "array"},
        "dividends":              {"type": "array"},
        "top_holdings":           {"type": "array"},
        "regional_allocation":    {"type": "array"},
        "sector_allocation":      {"type": "array"},
        "asset_class_allocation": {"type": "array"},
        "credit_rating_allocation":{"type": "array"},
        "uncertain_fields":       {"type": "array"},
        "unknown_fields":         {"type": "array"},
        "field_positions":        {"type": "object"},
    }
}


# ══════════════════════════════════════════════════════════════════
# 3. PDF → 图片
# ══════════════════════════════════════════════════════════════════
def pdf_to_images_b64(pdf_path: Path, max_pages: int = MAX_PAGES) -> list[str]:
    doc = fitz.open(str(pdf_path))
    images = []
    for i, page in enumerate(doc):
        if i >= max_pages:
            break
        pix  = page.get_pixmap(dpi=DPI)
        images.append(base64.standard_b64encode(pix.tobytes("png")).decode())
    doc.close()
    return images


# ══════════════════════════════════════════════════════════════════
# 4. Prompt v2（反幻觉 + 坐标 + 占位示例）
# ══════════════════════════════════════════════════════════════════
EXTRACTION_PROMPT_V2 = """
════════════════════ 反幻觉总则（最高优先级）════════════════════
你只能输出从当前提供的图片中能直接看到的文字或数字。
- 若某字段在图中没有、被遮挡、模糊或无法确定对应关系：必须填 null，禁止猜测、推断。
- 严禁使用本 prompt 示例里的任何具体数字（如 2156.53、8.51、44.33）作为真实数据。
  示例中的数字仅说明字段含义和格式，实际数据必须从图片中读取。
- 你的回复必须仅包含一个合法 JSON 对象，不要在 JSON 前后输出任何推理、总结或说明文字。
- 不确定项只通过 uncertain_fields 在 JSON 内表达。
- 下列格式说明中的 <...> 仅为字段含义提示，请用图中实际内容或 null 填充，禁止直接输出 <...> 这段提示文字本身。
════════════════════════════════════════════════════════════════

你是专业的基金数据提取专家。从渣打银行 QDII 基金说明书 PDF 图片中提取结构化数据。

规则：
- 数字去掉%只保留数值（1.35%→1.35）
- 日期统一用 YYYY-MM-DD
- 图中找不到的字段必须填 null，不得用 0 或空字符串代替
- 列表没有数据填 []

返回格式（严格按此 JSON 结构，所有字段名不得改变）：

{
  "fund_info": {
    "sc_product_codes":     "<从图中提取，如 QDUR048USD,QDUR048CNY>",
    "reg_codes":            "<理财系统登记编码，逗号分隔>",
    "series_prefix":        "<从产品编号提取：QDUT→qdut，QDUR→qdur>",
    "fund_number":          "<三位数字，如 048>",
    "fund_name_cn":         "<基金中文名，图中没有则 null>",
    "fund_name_en":         null,
    "fund_manager_company": "<管理公司名，如贝莱德、富兰克林邓普顿>",
    "inception_date":       "<YYYY-MM-DD，图中没有则 null>",
    "base_currency":        "<USD/CNY/EUR/AUD>",
    "available_currencies": "<逗号分隔>",
    "fund_aum_usd":         "<见规则A：统一转换为百万美元的纯数字，没有则 null>",
    "aum_date":             "<基金总值对应的截至日期 YYYY-MM-DD>",
    "isin_codes":           "<逗号分隔，没有则 null>",
    "bloomberg_codes":      "<逗号分隔，没有则 null>",
    "mgmt_fee_pct":         "<见规则B：管理费年费率数字，没有则 null>",
    "custody_fee_pct":      "<见规则B：最高保管费数字，没有则 null>",
    "admin_fee_pct":        "<见规则B：最高维持费/行政费数字，没有则 null>",
    "other_fees_note":      "<其余费用文字说明>",
    "sc_risk_rating":       "<见规则D：只取勾选的那一项>",
    "annualized_std_3y":    "<年化标准差3年%数字，没有则 null>",
    "avg_ytm":              "<平均到期殖利率%数字，没有则 null>",
    "avg_duration":         "<平均存续期间年数，没有则 null>",
    "investment_objective": "<投资目标原文，没有则 null>",
    "data_source":          "<资料来源，如晨星，贝莱德>",
    "data_as_of":           "<数据截至日期 YYYY-MM-DD>",
    "asset_value_note":     "<基金总值、基金资产净值按份额的图中原文，如 基金总值: 1.89十亿 基金资产净值 A(累计)美元: 47.02亿美元，没有则 null>",
    "inception_dates_note": "<成立日期按份额说明，如 2001-05-14 (A美元) 2005-10-25 (A欧元)，没有则 null>"
  },

  "managers": [
    {
      "name":  "<姓名，图中没有则整条不加>",
      "title": "<职称>",
      "bio":   "<简介>"
    }
  ],

  "performance": [
    {
      "share_class": "<份额类别，如 A6美元稳定派息股份>",
      "currency":    "<USD/CNY/EUR/AUD>",
      "as_of_date":  "<YYYY-MM-DD>",
      "ret_3m":      "<见规则C：3个月%数字>",
      "ret_6m":      "<6个月%，没有则 null>",
      "ret_ytd":     "<年初至今%>",
      "ret_1y":      "<1年%，严禁与ret_3m相同>",
      "ret_3y":      "<3年%>",
      "ret_5y":      "<5年%>",
      "ret_since_inception": "<成立至今%>",
      "ret_2025": null, "ret_2024": null, "ret_2023": null,
      "ret_2022": null, "ret_2021": null, "ret_2020": null,
      "ret_2019": null, "ret_2018": null, "ret_2017": null,
      "ret_2016": null, "ret_2015": null, "ret_2014": null, "ret_2013": null,
      "benchmark_name":           "<基准名称>",
      "bench_ret_3m":  null, "bench_ret_1y": null,
      "bench_ret_3y":  null, "bench_ret_5y": null,
      "bench_ret_since_inception": null,
      "nav":          "<最新净值数字，没有则 null>",
      "nav_currency": "<USD/CNY>"
    }
  ],

  "dividends": [
    {
      "sc_product_code":      "<如 QDUR048USD，可省略>",
      "share_class":          "<份额类别，可省略>",
      "currency":             "<货币，可省略>",
      "record_date":          "<记录日 YYYY-MM-DD，可省略>",
      "ex_div_date":          "<除息日 YYYY-MM-DD，用于区分每一条>",
      "dividend_per_share":   "<每股股息，可省略>",
      "nav_on_ex_date":       "<除息日净值，可省略>",
      "annualized_yield_pct": "<【必填】股息率(年化)%数字，图中「股息率(年化)」列必须填入>"
    }
  ],

  "top_holdings": [
    {
      "rank":         1,
      "holding_name": "<见规则E：持仓名称>",
      "holding_type": "<bond/equity/cash>",
      "weight_pct":   "<比重%数字>"
    }
  ],

  "regional_allocation": [
    {
      "region":      "<地区名，如 印度>",
      "weight_pct":  "<比重%数字>",
      "page_region": "<该数据在页面上的大概位置，如 page1-left-pie-chart>"
    }
  ],

  "sector_allocation": [
    {"sector": "<行业名>", "weight_pct": "<比重%数字>"}
  ],

  "asset_class_allocation": [
    {"asset_class": "<资产类别>", "weight_pct": "<比重%数字>"}
  ],

  "credit_rating_allocation": [
    {"rating": "<AAA/AA/A/BBB/BB/B/CCC/未评级>", "weight_pct": "<比重%数字>"}
  ],

  "uncertain_fields": [
    {
      "field":    "<字段名，如 nav>",
      "reason":   "<不确定原因，如 图中未标明份额类别>",
      "position": "<该字段在页面的位置描述，如 page2-right-table>"
    }
  ],

  "unknown_fields": [
    {
      "term":    "<图中出现但不在以上字段的重要数据名称>",
      "value":   "<原始值>",
      "context": "<在哪个位置/表格发现的>"
    }
  ],

  "field_positions": {
    "<字段名>": {
      "page":        "<页码，从1开始>",
      "region":      "<页面区域描述，如 top-left / center-table / right-pie>",
      "description": "<简短说明，如 基金总值标题下方>"
    }
  }
}

══════════════════ 提取规则（务必严格遵守）══════════════════

【规则A：基金总值 fund_aum_usd → 统一转换为百万美元】
- "4,080百万美元"       → 4080.0
- "18,104.08百万美元"   → 18104.08
- "1.89十亿美元"        → 1890.0  （×1000）
- "18.9亿美元"          → 1890.0  （亿×100）
- "47.02亿美元"         → 4702.0
- aum_date 取"截至XXXX年X月XX日"对应的日期
- 若图中找不到基金总值：fund_aum_usd=null，aum_date=null

【规则B：费用字段——必须分开，禁止都填入 other_fees_note】
- mgmt_fee_pct    = "管理费（年费率）" 后的数字
- custody_fee_pct = "最高保管费" 或 "保管费（年费率）" 后的最高数字
- admin_fee_pct   = "最高维持费" 或 "行政费（年费率）" 后的最高数字
- 若某费率图中未出现 → 该字段填 null（不要填 0）
- other_fees_note = 其余费用文字说明（登记费、固定金额等）

【规则C：业绩表格——列错位是最常见错误】
表格通常列顺序：3个月 | 年初至今 | 1年 | 3年 | 5年 | (10年可忽略) | 成立至今
对应字段：      ret_3m   ret_ytd    ret_1y  ret_3y  ret_5y              ret_since_inception

★ 严禁 ret_3m == ret_1y（若两值相同说明列错位，重新对齐）
★ 基准行在基金行正下方，按同样列顺序填 bench_ret_* 字段
★ 年度业绩表（"年度表现"/"单年度表现"）单独填 ret_2025...ret_2013
★ nav = "本月最后交易日净值" 后的数字（注意对应份额）
★ 每个份额类别（A6美元/A8人民币等）单独一个 performance 对象

【规则D：风险评级】
只取有"√"、"✓"、实心框"■"或明显勾选标记的那一项：
风险规避型 / 保守型 / 稳健型 / 适度积极型 / 积极型 / 非常积极型

【规则E：持仓类型判断】
- 名称含 MTN/REGS/GILT/NOTE/BOND/PIK/ABS → "bond"
- 纯公司名（微软/苹果/英伟达等）→ "equity"
- 现金或衍生品 → "cash"
- 最多提取 10 条，不足则有几条填几条

【规则F：版面与基金公司差异】
不同基金公司（摩根/贝莱德/富达等）版面可能完全不同：
- 可能没有"基金总值"、可能用英文或繁体
- 请按图中实际出现的标题提取，对应到本 JSON 字段
- 若某类信息在本 PDF 中不存在 → 对应字段 null / 对应列表 []
- 禁止用其他基金的典型值填充缺失数据

【规则H：派息记录——股息率(年化)必填】
- 若有「境外基金过往派息记录」或类似表格，每条记录必须提取「股息率(年化)」或「年化派息率」列，填入 annualized_yield_pct（数字，如 5.80 表示 5.80%）。
- 除息日 ex_div_date 用于区分每条记录，尽量填写。
- 其他列（记录日、每股股息、除息日净值等）可省略，但 annualized_yield_pct 必须计入数据库。

【规则G：field_positions（坐标辅助）】
对以下关键字段，若能在图中定位，填入 field_positions：
fund_name_cn、fund_aum_usd、sc_risk_rating、mgmt_fee_pct、
nav、inception_date、sc_product_codes
格式：{"page": 1, "region": "top-center", "description": "封面标题处"}
若无法定位则不填该字段的 positions（不要填 null）
"""


# ══════════════════════════════════════════════════════════════════
# 5. Qwen-VL 调用（含重试）
# ══════════════════════════════════════════════════════════════════
def _usage_from_response(resp) -> dict:
    """从 API 响应提取用量（兼容 OpenAI / DashScope 字段名）"""
    u = getattr(resp, "usage", None)
    if not u:
        return {"input_tokens": 0, "output_tokens": 0}
    inp = getattr(u, "input_tokens", None) or getattr(u, "prompt_tokens", None) or 0
    out = getattr(u, "output_tokens", None) or getattr(u, "completion_tokens", None) or 0
    return {"input_tokens": inp, "output_tokens": out}


def call_qwen(images_b64: list[str], api_key: str,
              retry_hint: str = "") -> tuple[str, str, dict]:
    """
    调用 Qwen-VL，返回 (raw_text, model_name, usage_dict)
    usage_dict: {"input_tokens": int, "output_tokens": int}
    """
    client = OpenAI(api_key=api_key, base_url=QWEN_BASE_URL)

    content = []
    for img_b64 in images_b64:
        content.append({
            "type": "image_url",
            "image_url": {"url": f"data:image/png;base64,{img_b64}"}
        })

    prompt = EXTRACTION_PROMPT_V2
    if retry_hint:
        prompt += f"\n\n【重试提示】上次输出存在以下问题，请修正：{retry_hint}"

    content.append({"type": "text", "text": prompt})

    resp = client.chat.completions.create(
        model=QWEN_MODEL,
        messages=[{"role": "user", "content": content}],
        max_tokens=8000,
    )
    usage = _usage_from_response(resp)
    return resp.choices[0].message.content, QWEN_MODEL, usage


def parse_json_response(raw: str) -> dict:
    """从模型输出中提取并解析 JSON"""
    # 去掉 markdown code block
    text = re.sub(r'^```(?:json)?\s*', '', raw.strip(), flags=re.MULTILINE)
    text = re.sub(r'^```\s*$', '',   text.strip(), flags=re.MULTILINE)
    text = text.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        # 尝试提取最大 JSON 块
        m = re.search(r'\{.*\}', text, re.DOTALL)
        if m:
            return json.loads(m.group())
        raise ValueError(f"无法解析 JSON，原始输出前300字：{raw[:300]}")


def validate_schema(data: dict) -> list[str]:
    """jsonschema 校验，返回错误列表"""
    if not HAS_JSONSCHEMA:
        return []
    errors = []
    try:
        jsonschema.validate(data, RESPONSE_JSONSCHEMA)
    except jsonschema.ValidationError as e:
        errors.append(f"JSONSchema: {getattr(e, 'message', str(e))}")
    return errors


# ══════════════════════════════════════════════════════════════════
# 6. validate_and_fix v2（权重总和异常 → 中止入库）
# ══════════════════════════════════════════════════════════════════
class ValidationAbort(Exception):
    """权重总和严重异常，中止该文件入库"""
    pass

def validate_and_fix(data: dict, source_file: str) -> tuple[dict, list[str], list[str]]:
    """
    返回 (修复后data, warnings列表, validation_errors列表)
    warnings   → 打印但继续入库
    validation_errors 含 ABORT 前缀 → 抛 ValidationAbort
    """
    warnings   = []
    val_errors = []
    fi = data.get("fund_info") or {}

    # ── A. AUM 单位自动修正 ────────────────────────────────────────
    aum = fi.get("fund_aum_usd")
    if aum is not None:
        if aum < 10:
            fi["fund_aum_usd"] = round(aum * 1000, 2)
            warnings.append(f"AUM={aum} 疑似十亿单位，已×1000 → {fi['fund_aum_usd']}M")
        elif 10 < aum < 100:
            warnings.append(f"AUM={aum}M 请确认单位（若原文为{aum}亿应为{aum*100}M）")

    # ── B. 管理费异常（模型可能把 1.35% 填成 135）──────────────────
    mgmt = fi.get("mgmt_fee_pct")
    if mgmt is not None:
        if mgmt > 5:
            fi["mgmt_fee_pct"] = round(mgmt / 100, 4)
            warnings.append(f"mgmt_fee_pct={mgmt} 超过5%，已÷100 → {fi['mgmt_fee_pct']}")
        elif mgmt < 0.05:
            warnings.append(f"mgmt_fee_pct={mgmt} 异常偏低，请确认")

    # ── C. 业绩列错位 ──────────────────────────────────────────────
    for p in (data.get("performance") or []):
        r3m, r1y = p.get("ret_3m"), p.get("ret_1y")
        sc = p.get("share_class", "?")
        if r3m is not None and r1y is not None and abs(r3m - r1y) < 0.001:
            val_errors.append(f"[{sc}] ret_3m={r3m}==ret_1y={r1y}，疑似列错位")
        ytd = p.get("ret_ytd")
        # 黄金/矿业等基金 1 年回报常 >80%，易被误标为 ytd；仅对极端值报错
        if ytd is not None and abs(ytd) > 500:
            val_errors.append(f"[{sc}] ret_ytd={ytd} 超出合理范围")

    # ── D. 分配权重总和检查（严重异常 → 中止入库）──────────────────
    alloc_checks = [
        ("regional_allocation",      "region",      "地区分布"),
        ("sector_allocation",        "sector",      "行业分布"),
        ("asset_class_allocation",   "asset_class", "资产类别"),
        ("credit_rating_allocation", "rating",      "信用评级"),
    ]
    for key, _, label in alloc_checks:
        rows = data.get(key) or []
        if not rows:
            continue
        total = sum(r.get("weight_pct") or 0 for r in rows)
        if total > 115 or total < 80:
            msg = f"ABORT:{label}权重合计={total:.1f}%，严重偏离100%"
            val_errors.append(msg)
            raise ValidationAbort(
                f"{label}权重合计={total:.1f}%（允许范围80%~115%），"
                f"数据异常，中止入库 [{source_file}]"
            )
        elif total > 105 or total < 95:
            warnings.append(f"{label}权重合计={total:.1f}%，轻微偏差（允许±5%）")

    # ── E. 持仓权重合计（宽松检查，仅警告）───────────────────────
    holdings = data.get("top_holdings") or []
    if holdings:
        total_w = sum(h.get("weight_pct") or 0 for h in holdings)
        if total_w > 80:
            warnings.append(f"top_holdings 权重合计={total_w:.1f}%，可能重复")

    # ── F. 风险评级合法性 ─────────────────────────────────────────
    valid_ratings = {"风险规避型","保守型","稳健型","适度积极型","积极型","非常积极型"}
    rating = fi.get("sc_risk_rating")
    if rating and rating not in valid_ratings:
        warnings.append(f"sc_risk_rating='{rating}' 不在合法列表")

    data["fund_info"] = fi
    return data, warnings, val_errors


# ══════════════════════════════════════════════════════════════════
# 7. 置信度判断（决定 status）
# ══════════════════════════════════════════════════════════════════
def determine_status(data: dict, val_errors: list[str]) -> tuple[int, str]:
    """
    返回 (status, review_reason)
    status: 1=正常入库  2=需人工确认
    """
    reasons = []

    # 关键字段为空
    fi = data.get("fund_info") or {}
    null_keys = [f for f in KEY_FIELDS if fi.get(f) is None]
    if null_keys:
        reasons.append(f"关键字段为null: {', '.join(null_keys)}")

    # 模型标注不确定
    uncertain = data.get("uncertain_fields") or []
    if uncertain:
        u_fields = [u.get("field","?") for u in uncertain]
        reasons.append(f"模型不确定: {', '.join(u_fields)}")

    # 校验警告（非中止级）
    non_abort = [e for e in val_errors if not e.startswith("ABORT:")]
    if non_abort:
        reasons.append(f"校验警告: {'; '.join(non_abort)}")

    if reasons:
        return 2, "; ".join(reasons)
    return 1, ""


# ══════════════════════════════════════════════════════════════════
# 8. 数据入库
# ══════════════════════════════════════════════════════════════════
def insert_fund(conn, source_file, data, status, review_reason) -> int:
    fi  = data.get("fund_info") or {}
    now = datetime.datetime.now().isoformat()
    conn.execute("""
        INSERT INTO funds (
            source_file, parsed_at, status, review_reason,
            sc_product_codes, reg_codes, series_prefix, fund_number,
            fund_name_cn, fund_name_en, fund_manager_company,
            inception_date, base_currency, available_currencies,
            fund_aum_usd, aum_date, isin_codes, bloomberg_codes,
            mgmt_fee_pct, custody_fee_pct, admin_fee_pct, other_fees_note,
            sc_risk_rating, sc_risk_rating_cip, annualized_std_3y, avg_ytm, avg_duration,
            investment_objective, data_source, data_as_of,
            asset_value_note, inception_dates_note, performance_benchmark, fund_size_note
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        ON CONFLICT(source_file) DO UPDATE SET
            parsed_at=excluded.parsed_at,
            status=excluded.status,
            review_reason=excluded.review_reason,
            sc_product_codes=excluded.sc_product_codes,
            fund_name_cn=excluded.fund_name_cn,
            fund_manager_company=excluded.fund_manager_company,
            fund_aum_usd=excluded.fund_aum_usd,
            aum_date=excluded.aum_date,
            sc_risk_rating=excluded.sc_risk_rating,
            sc_risk_rating_cip=COALESCE(excluded.sc_risk_rating_cip, sc_risk_rating_cip),
            mgmt_fee_pct=excluded.mgmt_fee_pct,
            custody_fee_pct=excluded.custody_fee_pct,
            admin_fee_pct=excluded.admin_fee_pct,
            annualized_std_3y=excluded.annualized_std_3y,
            investment_objective=excluded.investment_objective,
            data_as_of=excluded.data_as_of,
            asset_value_note=excluded.asset_value_note,
            inception_dates_note=excluded.inception_dates_note,
            performance_benchmark=COALESCE(excluded.performance_benchmark, performance_benchmark),
            fund_size_note=COALESCE(excluded.fund_size_note, fund_size_note)
    """, (
        source_file, now, status, review_reason,
        fi.get("sc_product_codes"), fi.get("reg_codes"),
        fi.get("series_prefix"),    fi.get("fund_number"),
        fi.get("fund_name_cn"),     fi.get("fund_name_en"),
        fi.get("fund_manager_company"),
        fi.get("inception_date"),   fi.get("base_currency"),
        fi.get("available_currencies"),
        fi.get("fund_aum_usd"),     fi.get("aum_date"),
        fi.get("isin_codes"),       fi.get("bloomberg_codes"),
        fi.get("mgmt_fee_pct"),     fi.get("custody_fee_pct"),
        fi.get("admin_fee_pct"),    fi.get("other_fees_note"),
        fi.get("sc_risk_rating"),
        fi.get("sc_risk_rating_cip") or SC_RISK_RATING_CIP_MAP.get(fi.get("sc_risk_rating") or ""),
        fi.get("annualized_std_3y"),
        fi.get("avg_ytm"),          fi.get("avg_duration"),
        fi.get("investment_objective"),
        fi.get("data_source"),      fi.get("data_as_of"),
        fi.get("asset_value_note"), fi.get("inception_dates_note"),
        fi.get("performance_benchmark"), fi.get("fund_size_note"),
    ))
    return conn.execute(
        "SELECT id FROM funds WHERE source_file=?", (source_file,)
    ).fetchone()[0]


def insert_managers(conn, fund_id, managers):
    for m in (managers or []):
        try:
            conn.execute("""
                INSERT INTO fund_managers(fund_id,name,title,bio)
                VALUES(?,?,?,?)
                ON CONFLICT(fund_id,name) DO UPDATE SET
                    title=excluded.title, bio=excluded.bio
            """, (fund_id, m.get("name"), m.get("title"), m.get("bio")))
        except Exception as e:
            print(f"    [WARN] manager: {e}")


def insert_performance(conn, fund_id, performances, as_of_date):
    for p in (performances or []):
        aod = p.get("as_of_date") or as_of_date
        try:
            conn.execute("""
                INSERT INTO fund_performance(
                    fund_id,share_class,currency,as_of_date,
                    ret_3m,ret_6m,ret_ytd,ret_1y,ret_3y,ret_5y,ret_since_inception,
                    ret_2025,ret_2024,ret_2023,ret_2022,ret_2021,
                    ret_2020,ret_2019,ret_2018,ret_2017,ret_2016,ret_2015,ret_2014,ret_2013,
                    benchmark_name,
                    bench_ret_3m,bench_ret_1y,bench_ret_3y,bench_ret_5y,
                    bench_ret_since_inception,nav,nav_currency
                ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
                ON CONFLICT(fund_id,share_class,as_of_date) DO UPDATE SET
                    ret_ytd=excluded.ret_ytd, ret_1y=excluded.ret_1y,
                    ret_3y=excluded.ret_3y,   ret_5y=excluded.ret_5y,
                    nav=excluded.nav
            """, (
                fund_id, p.get("share_class"), p.get("currency"), aod,
                p.get("ret_3m"),  p.get("ret_6m"),  p.get("ret_ytd"),
                p.get("ret_1y"),  p.get("ret_3y"),  p.get("ret_5y"),
                p.get("ret_since_inception"),
                p.get("ret_2025"), p.get("ret_2024"), p.get("ret_2023"),
                p.get("ret_2022"), p.get("ret_2021"), p.get("ret_2020"),
                p.get("ret_2019"), p.get("ret_2018"), p.get("ret_2017"),
                p.get("ret_2016"), p.get("ret_2015"), p.get("ret_2014"),
                p.get("ret_2013"),
                p.get("benchmark_name"),
                p.get("bench_ret_3m"),  p.get("bench_ret_1y"),
                p.get("bench_ret_3y"),  p.get("bench_ret_5y"),
                p.get("bench_ret_since_inception"),
                p.get("nav"), p.get("nav_currency"),
            ))
        except Exception as e:
            print(f"    [WARN] performance: {e}")


def insert_dividends(conn, fund_id, dividends):
    for d in (dividends or []):
        try:
            conn.execute("""
                INSERT INTO dividend_history(
                    fund_id,sc_product_code,share_class,currency,
                    record_date,ex_div_date,dividend_per_share,
                    nav_on_ex_date,annualized_yield_pct
                ) VALUES(?,?,?,?,?,?,?,?,?)
                ON CONFLICT(fund_id,sc_product_code,ex_div_date) DO UPDATE SET
                    dividend_per_share=excluded.dividend_per_share,
                    annualized_yield_pct=excluded.annualized_yield_pct
            """, (
                fund_id, d.get("sc_product_code"), d.get("share_class"),
                d.get("currency"), d.get("record_date"), d.get("ex_div_date"),
                d.get("dividend_per_share"), d.get("nav_on_ex_date"),
                d.get("annualized_yield_pct"),
            ))
        except Exception as e:
            print(f"    [WARN] dividend: {e}")


def insert_holdings(conn, fund_id, holdings, as_of_date):
    for h in (holdings or []):
        try:
            conn.execute("""
                INSERT INTO top_holdings(fund_id,as_of_date,rank,holding_name,holding_type,weight_pct)
                VALUES(?,?,?,?,?,?)
                ON CONFLICT(fund_id,as_of_date,rank) DO UPDATE SET
                    holding_name=excluded.holding_name, weight_pct=excluded.weight_pct
            """, (fund_id, as_of_date, h.get("rank"), h.get("holding_name"),
                  h.get("holding_type"), h.get("weight_pct")))
        except Exception as e:
            print(f"    [WARN] holding: {e}")


def insert_allocations(conn, fund_id, data, as_of_date):
    # regional_allocation 多一个 page_region 字段
    for row in (data.get("regional_allocation") or []):
        try:
            conn.execute("""
                INSERT INTO regional_allocation(fund_id,as_of_date,region,weight_pct,page_region)
                VALUES(?,?,?,?,?)
                ON CONFLICT(fund_id,as_of_date,region) DO UPDATE SET
                    weight_pct=excluded.weight_pct,
                    page_region=excluded.page_region
            """, (fund_id, as_of_date, row.get("region"),
                  row.get("weight_pct"), row.get("page_region")))
        except Exception as e:
            print(f"    [WARN] regional_allocation: {e}")

    for key, col, table in [
        ("sector_allocation",        "sector",      "sector_allocation"),
        ("asset_class_allocation",   "asset_class", "asset_class_allocation"),
        ("credit_rating_allocation", "rating",      "credit_rating_allocation"),
    ]:
        for row in (data.get(key) or []):
            try:
                conn.execute(f"""
                    INSERT INTO {table}(fund_id,as_of_date,{col},weight_pct)
                    VALUES(?,?,?,?)
                    ON CONFLICT(fund_id,as_of_date,{col}) DO UPDATE SET
                        weight_pct=excluded.weight_pct
                """, (fund_id, as_of_date, row.get(col), row.get("weight_pct")))
            except Exception as e:
                print(f"    [WARN] {table}: {e}")


def handle_unknown_fields(conn, source_file, unknown_fields, fund_id=None, as_of_date=None):
    now = datetime.datetime.now().isoformat()
    new_ones = []
    for uf in (unknown_fields or []):
        term = uf.get("term", "")
        if not term:
            continue
        value = str(uf.get("value", ""))
        # 备注分项：写入 fund_notes，不进入 pending
        if term in NOTE_FIELDS and fund_id is not None:
            try:
                conn.execute("""
                    INSERT INTO fund_notes (fund_id, note_type, content)
                    VALUES(?,?,?)
                    ON CONFLICT(fund_id, note_type) DO UPDATE SET content=excluded.content
                """, (fund_id, term, value))
            except Exception as e:
                print(f"    [WARN] fund_notes: {e}")
            continue
        # 业绩基准（benchmark）单独项目：写入 funds.performance_benchmark
        if term in BENCHMARK_FIELDS and fund_id is not None:
            try:
                row = conn.execute(
                    "SELECT performance_benchmark FROM funds WHERE id=?", (fund_id,)
                ).fetchone()
                existing = (row[0] or "").strip() if row else ""
                new_val = f"{existing} | {value}" if existing else value
                conn.execute(
                    "UPDATE funds SET performance_benchmark=? WHERE id=?",
                    (new_val.strip(), fund_id),
                )
            except Exception as e:
                print(f"    [WARN] performance_benchmark: {e}")
            continue
        # 单位资产净值等 -> 写入 fund_performance.nav（更新该 fund 最近一条 performance）
        if term in NAV_ALIASES and fund_id is not None:
            try:
                m = re.search(r"([\d,]+\.?\d*)\s*", value)
                nav_num = float((m.group(1) or "0").replace(",", "")) if m else None
                cur_map = {"美元": "USD", "欧元": "EUR", "人民币": "CNY", "港元": "HKD", "港币": "HKD"}
                nav_cur = "USD"
                for k, v in cur_map.items():
                    if k in value:
                        nav_cur = v
                        break
                if nav_num is not None:
                    conn.execute("""
                        UPDATE fund_performance SET nav=?, nav_currency=?
                        WHERE id = (SELECT id FROM fund_performance WHERE fund_id=? ORDER BY as_of_date DESC LIMIT 1)
                    """, (nav_num, nav_cur, fund_id))
            except Exception as e:
                print(f"    [WARN] nav update: {e}")
            continue
        # 年化标准差（3年）：衡量波动性 -> funds.annualized_std_3y
        if term in STD_ALIASES and fund_id is not None:
            try:
                m = re.search(r"([\d,]+\.?\d*)\s*", value)
                std_val = float((m.group(1) or "0").replace(",", "")) if m else None
                if std_val is not None:
                    conn.execute(
                        "UPDATE funds SET annualized_std_3y=? WHERE id=?",
                        (std_val, fund_id),
                    )
            except Exception as e:
                print(f"    [WARN] annualized_std_3y update: {e}")
            continue
        # 地区分布：解析「国家 比例%」分别写入 regional_allocation (region + weight_pct)
        if term in REGION_DISTRIBUTION_ALIASES and fund_id is not None and as_of_date:
            try:
                # 解析 "美国 12.3%, 巴西 13%, 印尼 11%" -> [(美国, 12.3), (巴西, 13), ...]
                parts = re.findall(r"([^,，]+?)\s+([\d.]+)\s*%", value)
                for region_name, pct_str in parts:
                    region_name = region_name.strip()
                    if not region_name:
                        continue
                    try:
                        weight = float(pct_str)
                        conn.execute("""
                            INSERT INTO regional_allocation(fund_id, as_of_date, region, weight_pct)
                            VALUES(?,?,?,?)
                            ON CONFLICT(fund_id, as_of_date, region) DO UPDATE SET weight_pct=excluded.weight_pct
                        """, (fund_id, as_of_date, region_name, weight))
                    except ValueError:
                        pass
            except Exception as e:
                print(f"    [WARN] regional_allocation from text: {e}")
            continue
        # 货币分布：解析「货币 比例%」分别写入 currency_allocation (currency + weight_pct)
        if term in CURRENCY_DISTRIBUTION_ALIASES and fund_id is not None and as_of_date:
            try:
                parts = re.findall(r"([^,，]+?)\s+([-\d.]+)\s*%", value)
                for curr_name, pct_str in parts:
                    curr_name = curr_name.strip()
                    if not curr_name:
                        continue
                    try:
                        weight = float(pct_str)
                        conn.execute("""
                            INSERT INTO currency_allocation(fund_id, as_of_date, currency, weight_pct)
                            VALUES(?,?,?,?)
                            ON CONFLICT(fund_id, as_of_date, currency) DO UPDATE SET weight_pct=excluded.weight_pct
                        """, (fund_id, as_of_date, curr_name, weight))
                    except ValueError:
                        pass
            except Exception as e:
                print(f"    [WARN] currency_allocation from text: {e}")
            continue
        # 十大发行人：解析「名称 比例%」写入 top_holdings（rank 11 起，与十大持仓 1-10 并存）
        if term in TOP_HOLDINGS_ALIASES and fund_id is not None and as_of_date:
            try:
                parts = re.findall(r"([^,，]+?)\s+([\d.]+)\s*%", value)
                for rank_offset, (name, pct_str) in enumerate(parts):
                    name = name.strip()
                    if not name:
                        continue
                    try:
                        weight = float(pct_str)
                        rank = 11 + rank_offset  # 11-20 留给发行人，1-10 为持仓
                        conn.execute("""
                            INSERT INTO top_holdings(fund_id,as_of_date,rank,holding_name,holding_type,weight_pct)
                            VALUES(?,?,?,?,?,?)
                            ON CONFLICT(fund_id,as_of_date,rank) DO UPDATE SET
                                holding_name=excluded.holding_name, holding_type=excluded.holding_type, weight_pct=excluded.weight_pct
                        """, (fund_id, as_of_date, rank, name, "bond", weight))
                    except ValueError:
                        pass
            except Exception as e:
                print(f"    [WARN] top_holdings (十大发行人) from text: {e}")
            continue
        # 到期日/期限分布：解析「区间: 比例」写入 maturity_allocation（债券/货币基金 duration 分布）
        if term in MATURITY_ALIASES and fund_id is not None and as_of_date:
            try:
                # 支持 "1-7天: 33.43, 8-30天: 19.37" 或 "1-7天 33.43%, 8-30天 19.37%"
                parts = re.findall(r"([^,，]+?)\s*:\s*([\d.]+)", value) or re.findall(r"([^,，]+?)\s+([\d.]+)\s*%", value)
                for bucket_label, pct_str in parts:
                    bucket_label = bucket_label.strip()
                    if not bucket_label:
                        continue
                    try:
                        weight = float(pct_str)
                        conn.execute("""
                            INSERT INTO maturity_allocation(fund_id, as_of_date, bucket_label, weight_pct)
                            VALUES(?,?,?,?)
                            ON CONFLICT(fund_id, as_of_date, bucket_label) DO UPDATE SET weight_pct=excluded.weight_pct
                        """, (fund_id, as_of_date, bucket_label, weight))
                    except ValueError:
                        pass
            except Exception as e:
                print(f"    [WARN] maturity_allocation from text: {e}")
            continue
        # 行业区域分布：解析「类别: 比例」写入 sector_allocation
        if term in SECTOR_ALLOCATION_ALIASES and fund_id is not None and as_of_date:
            try:
                parts = re.findall(r"([^,，]+?)\s*:\s*([\d.]+)", value) or re.findall(r"([^,，]+?)\s+([\d.]+)\s*%", value)
                for sector_name, pct_str in parts:
                    sector_name = sector_name.strip()
                    if not sector_name:
                        continue
                    try:
                        weight = float(pct_str)
                        conn.execute("""
                            INSERT INTO sector_allocation(fund_id, as_of_date, sector, weight_pct)
                            VALUES(?,?,?,?)
                            ON CONFLICT(fund_id, as_of_date, sector) DO UPDATE SET weight_pct=excluded.weight_pct
                        """, (fund_id, as_of_date, sector_name, weight))
                    except ValueError:
                        pass
            except Exception as e:
                print(f"    [WARN] sector_allocation (行业区域分布) from text: {e}")
            continue
        # 渣打风险评级 -> CIP 1-6 + sc_risk_rating 备注
        if term == "渣打风险评级" and fund_id is not None:
            try:
                cip_val = None
                label = None
                for lbl, num in SC_RISK_RATING_CIP_MAP.items():
                    if lbl in value:
                        cip_val = num
                        label = lbl
                        break
                if cip_val is not None:
                    conn.execute(
                        "UPDATE funds SET sc_risk_rating_cip=?, sc_risk_rating=? WHERE id=?",
                        (cip_val, label, fund_id),
                    )
            except Exception as e:
                print(f"    [WARN] sc_risk_rating_cip: {e}")
            continue
        # 中文别名合并到主表对应列
        if term in MAIN_TABLE_ALIASES and fund_id is not None:
            col = MAIN_TABLE_ALIASES[term]
            try:
                conn.execute(
                    f"UPDATE funds SET {col}=? WHERE id=?",
                    (value, fund_id),
                )
            except Exception as e:
                print(f"    [WARN] main table {col}: {e}")
            continue
        if term in KNOWN_FIELDS:
            continue
        exists = conn.execute(
            "SELECT id FROM pending_new_fields WHERE term_found=? AND confirmed=0",
            (term,)
        ).fetchone()
        if not exists:
            conn.execute("""
                INSERT INTO pending_new_fields
                (source_file,term_found,sample_value,created_at)
                VALUES(?,?,?,?)
            """, (source_file, term, value, now))
            new_ones.append(term)
    if new_ones:
        print(f"  [NEW] new fields: {', '.join(new_ones)}  (--review)")


def write_parsing_log(conn, source_file, status, data=None,
                      val_errors=None, raw_preview="",
                      error_msg="", retry_count=0):
    """写入 parsing_logs 表"""
    fi = (data or {}).get("fund_info") or {}
    as_of = fi.get("data_as_of","")

    uncertain = json.dumps(
        (data or {}).get("uncertain_fields") or [], ensure_ascii=False
    ) if data else "[]"

    null_keys = json.dumps(
        [f for f in KEY_FIELDS if fi.get(f) is None], ensure_ascii=False
    ) if data else "[]"

    val_err_json = json.dumps(val_errors or [], ensure_ascii=False)

    positions = json.dumps(
        (data or {}).get("field_positions") or {}, ensure_ascii=False
    ) if data else "{}"

    conn.execute("""
        INSERT INTO parsing_logs(
            source_file, parsed_at, status,
            uncertain_fields, null_key_fields, validation_errors,
            field_positions, raw_response_preview, error_msg, retry_count
        ) VALUES(?,?,?,?,?,?,?,?,?,?)
    """, (
        source_file, datetime.datetime.now().isoformat(), status,
        uncertain, null_keys, val_err_json,
        positions, raw_preview[:600], error_msg, retry_count
    ))

    # 同时写旧 parse_log（兼容）
    conn.execute("""
        INSERT INTO parse_log(source_file,parsed_at,status,error_msg)
        VALUES(?,?,?,?)
    """, (source_file, datetime.datetime.now().isoformat(), status, error_msg))


# ══════════════════════════════════════════════════════════════════
# 9. 主解析流程
# ══════════════════════════════════════════════════════════════════
def parse_pdf(conn, pdf_path: Path, api_key: str,
              force: bool = False, _redownload_done: bool = False) -> tuple[str, dict]:
    """
    解析单个 PDF，返回 (结果状态, 本文件API用量)
    状态: "skipped" / "success" / "needs_review" / "failed" / "aborted"
    用量: {"input_tokens": int, "output_tokens": int}
    当文件缺失/损坏或页数为 0 时，会自动尝试重新下载一次（仅限 cn-fs-qdur/qdut 命名）。
    """
    source_file = pdf_path.name

    zero_usage = {"input_tokens": 0, "output_tokens": 0}

    if not force:
        existing = conn.execute(
            "SELECT status, parsed_at FROM funds WHERE source_file=?",
            (source_file,)
        ).fetchone()
        if existing:
            st, pt = existing
            label = {1:"ok", 2:"review"}.get(st, "pending")
            print(f"  [--] skip [{label}, {pt[:10]}]: {source_file}", flush=True)
            return "skipped", zero_usage

    print(f"\n{'='*60}", flush=True)
    print(f"  [PDF] {source_file}", flush=True)

    raw_preview = ""
    retry_count = 0
    usage_total = {"input_tokens": 0, "output_tokens": 0}

    # 文件错误时自动重新下载一次（仅一次，仅支持渣打 cn-fs-qdur/qdut 命名）
    if not _redownload_done:
        need_redownload = False
        try:
            doc = fitz.open(str(pdf_path))
            n = doc.page_count
            doc.close()
            if n == 0:
                need_redownload = True
        except FileNotFoundError:
            need_redownload = True
        except Exception:
            need_redownload = True
        if need_redownload:
            print(f"  [!] 文件缺失/损坏或页数为 0，尝试重新下载一次...", flush=True)
            if redownload_pdf_once(pdf_path):
                print(f"  [OK] 重新下载成功，重试解析", flush=True)
                return parse_pdf(conn, pdf_path, api_key, force=force, _redownload_done=True)
            print(f"  [WARN] 重新下载失败或非渣打 PDF，继续解析（可能失败）", flush=True)

    try:
        print(f"  -> render {min(MAX_PAGES, fitz.open(str(pdf_path)).page_count)} pages...", flush=True)
        images_b64 = pdf_to_images_b64(pdf_path)

        # ── 第一次调用 ──────────────────────────────────────────
        print(f"  -> call {QWEN_MODEL} ({len(images_b64)} pages)...")
        raw, model, usage = call_qwen(images_b64, api_key)
        usage_total["input_tokens"] += usage.get("input_tokens", 0)
        usage_total["output_tokens"] += usage.get("output_tokens", 0)
        raw_preview = raw[:600]

        try:
            data = parse_json_response(raw)
        except (ValueError, json.JSONDecodeError) as e:
            print(f"  [retry] JSON 解析失败，重新请求 API 一次...", flush=True)
            raw, _, usage2 = call_qwen(images_b64, api_key)
            usage_total["input_tokens"] += usage2.get("input_tokens", 0)
            usage_total["output_tokens"] += usage2.get("output_tokens", 0)
            raw_preview = raw[:600]
            data = parse_json_response(raw)

        # ── jsonschema 校验 → 失败则重试一次 ────────────────────
        schema_errors = validate_schema(data)
        if schema_errors and MAX_RETRIES > 0:
            retry_count = 1
            hint = "; ".join(schema_errors)
            print(f"  [retry] Schema fail, retry ({hint[:80]})...")
            raw, _, usage2 = call_qwen(images_b64, api_key, retry_hint=hint)
            usage_total["input_tokens"] += usage2.get("input_tokens", 0)
            usage_total["output_tokens"] += usage2.get("output_tokens", 0)
            raw_preview = raw[:600]
            data = parse_json_response(raw)
            schema_errors = validate_schema(data)
            if schema_errors:
                print(f"  [WARN] Schema error after retry, continue anyway")

        # ── 数值校验与修复 ────────────────────────────────────
        data, warnings, val_errors = validate_and_fix(data, source_file)

        if warnings:
            print(f"  [!] auto-fix {len(warnings)}:")
            for w in warnings:
                print(f"      - {w}")

        if val_errors:
            non_abort = [e for e in val_errors if not e.startswith("ABORT:")]
            if non_abort:
                print(f"  [!] validation warnings {len(non_abort)}:")
                for e in non_abort:
                    print(f"      - {e}")

        # ── 置信度判断 ─────────────────────────────────────────
        status_code, review_reason = determine_status(data, val_errors)

        # ── 入库 ───────────────────────────────────────────────
        as_of = (data.get("fund_info") or {}).get("data_as_of") or \
                datetime.date.today().isoformat()

        fund_id = insert_fund(conn, source_file, data, status_code, review_reason)
        insert_managers(conn, fund_id, data.get("managers"))
        insert_performance(conn, fund_id, data.get("performance"), as_of)
        insert_dividends(conn, fund_id, data.get("dividends"))
        insert_holdings(conn, fund_id, data.get("top_holdings"), as_of)
        insert_allocations(conn, fund_id, data, as_of)
        handle_unknown_fields(conn, source_file, data.get("unknown_fields"), fund_id=fund_id, as_of_date=as_of)

        log_status = "success" if status_code == 1 else "partial"
        write_parsing_log(conn, source_file, log_status,
                         data=data, val_errors=val_errors,
                         raw_preview=raw_preview, retry_count=retry_count)
        conn.commit()

        fi = data.get("fund_info") or {}
        name = fi.get("fund_name_cn") or "?"
        risk = fi.get("sc_risk_rating") or "?"
        aum  = fi.get("fund_aum_usd")
        aum_str = f"{aum}M USD" if aum else "AUM=?"

        if status_code == 1:
            print(f"  [OK] saved: {name} | {risk} | {aum_str}")
            return "success", usage_total
        else:
            print(f"  [!] saved (review): {name}")
            print(f"      reason: {review_reason}")
            return "needs_review", usage_total

    except ValidationAbort as e:
        write_parsing_log(conn, source_file, "failed",
                         raw_preview=raw_preview,
                         error_msg=f"ABORT: {e}", retry_count=retry_count)
        conn.commit()
        print(f"  [ABORT] abort: {e}")
        return "aborted", usage_total

    except Exception as e:
        write_parsing_log(conn, source_file, "failed",
                         raw_preview=raw_preview,
                         error_msg=str(e), retry_count=retry_count)
        conn.commit()
        import traceback
        print(f"  [ERR] fail: {e}")
        traceback.print_exc()
        return "failed", usage_total


# ══════════════════════════════════════════════════════════════════
# 10. CLI 命令
# ══════════════════════════════════════════════════════════════════
def cmd_audit(conn):
    """人工审核 needs_review 记录"""
    rows = conn.execute("""
        SELECT f.id, f.fund_name_cn, f.sc_product_codes,
               f.review_reason, f.source_file,
               pl.uncertain_fields, pl.null_key_fields
        FROM funds f
        LEFT JOIN parsing_logs pl ON pl.source_file=f.source_file
        WHERE f.status=2
        ORDER BY f.parsed_at DESC
    """).fetchall()

    if not rows:
        print("[OK] 没有需要审核的记录")
        return

    print(f"\n{'═'*60}")
    print(f"  待审核记录 {len(rows)} 条")
    print(f"{'═'*60}")

    confirmed = skipped = 0
    for r in rows:
        fid, name, codes, reason, src, uncertain, null_keys = r
        print(f"\n  基金: {name or '?'} ({codes or '?'})")
        print(f"  文件: {src}")
        print(f"  原因: {reason}")
        if null_keys and null_keys != "[]":
            print(f"  空字段: {null_keys}")
        if uncertain and uncertain != "[]":
            try:
                ulist = json.loads(uncertain)
                for u in ulist:
                    print(f"  不确定: [{u.get('field')}] {u.get('reason')} "
                          f"@ {u.get('position','?')}")
            except:
                pass

        ans = input("  → 确认入库? [y=确认/n=保留待审/s=跳过] ").strip().lower()
        if ans == "y":
            conn.execute(
                "UPDATE funds SET status=1, review_reason=NULL WHERE id=?",
                (fid,)
            )
            conn.commit()
            print(f"  [OK] 已确认入库")
            confirmed += 1
        elif ans == "n":
            print(f"  [--] 保留待审")
            skipped += 1
        else:
            skipped += 1

    print(f"\n  审核完成：确认 {confirmed} 条，保留待审 {skipped} 条")


def cmd_review(conn):
    """查看待确认新字段"""
    rows = conn.execute("""
        SELECT id, source_file, term_found, sample_value, created_at
        FROM pending_new_fields WHERE confirmed=0
        ORDER BY created_at DESC
    """).fetchall()
    if not rows:
        print("[OK] 没有待确认的新字段")
        return
    print(f"\n{'─'*60}")
    print(f"  待确认新字段 ({len(rows)} 条)")
    for r in rows:
        print(f"  [{r[0]}] {r[2]:<30} 样本: {str(r[3])[:50]}  ({r[1]})")
    print("\n  用 --confirm <id> 确认 | --ignore <id> 忽略")


def cmd_confirm_field(conn, row_id, action):
    val = 1 if action == "confirm" else 2
    conn.execute("UPDATE pending_new_fields SET confirmed=? WHERE id=?", (val, row_id))
    conn.commit()
    print(f"[OK] #{row_id} {'已确认' if action=='confirm' else '已忽略'}")


def _cost_cny(usage: dict) -> float:
    """按配置单价估算费用（元）"""
    inp = usage.get("input_tokens", 0) or 0
    out = usage.get("output_tokens", 0) or 0
    return (inp / 1000.0 * PRICE_INPUT_CNY_PER_1K +
            out / 1000.0 * PRICE_OUTPUT_CNY_PER_1K)


def print_summary(conn, results: dict = None, usage_total: dict = None):
    """打印数据库摘要 + 本次扫描结果 + API 用量与费用"""
    funds_n   = conn.execute("SELECT COUNT(*) FROM funds").fetchone()[0]
    ok_n      = conn.execute("SELECT COUNT(*) FROM funds WHERE status=1").fetchone()[0]
    review_n  = conn.execute("SELECT COUNT(*) FROM funds WHERE status=2").fetchone()[0]
    pending_n = conn.execute(
        "SELECT COUNT(*) FROM pending_new_fields WHERE confirmed=0"
    ).fetchone()[0]

    print(f"\n{'='*60}")
    print(f"  DB: {DB_PATH}")
    print(f"  funds: {funds_n}  |  ok: {ok_n}  |  review: {review_n}")
    if pending_n:
        print(f"  [*] pending_new_fields: {pending_n} rows (confirm later: --review then --confirm/--ignore <id>)")

    if results:
        total = sum(results.values())
        print(f"\n  Scan: {total} PDFs")
        if results.get("success",0):
            print(f"  [OK] saved:       {results['success']}")
        if results.get("needs_review",0):
            print(f"  [!] needs_review: {results['needs_review']}")
            review_rows = conn.execute("""
                SELECT fund_name_cn, review_reason, source_file
                FROM funds WHERE status=2
                ORDER BY parsed_at DESC LIMIT 20
            """).fetchall()
            for rr in review_rows:
                name = (rr[0] or rr[2])[:35]
                reason = (rr[1] or "")[:60]
                print(f"       - {name}: {reason}")
        if results.get("aborted",0):
            print(f"  [ABORT] aborted:   {results['aborted']}")
        if results.get("failed",0):
            print(f"  [ERR] failed:      {results['failed']}")
        if results.get("skipped",0):
            print(f"  [--] skipped:     {results['skipped']}")

    if usage_total and (usage_total.get("input_tokens") or usage_total.get("output_tokens")):
        inp = usage_total.get("input_tokens", 0) or 0
        out = usage_total.get("output_tokens", 0) or 0
        cost = _cost_cny(usage_total)
        print(f"\n  [API] usage ({QWEN_MODEL}):")
        print(f"     input: {inp:,}  |  output: {out:,}  |  total: {inp+out:,}")
        print(f"     est. cost: CNY {cost:.4f}")

    print(f"{'='*60}")

    if review_n > 0:
        print(f"\n  Tip: run --audit to review")
    if pending_n > 0:
        print(f"  Tip: pending in table pending_new_fields; run --review then --confirm <id> or --ignore <id> when ready")


# ══════════════════════════════════════════════════════════════════
# 11. main
# ══════════════════════════════════════════════════════════════════
def main():
    global QWEN_MODEL
    ap = argparse.ArgumentParser(description="渣打 QDII 基金 PDF 解析器 v2")
    ap.add_argument("--dir",     help="PDF 目录路径")
    ap.add_argument("--file",    help="单个 PDF 路径")
    ap.add_argument("--db",      default=str(DB_PATH), help="数据库路径")
    ap.add_argument("--key",     default=None, help="DashScope API Key")
    ap.add_argument("--model",   default=QWEN_MODEL,
                    help="Qwen 模型 (默认 qwen-vl-max)")
    ap.add_argument("--force",   action="store_true", help="强制重新解析")
    ap.add_argument("--pause-on-new-pending", action="store_true",
                    help="发现新 pending 时暂停，便于添加/确认后再次运行断点继续")
    ap.add_argument("--audit",   action="store_true", help="人工审核待确认记录")
    ap.add_argument("--review",  action="store_true", help="查看待确认新字段")
    ap.add_argument("--confirm", type=int, help="确认新字段 ID")
    ap.add_argument("--ignore",  type=int, help="忽略新字段 ID")
    ap.add_argument("--summary", action="store_true", help="显示数据库摘要")
    args = ap.parse_args()

    QWEN_MODEL = args.model

    db_path = Path(args.db)
    conn    = init_db(db_path)

    if args.audit:   cmd_audit(conn);  return
    if args.review:  cmd_review(conn); return
    if args.confirm: cmd_confirm_field(conn, args.confirm, "confirm"); return
    if args.ignore:  cmd_confirm_field(conn, args.ignore,  "ignore");  return
    if args.summary: print_summary(conn); return

    # ── 收集 PDF ──────────────────────────────────────────────────
    pdfs = []
    if args.file:
        pdfs = [Path(args.file)]
    elif args.dir:
        pdfs = sorted(Path(args.dir).glob("*.pdf"))
    else:
        pdfs = sorted(Path(".").glob("*.pdf"))

    if not pdfs:
        print("[!] 未找到 PDF，请用 --dir 或 --file 指定")
        return

    # ── API Key ───────────────────────────────────────────────────
    api_key = (args.key
               or os.environ.get("DASHSCOPE_API_KEY")
               or os.environ.get("QWEN_API_KEY"))
    if not api_key:
        print("[ERR] 未找到 API Key，请设置 DASHSCOPE_API_KEY 或用 --key 传入")
        sys.exit(1)

    # ── 扫描（支持断点继续：已解析的会跳过）────────────────────────────
    print(f"\n[SCAN] {len(pdfs)} PDFs  ->  {db_path}  |  {QWEN_MODEL}", flush=True)
    if args.pause_on_new_pending:
        print("[SCAN] --pause-on-new-pending: will stop when new pending appears", flush=True)
    sys.stdout.flush()
    results = {"success":0, "needs_review":0, "aborted":0, "failed":0, "skipped":0}
    usage_total = {"input_tokens": 0, "output_tokens": 0}
    initial_pending = conn.execute(
        "SELECT COUNT(*) FROM pending_new_fields WHERE confirmed=0"
    ).fetchone()[0]

    for pdf in pdfs:
        status, usage = parse_pdf(conn, pdf, api_key=api_key, force=args.force)
        results[status] = results.get(status, 0) + 1
        usage_total["input_tokens"] += usage.get("input_tokens", 0)
        usage_total["output_tokens"] += usage.get("output_tokens", 0)
        time.sleep(0.5)  # 避免触发速率限制

        # 断点暂停：发现新 pending 时退出，便于添加/确认后再次运行继续
        if args.pause_on_new_pending:
            n = conn.execute(
                "SELECT COUNT(*) FROM pending_new_fields WHERE confirmed=0"
            ).fetchone()[0]
            if n > initial_pending:
                print("\n[PAUSE] New pending field(s) detected. Run --review, add/confirm, then re-run same command to continue.")
                break

    print_summary(conn, results, usage_total=usage_total)
    conn.close()


if __name__ == "__main__":
    main()
