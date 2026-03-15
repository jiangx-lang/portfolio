"""
sc_fund_parser.py
═════════════════════════════════════════════════════════════════
渣打 QDII 基金 PDF → SQLite 解析器
- 用 Claude API 做结构化提取（准确率远高于正则）
- 遇到新字段/新术语 → 写入 pending_new_fields 表并提示
- 支持批量扫描整个目录，重复运行自动跳过已解析文件
═════════════════════════════════════════════════════════════════

用法：
  python sc_fund_parser.py                          # 扫描当前目录所有 PDF
  python sc_fund_parser.py --dir ./sc_funds_qdii   # 指定目录
  python sc_fund_parser.py --file cn-fs-qdur048.pdf # 单文件
  python sc_fund_parser.py --summary                # 查看数据库状态
  python sc_fund_parser.py --review                 # 查看待确认新字段
  python sc_fund_parser.py --confirm 3              # 确认第3条新字段
  python sc_fund_parser.py --ignore 3               # 忽略第3条新字段

API Key: 环境变量 ANTHROPIC_API_KEY 或 --key
"""

import os
import re
import sys
import json
import sqlite3
import base64
import argparse
import datetime
from pathlib import Path

import fitz  # pymupdf
import anthropic

# ── 配置 ──────────────────────────────────────────────────────────
DB_PATH   = Path("./sc_funds.db")
PDF_DIR   = Path(".")
MAX_PAGES = 6  # 每份 PDF 最多解析前N页（节省 token）

CLAUDE_MODEL = "claude-opus-4-6"  # 用最聪明的模型保证准确率

# ── 已知字段白名单（扫描到这些不会触发新字段提示）─────────────────
KNOWN_FIELDS = {
    # funds 表
    "sc_product_codes", "reg_codes", "series_prefix", "fund_number",
    "fund_name_cn", "fund_name_en", "fund_manager_company",
    "inception_date", "base_currency", "available_currencies",
    "fund_aum_usd", "aum_date", "isin_codes", "bloomberg_codes",
    "mgmt_fee_pct", "custody_fee_pct", "admin_fee_pct", "other_fees_note",
    "sc_risk_rating", "annualized_std_3y", "avg_ytm", "avg_duration",
    "investment_objective", "data_source", "data_as_of",
    # performance 表
    "share_class", "currency", "ret_3m", "ret_6m", "ret_ytd",
    "ret_1y", "ret_3y", "ret_5y", "ret_since_inception",
    "ret_2025","ret_2024","ret_2023","ret_2022","ret_2021",
    "ret_2020","ret_2019","ret_2018","ret_2017","ret_2016",
    "ret_2015","ret_2014","ret_2013",
    "benchmark_name", "bench_ret_3m","bench_ret_1y","bench_ret_3y",
    "bench_ret_5y","bench_ret_since_inception","nav","nav_currency",
    # holdings / alloc
    "holding_name","holding_type","weight_pct","rank",
    "region","sector","asset_class","rating",
    # dividend
    "record_date","ex_div_date","dividend_per_share",
    "nav_on_ex_date","annualized_yield_pct",
    # manager
    "name","title","bio",
}


# ══════════════════════════════════════════════════════════════════
# 1. 数据库初始化
# ══════════════════════════════════════════════════════════════════
SCHEMA = """
PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;

CREATE TABLE IF NOT EXISTS funds (
    id                   INTEGER PRIMARY KEY AUTOINCREMENT,
    source_file          TEXT NOT NULL UNIQUE,
    parsed_at            TEXT,
    sc_product_codes     TEXT,
    reg_codes            TEXT,
    series_prefix        TEXT,
    fund_number          TEXT,
    fund_name_cn         TEXT,
    fund_name_en         TEXT,
    fund_manager_company TEXT,
    inception_date       TEXT,
    base_currency        TEXT,
    available_currencies TEXT,
    fund_aum_usd         REAL,
    aum_date             TEXT,
    isin_codes           TEXT,
    bloomberg_codes      TEXT,
    mgmt_fee_pct         REAL,
    custody_fee_pct      REAL,
    admin_fee_pct        REAL,
    other_fees_note      TEXT,
    sc_risk_rating       TEXT,
    annualized_std_3y    REAL,
    avg_ytm              REAL,
    avg_duration         REAL,
    investment_objective TEXT,
    data_source          TEXT,
    data_as_of           TEXT
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
    id                      INTEGER PRIMARY KEY AUTOINCREMENT,
    fund_id                 INTEGER NOT NULL REFERENCES funds(id) ON DELETE CASCADE,
    share_class             TEXT,
    currency                TEXT,
    as_of_date              TEXT NOT NULL,
    ret_3m                  REAL, ret_6m  REAL, ret_ytd REAL,
    ret_1y                  REAL, ret_3y  REAL, ret_5y  REAL,
    ret_since_inception     REAL,
    ret_2025 REAL, ret_2024 REAL, ret_2023 REAL, ret_2022 REAL,
    ret_2021 REAL, ret_2020 REAL, ret_2019 REAL, ret_2018 REAL,
    ret_2017 REAL, ret_2016 REAL, ret_2015 REAL, ret_2014 REAL,
    ret_2013 REAL,
    benchmark_name          TEXT,
    bench_ret_3m            REAL, bench_ret_1y REAL, bench_ret_3y  REAL,
    bench_ret_5y            REAL, bench_ret_since_inception REAL,
    nav                     REAL,
    nav_currency            TEXT,
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
    UNIQUE(fund_id, as_of_date, region)
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

CREATE TABLE IF NOT EXISTS parse_log (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    source_file   TEXT,
    parsed_at     TEXT,
    status        TEXT,
    fields_found  TEXT,
    fields_missing TEXT,
    error_msg     TEXT
);

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

CREATE VIEW IF NOT EXISTS v_fund_overview AS
SELECT f.fund_number, f.fund_name_cn, f.fund_manager_company,
       f.sc_risk_rating, f.sc_product_codes, f.fund_aum_usd,
       f.aum_date, f.mgmt_fee_pct, f.annualized_std_3y,
       f.avg_ytm, f.avg_duration, f.base_currency, f.source_file
FROM funds f;

CREATE VIEW IF NOT EXISTS v_latest_performance AS
SELECT f.fund_name_cn, f.sc_risk_rating, p.share_class, p.currency,
       p.as_of_date, p.ret_ytd, p.ret_1y, p.ret_3y, p.ret_5y, p.nav
FROM fund_performance p JOIN funds f ON f.id = p.fund_id;
"""

def init_db(db_path: Path) -> sqlite3.Connection:
    conn = sqlite3.connect(db_path)
    conn.executescript(SCHEMA)
    conn.commit()
    return conn


# ══════════════════════════════════════════════════════════════════
# 2. PDF → 图片（每页转图）
# ══════════════════════════════════════════════════════════════════
def pdf_to_images_b64(pdf_path: Path, max_pages: int = MAX_PAGES) -> list[str]:
    """把 PDF 每页渲染成 PNG，返回 base64 列表"""
    doc = fitz.open(str(pdf_path))
    images = []
    for i, page in enumerate(doc):
        if i >= max_pages:
            break
        pix = page.get_pixmap(dpi=150)
        png_bytes = pix.tobytes("png")
        images.append(base64.standard_b64encode(png_bytes).decode())
    doc.close()
    return images


# ══════════════════════════════════════════════════════════════════
# 3. Claude 提取结构化数据
# ══════════════════════════════════════════════════════════════════
EXTRACTION_PROMPT = """你是一个专业的基金数据提取专家。请从这份渣打银行 QDII 基金说明书 PDF 图片中，提取所有结构化数据。

请严格按照以下 JSON 格式返回，不要添加任何额外文字。数字字段去掉%符号只保留数值（如 1.35% → 1.35）。日期统一用 YYYY-MM-DD 格式。找不到的字段用 null。

```json
{
  "fund_info": {
    "sc_product_codes": "QDUR048USD,QDUR048CNY",
    "reg_codes": "C1067113000060,C1067123000003",
    "series_prefix": "qdur",
    "fund_number": "048",
    "fund_name_cn": "贝莱德全球基金－亚洲老虎债券基金",
    "fund_manager_company": "贝莱德",
    "inception_date": "2012-04-02",
    "base_currency": "USD",
    "available_currencies": "USD,CNY",
    "fund_aum_usd": 2156.53,
    "aum_date": "2026-01-31",
    "isin_codes": "LU0764618053,LU1257007309",
    "bloomberg_codes": "BGATA6U LX,BGTA8CH LX",
    "mgmt_fee_pct": 1.00,
    "custody_fee_pct": 0.45,
    "admin_fee_pct": 0.25,
    "other_fees_note": "其他费用由境外产品发行人决定",
    "sc_risk_rating": "稳健型",
    "annualized_std_3y": 4.27,
    "avg_ytm": 5.64,
    "avg_duration": 4.97,
    "investment_objective": "以尽量提高总回报为目标...",
    "data_source": "晨星，贝莱德",
    "data_as_of": "2026-01-31"
  },
  "managers": [
    {"name": "Stephen Gough", "title": "董事总经理，投资组合经理", "bio": "亚洲流动信贷平台负责主管"},
    {"name": "Venn Saltirov", "title": "董事", "bio": "亚洲固定收益和信贷团队成员"}
  ],
  "performance": [
    {
      "share_class": "A6美元稳定派息股份",
      "currency": "USD",
      "as_of_date": "2026-01-31",
      "ret_3m": 1.15, "ret_6m": 5.14, "ret_ytd": 0.97,
      "ret_1y": 9.73, "ret_3y": 20.37, "ret_5y": -3.40,
      "ret_since_inception": 44.33,
      "ret_2025": 9.36, "ret_2024": 6.42, "ret_2023": 5.76,
      "ret_2022": -16.07, "ret_2021": -7.43,
      "benchmark_name": "摩根大通亚洲信贷指数",
      "bench_ret_3m": 0.76, "bench_ret_1y": 7.97,
      "bench_ret_3y": 19.17, "bench_ret_5y": 6.53,
      "bench_ret_since_inception": 69.08,
      "nav": 8.51, "nav_currency": "USD"
    }
  ],
  "dividends": [
    {
      "sc_product_code": "QDUR048USD",
      "share_class": "A6美元稳定派息股份",
      "currency": "USD",
      "record_date": "2026-01-29",
      "ex_div_date": "2026-01-30",
      "dividend_per_share": 0.042500,
      "nav_on_ex_date": 8.51,
      "annualized_yield_pct": 5.99
    }
  ],
  "top_holdings": [
    {"rank": 1, "holding_name": "MUMBAI INTERNATIONAL AIRPORT LTD REGS 6.95 07/30/2029", "holding_type": "bond", "weight_pct": 1.19},
    {"rank": 2, "holding_name": "PERUSAHAAN LISTRIK NEGARA", "holding_type": "bond", "weight_pct": 0.99}
  ],
  "regional_allocation": [
    {"region": "印度", "weight_pct": 18.27},
    {"region": "澳大利亚", "weight_pct": 13.20}
  ],
  "sector_allocation": [
    {"sector": "信息科技", "weight_pct": 27.26},
    {"sector": "通信", "weight_pct": 14.69}
  ],
  "asset_class_allocation": [
    {"asset_class": "固定收益", "weight_pct": 92.94},
    {"asset_class": "股票", "weight_pct": 0.52},
    {"asset_class": "现金", "weight_pct": 6.55}
  ],
  "credit_rating_allocation": [
    {"rating": "AAA", "weight_pct": 4.01},
    {"rating": "AA", "weight_pct": 1.20},
    {"rating": "A", "weight_pct": 13.02},
    {"rating": "BBB", "weight_pct": 37.66},
    {"rating": "BB", "weight_pct": 19.19},
    {"rating": "B", "weight_pct": 10.82},
    {"rating": "未评级", "weight_pct": 6.20}
  ],
  "unknown_fields": []
}
```

关键提取规则：
- holding_type 判断：债券名称含 MTN/REGS/GILT/NOTE/BOND 等 → "bond"；股票名称（公司名无债券代码）→ "equity"；现金 → "cash"
- sc_risk_rating 只取勾选的那个：风险规避型/保守型/稳健型/适度积极型/积极型/非常积极型
- 如果 PDF 是繁体字，照常提取，数字不变
- series_prefix 从产品编号提取：QDUT → qdut, QDUR → qdur
- fund_number 从产品编号提取三位数字：QDUR048 → 048
- 如果遇到以上 JSON 字段之外的重要数据，放入 unknown_fields: [{"term": "字段名", "value": "值", "context": "在哪个表格/区域发现的"}]
- 所有列表如果 PDF 中没有该部分数据，返回空列表 []
- 数字一律不加引号，字符串加引号，null 不加引号
"""

def extract_with_claude(pdf_path: Path, api_key: str = None) -> dict:
    """用 Claude Vision 从 PDF 图片提取结构化数据"""
    # api_key 优先级: 参数 > 环境变量 ANTHROPIC_API_KEY
    client = anthropic.Anthropic(api_key=api_key) if api_key else anthropic.Anthropic()
    
    print(f"  → 渲染 PDF 页面...")
    images_b64 = pdf_to_images_b64(pdf_path)
    
    # 构造多图 message
    content = []
    for i, img_b64 in enumerate(images_b64):
        content.append({
            "type": "image",
            "source": {
                "type": "base64",
                "media_type": "image/png",
                "data": img_b64
            }
        })
    content.append({"type": "text", "text": EXTRACTION_PROMPT})
    
    print(f"  → 调用 Claude 提取（{len(images_b64)} 页）...")
    response = client.messages.create(
        model=CLAUDE_MODEL,
        max_tokens=8000,
        messages=[{"role": "user", "content": content}]
    )
    
    raw = response.content[0].text
    
    # 清理并解析 JSON
    # 去掉 ```json ``` 包裹
    raw = re.sub(r'^```json\s*', '', raw.strip(), flags=re.MULTILINE)
    raw = re.sub(r'^```\s*$', '', raw.strip(), flags=re.MULTILINE)
    raw = raw.strip()
    
    try:
        data = json.loads(raw)
    except json.JSONDecodeError as e:
        # 尝试提取 JSON 块
        m = re.search(r'\{.*\}', raw, re.DOTALL)
        if m:
            data = json.loads(m.group())
        else:
            raise ValueError(f"JSON 解析失败: {e}\n原始输出: {raw[:500]}")
    
    return data


# ══════════════════════════════════════════════════════════════════
# 4. 数据入库
# ══════════════════════════════════════════════════════════════════
def insert_fund(conn: sqlite3.Connection, source_file: str, data: dict) -> int:
    """插入或更新 funds 主表，返回 fund_id"""
    fi = data.get("fund_info", {})
    now = datetime.datetime.now().isoformat()
    
    conn.execute("""
        INSERT INTO funds (
            source_file, parsed_at,
            sc_product_codes, reg_codes, series_prefix, fund_number,
            fund_name_cn, fund_name_en, fund_manager_company,
            inception_date, base_currency, available_currencies,
            fund_aum_usd, aum_date, isin_codes, bloomberg_codes,
            mgmt_fee_pct, custody_fee_pct, admin_fee_pct, other_fees_note,
            sc_risk_rating, annualized_std_3y, avg_ytm, avg_duration,
            investment_objective, data_source, data_as_of
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        ON CONFLICT(source_file) DO UPDATE SET
            parsed_at=excluded.parsed_at,
            sc_product_codes=excluded.sc_product_codes,
            reg_codes=excluded.reg_codes,
            fund_name_cn=excluded.fund_name_cn,
            fund_manager_company=excluded.fund_manager_company,
            fund_aum_usd=excluded.fund_aum_usd,
            aum_date=excluded.aum_date,
            sc_risk_rating=excluded.sc_risk_rating,
            annualized_std_3y=excluded.annualized_std_3y,
            avg_ytm=excluded.avg_ytm,
            avg_duration=excluded.avg_duration,
            investment_objective=excluded.investment_objective,
            data_as_of=excluded.data_as_of
    """, (
        source_file, now,
        fi.get("sc_product_codes"), fi.get("reg_codes"),
        fi.get("series_prefix"), fi.get("fund_number"),
        fi.get("fund_name_cn"), fi.get("fund_name_en"),
        fi.get("fund_manager_company"),
        fi.get("inception_date"), fi.get("base_currency"),
        fi.get("available_currencies"),
        fi.get("fund_aum_usd"), fi.get("aum_date"),
        fi.get("isin_codes"), fi.get("bloomberg_codes"),
        fi.get("mgmt_fee_pct"), fi.get("custody_fee_pct"),
        fi.get("admin_fee_pct"), fi.get("other_fees_note"),
        fi.get("sc_risk_rating"), fi.get("annualized_std_3y"),
        fi.get("avg_ytm"), fi.get("avg_duration"),
        fi.get("investment_objective"),
        fi.get("data_source"), fi.get("data_as_of"),
    ))
    
    row = conn.execute("SELECT id FROM funds WHERE source_file=?", (source_file,)).fetchone()
    return row[0]


def insert_managers(conn, fund_id, managers):
    for m in (managers or []):
        try:
            conn.execute("""
                INSERT INTO fund_managers(fund_id,name,title,bio)
                VALUES(?,?,?,?)
                ON CONFLICT(fund_id,name) DO UPDATE SET title=excluded.title, bio=excluded.bio
            """, (fund_id, m.get("name"), m.get("title"), m.get("bio")))
        except Exception as e:
            print(f"    [WARN] manager insert: {e}")


def insert_performance(conn, fund_id, performances, as_of_date):
    for p in (performances or []):
        aod = p.get("as_of_date") or as_of_date
        try:
            conn.execute("""
                INSERT INTO fund_performance(
                    fund_id, share_class, currency, as_of_date,
                    ret_3m,ret_6m,ret_ytd,ret_1y,ret_3y,ret_5y,ret_since_inception,
                    ret_2025,ret_2024,ret_2023,ret_2022,ret_2021,
                    ret_2020,ret_2019,ret_2018,ret_2017,ret_2016,ret_2015,ret_2014,ret_2013,
                    benchmark_name,
                    bench_ret_3m,bench_ret_1y,bench_ret_3y,bench_ret_5y,bench_ret_since_inception,
                    nav,nav_currency
                ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
                ON CONFLICT(fund_id,share_class,as_of_date) DO UPDATE SET
                    ret_1y=excluded.ret_1y, ret_3y=excluded.ret_3y,
                    ret_5y=excluded.ret_5y, nav=excluded.nav
            """, (
                fund_id, p.get("share_class"), p.get("currency"), aod,
                p.get("ret_3m"), p.get("ret_6m"), p.get("ret_ytd"),
                p.get("ret_1y"), p.get("ret_3y"), p.get("ret_5y"),
                p.get("ret_since_inception"),
                p.get("ret_2025"), p.get("ret_2024"), p.get("ret_2023"),
                p.get("ret_2022"), p.get("ret_2021"), p.get("ret_2020"),
                p.get("ret_2019"), p.get("ret_2018"), p.get("ret_2017"),
                p.get("ret_2016"), p.get("ret_2015"), p.get("ret_2014"),
                p.get("ret_2013"),
                p.get("benchmark_name"),
                p.get("bench_ret_3m"), p.get("bench_ret_1y"),
                p.get("bench_ret_3y"), p.get("bench_ret_5y"),
                p.get("bench_ret_since_inception"),
                p.get("nav"), p.get("nav_currency"),
            ))
        except Exception as e:
            print(f"    [WARN] performance insert: {e}")


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
                    nav_on_ex_date=excluded.nav_on_ex_date,
                    annualized_yield_pct=excluded.annualized_yield_pct
            """, (
                fund_id, d.get("sc_product_code"), d.get("share_class"),
                d.get("currency"), d.get("record_date"), d.get("ex_div_date"),
                d.get("dividend_per_share"), d.get("nav_on_ex_date"),
                d.get("annualized_yield_pct"),
            ))
        except Exception as e:
            print(f"    [WARN] dividend insert: {e}")


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
            print(f"    [WARN] holding insert: {e}")


def insert_allocations(conn, fund_id, data, as_of_date):
    tables = {
        "regional_allocation":     ("region",      "regional_allocation"),
        "sector_allocation":       ("sector",       "sector_allocation"),
        "asset_class_allocation":  ("asset_class",  "asset_class_allocation"),
        "credit_rating_allocation":("rating",       "credit_rating_allocation"),
    }
    for key, (col, table) in tables.items():
        for row in (data.get(key) or []):
            try:
                conn.execute(f"""
                    INSERT INTO {table}(fund_id, as_of_date, {col}, weight_pct)
                    VALUES(?,?,?,?)
                    ON CONFLICT(fund_id, as_of_date, {col}) DO UPDATE SET
                        weight_pct=excluded.weight_pct
                """, (fund_id, as_of_date, row.get(col), row.get("weight_pct")))
            except Exception as e:
                print(f"    [WARN] {table} insert: {e}")


def handle_unknown_fields(conn, source_file, unknown_fields):
    """把新字段写入待确认表并提示"""
    if not unknown_fields:
        return
    now = datetime.datetime.now().isoformat()
    new_ones = []
    for uf in unknown_fields:
        term = uf.get("term", "")
        if term in KNOWN_FIELDS:
            continue
        # 检查是否已存在
        exists = conn.execute(
            "SELECT id FROM pending_new_fields WHERE term_found=? AND confirmed=0",
            (term,)
        ).fetchone()
        if not exists:
            conn.execute("""
                INSERT INTO pending_new_fields
                (source_file, term_found, sample_value, suggested_table, suggested_col, created_at)
                VALUES(?,?,?,?,?,?)
            """, (source_file, term, str(uf.get("value","")),
                  uf.get("suggested_table",""), uf.get("suggested_col",""), now))
            new_ones.append(term)
    
    if new_ones:
        print(f"\n  ⚠️  发现 {len(new_ones)} 个新字段，已写入 pending_new_fields 表：")
        for t in new_ones:
            print(f"      • {t}")
        print("  运行 `python sc_fund_parser.py --review` 查看并确认")


# ══════════════════════════════════════════════════════════════════
# 5. 主解析流程
# ══════════════════════════════════════════════════════════════════
def parse_pdf(conn: sqlite3.Connection, pdf_path: Path, force: bool = False, api_key: str = None):
    source_file = pdf_path.name
    
    # 检查是否已解析
    if not force:
        existing = conn.execute(
            "SELECT parsed_at FROM funds WHERE source_file=?", (source_file,)
        ).fetchone()
        if existing:
            print(f"  ⏭  跳过（已解析于 {existing[0][:10]}）: {source_file}")
            return
    
    print(f"\n{'='*60}")
    print(f"  📄 解析: {source_file}")
    
    try:
        data = extract_with_claude(pdf_path, api_key=api_key)
        
        as_of_date = (data.get("fund_info") or {}).get("data_as_of") or \
                     datetime.date.today().isoformat()
        
        fund_id = insert_fund(conn, source_file, data)
        insert_managers(conn, fund_id, data.get("managers"))
        insert_performance(conn, fund_id, data.get("performance"), as_of_date)
        insert_dividends(conn, fund_id, data.get("dividends"))
        insert_holdings(conn, fund_id, data.get("top_holdings"), as_of_date)
        insert_allocations(conn, fund_id, data, as_of_date)
        handle_unknown_fields(conn, source_file, data.get("unknown_fields", []))
        
        conn.execute("""
            INSERT INTO parse_log(source_file,parsed_at,status,fields_found)
            VALUES(?,?,?,?)
        """, (source_file, datetime.datetime.now().isoformat(), "success",
              json.dumps(list(data.keys()))))
        conn.commit()
        
        fi = data.get("fund_info", {})
        print(f"  ✅ 成功: {fi.get('fund_name_cn','?')} | "
              f"风险:{fi.get('sc_risk_rating','?')} | "
              f"AUM:{fi.get('fund_aum_usd','?')}M USD")
    
    except Exception as e:
        conn.execute("""
            INSERT INTO parse_log(source_file,parsed_at,status,error_msg)
            VALUES(?,?,?,?)
        """, (source_file, datetime.datetime.now().isoformat(), "failed", str(e)))
        conn.commit()
        print(f"  ❌ 失败: {e}")
        import traceback; traceback.print_exc()


# ══════════════════════════════════════════════════════════════════
# 6. CLI
# ══════════════════════════════════════════════════════════════════
def cmd_review(conn):
    rows = conn.execute("""
        SELECT id, source_file, term_found, sample_value, created_at
        FROM pending_new_fields WHERE confirmed=0
        ORDER BY created_at DESC
    """).fetchall()
    if not rows:
        print("✅ 没有待确认的新字段")
        return
    print(f"\n{'='*60}")
    print(f"  待确认新字段 ({len(rows)} 条)")
    print(f"{'='*60}")
    for r in rows:
        print(f"  [{r[0]}] 文件: {r[1]}")
        print(f"       字段: {r[2]}")
        print(f"       样本: {r[3][:80]}")
        print(f"       时间: {r[4][:10]}")
        print()
    print("  使用 --confirm <id> 确认 | --ignore <id> 忽略")


def cmd_confirm(conn, row_id, action):
    val = 1 if action == "confirm" else 2
    conn.execute("UPDATE pending_new_fields SET confirmed=? WHERE id=?", (val, row_id))
    conn.commit()
    label = "已确认" if action == "confirm" else "已忽略"
    print(f"✅ #{row_id} {label}")


def print_summary(conn):
    """打印数据库当前状态"""
    funds_n = conn.execute("SELECT COUNT(*) FROM funds").fetchone()[0]
    mgr_n   = conn.execute("SELECT COUNT(*) FROM fund_managers").fetchone()[0]
    perf_n  = conn.execute("SELECT COUNT(*) FROM fund_performance").fetchone()[0]
    div_n   = conn.execute("SELECT COUNT(*) FROM dividend_history").fetchone()[0]
    hold_n  = conn.execute("SELECT COUNT(*) FROM top_holdings").fetchone()[0]
    pend_n  = conn.execute("SELECT COUNT(*) FROM pending_new_fields WHERE confirmed=0").fetchone()[0]
    
    print(f"\n{'═'*50}")
    print(f"  数据库: {DB_PATH}")
    print(f"  基金主表:  {funds_n} 条")
    print(f"  基金经理:  {mgr_n} 条")
    print(f"  业绩记录:  {perf_n} 条")
    print(f"  派息记录:  {div_n} 条")
    print(f"  十大持仓:  {hold_n} 条")
    if pend_n:
        print(f"  ⚠️  待确认新字段: {pend_n} 条（运行 --review 查看）")
    print(f"{'═'*50}")


def main():
    parser = argparse.ArgumentParser(description="渣打 QDII 基金 PDF 解析器")
    parser.add_argument("--dir",     default=None,  help="PDF 目录路径")
    parser.add_argument("--file",    default=None,  help="单个 PDF 文件路径")
    parser.add_argument("--db",      default=str(DB_PATH), help="数据库路径")
    parser.add_argument("--force",   action="store_true",  help="强制重新解析已有记录")
    parser.add_argument("--review",  action="store_true",  help="查看待确认新字段")
    parser.add_argument("--confirm", type=int, default=None, help="确认新字段 ID")
    parser.add_argument("--ignore",  type=int, default=None, help="忽略新字段 ID")
    parser.add_argument("--summary", action="store_true", help="查看数据库状态")
    parser.add_argument("--key",     default=None,  help="Anthropic API Key（也可用环境变量 ANTHROPIC_API_KEY）")
    args = parser.parse_args()
    
    db_path = Path(args.db)
    conn = init_db(db_path)
    
    if args.review:
        cmd_review(conn)
        return
    if args.confirm:
        cmd_confirm(conn, args.confirm, "confirm")
        return
    if args.ignore:
        cmd_confirm(conn, args.ignore, "ignore")
        return
    if args.summary:
        print_summary(conn)
        return
    
    # 收集要解析的 PDF
    pdfs = []
    if args.file:
        pdfs = [Path(args.file)]
    elif args.dir:
        pdfs = sorted(Path(args.dir).glob("*.pdf"))
    else:
        pdfs = sorted(Path(".").glob("*.pdf"))
    
    if not pdfs:
        print("⚠️  未找到 PDF 文件，请用 --dir 或 --file 指定")
        return
    
    print(f"\n🚀 开始解析 {len(pdfs)} 个 PDF → {db_path}")
    for pdf in pdfs:
        parse_pdf(conn, pdf, force=args.force, api_key=args.key)
    
    print_summary(conn)
    conn.close()


if __name__ == "__main__":
    main()
