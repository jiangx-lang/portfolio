"""
人工定义的「股票 → 标签」知识库。支持 Python 列表或 CSV（holding,tags，标签用 ; 分隔）。
Cursor 只负责导入到 holding_tag_map 并应用；不解读股票含义。
持仓名经 standardize_holding_name 标准化后与 fund_holding_exposure 匹配。
"""
import csv
from pathlib import Path
from typing import List, Tuple, Optional

from .standardizer import standardize_holding_name

# 一～十二：按销售逻辑分类的股票 → 标签（规范名大写，与标准化后持仓名匹配）
HOLDING_TAG_SEED = [
    # 一、HALO / AI 核心平台
    ("NVIDIA", ["HALO", "AI Hardware", "AI Infrastructure", "Semiconductor"]),
    ("MICROSOFT", ["HALO", "AI Software", "Cloud", "SaaS", "Mega Cap", "Quality"]),
    ("AMAZON", ["HALO", "Cloud", "AI Software", "Internet", "Mega Cap"]),
    ("ALPHABET", ["HALO", "AI Software", "Cloud", "Internet", "Mega Cap"]),
    ("META", ["HALO", "AI Software", "Internet"]),
    ("APPLE", ["HALO", "Mega Cap", "Quality"]),
    ("TSMC", ["HALO", "AI Hardware", "Semiconductor"]),
    ("BROADCOM", ["HALO", "AI Hardware", "Semiconductor"]),
    ("AMD", ["HALO", "AI Hardware", "Semiconductor"]),
    ("ASML", ["HALO", "Semiconductor Equipment"]),
    # 二、AI Hardware（芯片）
    ("INTEL", ["AI Hardware", "Semiconductor"]),
    ("QUALCOMM", ["AI Hardware", "Semiconductor"]),
    ("MARVELL", ["AI Hardware", "Semiconductor"]),
    ("MICRON", ["AI Hardware", "Semiconductor"]),
    ("SK HYNIX", ["AI Hardware", "Semiconductor"]),
    ("SAMSUNG ELECTRONICS", ["AI Hardware", "Semiconductor"]),
    ("ARM", ["AI Hardware", "Semiconductor"]),
    # 三、半导体设备
    ("APPLIED MATERIALS", ["Semiconductor Equipment"]),
    ("LAM RESEARCH", ["Semiconductor Equipment"]),
    ("KLA", ["Semiconductor Equipment"]),
    ("TOKYO ELECTRON", ["Semiconductor Equipment"]),
    ("ADVANTEST", ["Semiconductor Equipment"]),
    ("SCREEN HOLDINGS", ["Semiconductor Equipment"]),
    # 四、AI Infrastructure（算力网络）
    ("ARISTA NETWORKS", ["AI Infrastructure"]),
    ("SUPER MICRO COMPUTER", ["AI Infrastructure"]),
    ("DELL TECHNOLOGIES", ["AI Infrastructure"]),
    ("HEWLETT PACKARD ENTERPRISE", ["AI Infrastructure"]),
    ("HPE", ["AI Infrastructure"]),
    ("VERTIV", ["AI Infrastructure", "Datacenter"]),
    ("SCHNEIDER ELECTRIC", ["AI Infrastructure"]),
    ("SIEMENS", ["AI Infrastructure"]),
    # 五、数据中心
    ("EQUINIX", ["Datacenter"]),
    ("DIGITAL REALTY", ["Datacenter"]),
    ("AMERICAN TOWER", ["Infrastructure"]),
    ("CROWN CASTLE", ["Infrastructure"]),
    # 六、AI Software / SaaS
    ("SALESFORCE", ["AI Software", "SaaS"]),
    ("ADOBE", ["AI Software"]),
    ("SERVICENOW", ["AI Software", "SaaS"]),
    ("PALANTIR", ["AI Software"]),
    ("SNOWFLAKE", ["AI Software", "Cloud"]),
    ("DATADOG", ["AI Software", "Cloud"]),
    ("MONGODB", ["AI Software"]),
    ("HUBSPOT", ["SaaS"]),
    ("WORKDAY", ["SaaS"]),
    ("ATLASSIAN", ["SaaS"]),
    ("ZOOM", ["SaaS"]),
    # 七、Cybersecurity
    ("CROWDSTRIKE", ["Cybersecurity"]),
    ("PALO ALTO NETWORKS", ["Cybersecurity"]),
    ("FORTINET", ["Cybersecurity"]),
    ("ZSCALER", ["Cybersecurity"]),
    ("OKTA", ["Cybersecurity"]),
    ("SENTINELONE", ["Cybersecurity"]),
    ("CHECK POINT", ["Cybersecurity"]),
    # 八、Cloud 平台
    ("ORACLE", ["Cloud"]),
    ("IBM", ["Cloud"]),
    ("SAP", ["Enterprise Software"]),
    ("CLOUDFLARE", ["Cloud"]),
    ("FASTLY", ["Cloud"]),
    ("TWILIO", ["Cloud"]),
    # 九、互联网平台
    ("NETFLIX", ["Internet"]),
    ("UBER", ["Internet"]),
    ("AIRBNB", ["Internet"]),
    ("BOOKING", ["Internet"]),
    ("BOOKING HOLDINGS", ["Internet"]),
    ("DOORDASH", ["Internet"]),
    ("SPOTIFY", ["Internet"]),
    # 十、中国互联网
    ("TENCENT", ["China Internet"]),
    ("ALIBABA", ["China Internet"]),
    ("PDD HOLDINGS", ["China Internet"]),
    ("MEITUAN", ["China Internet"]),
    ("JD.COM", ["China Internet"]),
    ("BAIDU", ["China Internet", "AI Software"]),
    # 十一、日本机器人
    ("FANUC", ["Robotics"]),
    ("KEYENCE", ["Robotics"]),
    ("YASKAWA", ["Robotics"]),
    ("ABB", ["Robotics"]),
    ("ROCKWELL AUTOMATION", ["Robotics"]),
    # 十二、质量公司（销售常用）
    ("VISA", ["Quality"]),
    ("MASTERCARD", ["Quality"]),
    ("COSTCO", ["Quality"]),
    ("BERKSHIRE HATHAWAY", ["Quality"]),
    ("PROCTER & GAMBLE", ["Quality"]),
    ("COCA COLA", ["Quality"]),
    ("COCA-COLA", ["Quality"]),
    ("PEPSICO", ["Quality"]),
    ("JOHNSON & JOHNSON", ["Quality"]),
]


def normalize_seed_holding(name: str) -> str:
    """与 standardize_holding_name 一致，便于与持仓表匹配。"""
    return standardize_holding_name(name)


def get_seed_rows_normalized() -> List[Tuple[str, str]]:
    """从 Python 列表返回 [(holding_name_std, tag_name), ...]。"""
    out = []
    for holding, tags in HOLDING_TAG_SEED:
        std = normalize_seed_holding(holding)
        if not std:
            continue
        for tag in tags:
            if tag:
                out.append((std, tag.strip()))
    return out


def load_seed_from_csv(
    csv_path: str | Path,
    use_ticker_as_key: bool = True,
) -> List[Tuple[str, str]]:
    """
    从 CSV 加载股票→标签。支持两种格式：
    - ticker,company,tags（标签 ; 分隔）：ticker 为主键；同时用 company 与 ticker 标准化后写入，便于持仓名或代码都能匹配。
    - holding,tags：仅用 holding 标准化后写入。
    返回 [(holding_name_std, tag_name), ...]（去重后可能多行因同一公司对应多 tag）。
    """
    path = Path(csv_path)
    if not path.exists():
        return []
    out = []
    with open(path, "r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        rows = list(reader)
    if not rows:
        return []
    first = rows[0]
    has_ticker = "ticker" in first and "company" in first
    for row in rows:
        tags_str = (row.get("tags") or "").strip()
        tags_list = [t.strip() for t in tags_str.split(";") if t.strip()]
        if not tags_list:
            continue
        if has_ticker:
            ticker = (row.get("ticker") or "").strip().upper()
            company = (row.get("company") or "").strip()
            company_std = normalize_seed_holding(company) if company else ""
            # 用 company 标准化名写入，便于 "NVIDIA CORP" 等匹配
            if company_std:
                for t in tags_list:
                    out.append((company_std, t))
            # 用 ticker 写入，便于持仓里直接是 "NVDA" 时匹配
            if use_ticker_as_key and ticker:
                for t in tags_list:
                    out.append((ticker, t))
        else:
            holding = (row.get("holding") or "").strip()
            if not holding:
                continue
            std = normalize_seed_holding(holding)
            if not std:
                continue
            for t in tags_list:
                out.append((std, t))
    return out


def seed_holding_tag_map(
    conn,
    confidence: float = 0.95,
    csv_path: Optional[str | Path] = None,
) -> int:
    """
    将股票→标签知识库写入 holding_tag_map，source='seed'。
    若提供 csv_path 则从 CSV 加载（holding,tags，; 分隔）；否则使用内置 HOLDING_TAG_SEED。
    依赖 tag_taxonomy 已存在；跳过不存在的 tag_name。
    返回写入/更新的 (holding, tag) 行数。
    """
    cursor = conn.execute("SELECT tag_id, tag_name FROM tag_taxonomy")
    name_to_id = {row[1]: row[0] for row in cursor.fetchall()}
    if csv_path:
        seed_rows = load_seed_from_csv(csv_path)
    else:
        seed_rows = get_seed_rows_normalized()
    rows = []
    for holding_std, tag_name in seed_rows:
        tag_id = name_to_id.get(tag_name)
        if tag_id is None:
            continue
        rows.append((holding_std, tag_id, confidence, "seed"))
    if not rows:
        return 0
    conn.executemany(
        """
        INSERT INTO holding_tag_map (holding_name_std, tag_id, confidence_score, source)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(holding_name_std, tag_id) DO UPDATE SET
            confidence_score = excluded.confidence_score,
            source = excluded.source
        """,
        rows,
    )
    conn.commit()
    return len(rows)
