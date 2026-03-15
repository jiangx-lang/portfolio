"""
实用版 tag_taxonomy seed：59 标签。含 Datacenter、China Internet、Enterprise Software 及销售用 AI/HALO/Quality 等。
"""

# 59 标签：(tag_id, tag_name, category, parent_tag_id, aliases)
TAXONOMY_47 = [
    # REGION
    (1, "US", "region", None, "usa,united states,american,美国,美股"),
    (2, "Europe", "region", None, "eu,eurozone,欧洲"),
    (3, "Asia", "region", None, "apac,asia pacific,亚洲"),
    (4, "China", "region", 3, "china mainland,中国,A股"),
    (5, "Japan", "region", 3, "japan,日本,日股"),
    (6, "Global", "region", None, "world,global markets,全球"),
    (7, "Emerging Markets", "region", None, "emerging markets,em,新兴市场"),
    # SECTOR
    (20, "Technology", "sector", None, "tech,it,科技"),
    (21, "Financials", "sector", None, "finance,banking,金融"),
    (22, "Healthcare", "sector", None, "health,biotech,医疗"),
    (23, "Industrials", "sector", None, "industrial,manufacturing,工业"),
    (24, "Consumer", "sector", None, "consumer discretionary,consumer staples,消费"),
    (25, "Energy", "sector", None, "oil,gas,能源"),
    (26, "Materials", "sector", None, "basic materials,metals,材料"),
    (27, "Utilities", "sector", None, "power,electricity,公用事业"),
    (28, "Real Estate", "sector", None, "reit,property,房地产"),
    (29, "Communication Services", "sector", None, "media,telecom,通信"),
    # THEME
    (40, "AI", "theme", None, "artificial intelligence,人工智能,生成式AI"),
    (111, "AI Software", "theme", 40, "ai software,ai application,ai platform"),
    (112, "AI Hardware", "theme", 40, "ai hardware,ai chips,ai infrastructure"),
    (113, "AI Infrastructure", "theme", 40, "ai infrastructure,datacenter,ai datacenter"),
    (115, "AI Datacenter", "theme", 113, "ai datacenter,data center"),
    (116, "Datacenter", "theme", None, "datacenter,data center,数据中心"),
    (117, "China Internet", "theme", 4, "china internet,中国互联网"),
    (118, "Enterprise Software", "theme", None, "enterprise software,企业软件"),
    (41, "SaaS", "theme", None, "software as a service,cloud software,云软件"),
    (42, "Semiconductor", "theme", None, "chips,semis,半导体"),
    (114, "Semiconductor Equipment", "theme", None, "semi equipment,semiconductor equipment"),
    (43, "Cloud", "theme", None, "cloud computing,云计算"),
    (44, "Internet", "theme", None, "internet platform,在线平台"),
    (45, "Robotics", "theme", None, "robot,automation,机器人"),
    (46, "Cybersecurity", "theme", None, "security software,网络安全"),
    (47, "Gold", "theme", None, "gold miners,precious metals,黄金"),
    (48, "Infrastructure", "theme", None, "infrastructure,基建"),
    (49, "Defense", "theme", None, "defense,aerospace,军工"),
    (119, "Energy Transition", "theme", None, "energy transition,clean energy,能源转型"),
    (120, "EV", "theme", None, "ev,electric vehicle,电动车"),
    (121, "Logistics", "theme", None, "logistics,物流"),
    (122, "Insurance", "theme", None, "insurance,保险"),
    (123, "Asset Management", "theme", None, "asset management,资产管理"),
    (110, "HALO", "theme", None, "halo strategy,halo portfolio"),
    # STYLE
    (60, "Value", "style", None, "value investing,价值"),
    (61, "Growth", "style", None, "growth investing,成长"),
    (62, "Blend", "style", None, "core blend,混合"),
    (63, "Quality", "style", None, "high quality,高质量"),
    (64, "Low Vol", "style", None, "low volatility,低波动"),
    (65, "Income", "style", None, "income strategy,收益型"),
    (66, "Broad Market", "style", None, "index market,broad exposure,宽基"),
    (67, "Concentrated", "style", None, "high conviction,集中持仓"),
    (68, "Mega Cap", "style", None, "mega cap,mega-cap,large cap,超大市值"),
    # ASSET_CLASS
    (80, "Equity", "asset_class", None, "stocks,股票"),
    (81, "Bond", "asset_class", None, "fixed income,债券"),
    (86, "Investment Grade", "asset_class", 81, "投资级别,IG,investment grade"),
    (87, "Non-Investment Grade", "asset_class", 81, "非投资级别,高收益,垃圾债,high yield,HY,non-investment grade"),
    (82, "Multi Asset", "asset_class", None, "balanced,multi asset,多资产"),
    (83, "Commodity", "asset_class", None, "commodities,大宗商品"),
    (84, "REIT", "asset_class", None, "real estate investment trust,房地产信托"),
    (85, "Money Market", "asset_class", None, "cash fund,货币基金"),
    # CUSTOM
    (100, "halo", "custom", None, "halo strategy"),
    (101, "core", "custom", None, "core holding,核心仓"),
    (102, "satellite", "custom", None, "satellite position,卫星仓"),
    (103, "defensive", "custom", None, "defense portfolio,防守"),
    (104, "aggressive", "custom", None, "aggressive strategy,进攻"),
    (105, "watchlist", "custom", None, "watch list,观察池"),
]


def ensure_is_active_column(conn):
    """若表已存在且无 is_active，则添加列（兼容旧库）"""
    try:
        row = conn.execute("PRAGMA table_info(tag_taxonomy)").fetchall()
        cols = [r[1] for r in row]
        if "is_active" not in cols:
            conn.execute("ALTER TABLE tag_taxonomy ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1")
            conn.commit()
    except Exception:
        pass


def seed_taxonomy_47(conn, replace: bool = True) -> int:
    """
    写入 64 标签（含 Energy Transition/EV/Logistics 等）。replace=True 时先清空 tag_taxonomy 及 holding_tag_map、fund_tag_map 再插入。
    执行后需重新跑 tag-all 以根据新 taxonomy 打标并聚合。
    返回插入行数。
    """
    if replace:
        conn.execute("DELETE FROM fund_tag_map")
        conn.execute("DROP TABLE IF EXISTS holding_tag_map")
        conn.execute("DROP TABLE IF EXISTS tag_taxonomy")
        conn.execute("""
            CREATE TABLE tag_taxonomy (
                tag_id         INTEGER PRIMARY KEY,
                tag_name       TEXT NOT NULL UNIQUE,
                category       TEXT NOT NULL,
                parent_tag_id  INTEGER REFERENCES tag_taxonomy(tag_id),
                aliases        TEXT,
                is_active      INTEGER NOT NULL DEFAULT 1,
                created_at     TEXT DEFAULT (datetime('now'))
            )
        """)
        conn.execute("CREATE INDEX IF NOT EXISTS idx_tag_taxonomy_category ON tag_taxonomy(category)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_tag_taxonomy_parent ON tag_taxonomy(parent_tag_id)")
    else:
        ensure_is_active_column(conn)
    for t in TAXONOMY_47:
        tag_id, tag_name, category, parent_tag_id, aliases = t
        conn.execute(
            """
            INSERT OR REPLACE INTO tag_taxonomy (tag_id, tag_name, category, parent_tag_id, aliases, is_active)
            VALUES (?, ?, ?, ?, ?, 1)
            """,
            (tag_id, tag_name, category, parent_tag_id, (aliases or "").strip()),
        )
    conn.commit()
    return len(TAXONOMY_47)
