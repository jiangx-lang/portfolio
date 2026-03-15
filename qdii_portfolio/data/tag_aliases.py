"""
data/tag_aliases.py
中英文别名词典 + 预设主题配置

新增一个主题只需在 PRESET_THEMES 加一行。
新增一个别名只需在 TAG_ALIASES 加一条。
"""

# ── 别名词典：用户输入 → 规范标签列表 ────────────────────────────
# key 全小写，供 resolve_query() 做 lower-case 匹配
TAG_ALIASES: dict[str, list[str]] = {
    # ── AI 系列 ──────────────────────────────────────────────────
    "ai":                       ["AI Hardware", "AI Software"],
    "人工智能":                  ["AI Hardware", "AI Software"],
    "ai硬件":                   ["AI Hardware"],
    "人工智能硬件":               ["AI Hardware"],
    "ai chips":                 ["AI Hardware"],
    "ai chip":                  ["AI Hardware"],
    "ai software":              ["AI Software"],
    "ai软件":                   ["AI Software"],
    "人工智能软件":               ["AI Software"],
    "ai应用":                   ["AI Software"],
    "ai infrastructure":        ["AI Infrastructure"],
    "ai基础设施":                ["AI Infrastructure"],
    "ai全栈":                   ["AI Hardware", "AI Software", "AI Infrastructure"],
    "generative ai":            ["AI Software"],
    "生成式ai":                  ["AI Software"],

    # ── 半导体 & 芯片 ────────────────────────────────────────────
    "半导体":                    ["Semiconductor"],
    "芯片":                      ["Semiconductor"],
    "chips":                    ["Semiconductor"],
    "semiconductor":            ["Semiconductor"],
    "半导体设备":                 ["Semiconductor"],
    "semiconductor equipment":  ["Semiconductor"],

    # ── 云计算 & SaaS ────────────────────────────────────────────
    "云计算":                    ["Cloud/SaaS"],
    "cloud":                    ["Cloud/SaaS"],
    "saas":                     ["Cloud/SaaS"],
    "software as a service":    ["Cloud/SaaS"],
    "enterprise software":      ["Cloud/SaaS", "AI Software"],
    "企业软件":                  ["Cloud/SaaS", "AI Software"],

    # ── 科技 (宽泛) ──────────────────────────────────────────────
    "科技":                      ["Technology", "AI Hardware", "AI Software"],
    "tech":                     ["Technology"],
    "technology":               ["Technology"],
    "信息技术":                  ["Technology"],

    # ── 中国 / 大中华 ────────────────────────────────────────────
    "中国互联网":                 ["China Internet"],
    "china internet":           ["China Internet"],
    "中国科技":                  ["China Internet", "China"],
    "大中华":                    ["China", "China Internet"],
    "china":                    ["China"],
    "中国":                      ["China"],
    "香港":                      ["China"],
    "hong kong":                ["China"],
    "a股":                      ["China"],

    # ── 亚洲 ────────────────────────────────────────────────────
    "亚洲":                      ["Asia"],
    "asia":                     ["Asia"],
    "亚太":                      ["Asia"],
    "apac":                     ["Asia"],
    "亚洲科技":                  ["AI Hardware", "Asia"],
    "asia tech":                ["AI Hardware", "Asia"],
    "亚洲半导体":                 ["Semiconductor", "Asia"],

    # ── 新兴市场 ─────────────────────────────────────────────────
    "新兴市场":                  ["Emerging Markets"],
    "emerging markets":        ["Emerging Markets"],
    "em":                       ["Emerging Markets"],
    "印度":                      ["Emerging Markets"],
    "india":                    ["Emerging Markets"],
    "东南亚":                    ["Emerging Markets", "Asia"],
    "southeast asia":          ["Emerging Markets", "Asia"],

    # ── 美国 ────────────────────────────────────────────────────
    "美国":                      ["US"],
    "us":                       ["US"],
    "美股":                      ["US"],
    "north america":            ["US"],
    "北美":                      ["US"],
    "美国科技":                  ["US", "Technology"],
    "us tech":                  ["US", "Technology"],

    # ── 欧洲 / 日本 ──────────────────────────────────────────────
    "欧洲":                      ["Europe"],
    "europe":                   ["Europe"],
    "日本":                      ["Japan"],
    "japan":                    ["Japan"],

    # ── 高股息 / 收益 ────────────────────────────────────────────
    "高股息":                    ["Income/Dividend"],
    "股息":                      ["Income/Dividend"],
    "dividend":                 ["Income/Dividend"],
    "high dividend":            ["Income/Dividend"],
    "income":                   ["Income/Dividend"],
    "yield":                    ["Income/Dividend"],
    "收益型":                    ["Income/Dividend"],

    # ── 房地产 / REIT ────────────────────────────────────────────
    "reit":                     ["Real Estate", "Income/Dividend"],
    "房地产":                    ["Real Estate"],
    "real estate":              ["Real Estate"],
    "property":                 ["Real Estate"],
    "房地产信托":                 ["Real Estate", "Income/Dividend"],

    # ── 基础设施 ─────────────────────────────────────────────────
    "基础设施":                  ["Infrastructure"],
    "infrastructure":          ["Infrastructure"],
    "机场":                      ["Infrastructure"],

    # ── HALO ────────────────────────────────────────────────────
    "halo":                     ["HALO"],
    "halo主题":                  ["HALO"],
    "halo strategy":            ["HALO"],

    # ── 债券 / 低波动 ─────────────────────────────────────────────
    "债券":                      ["Bond"],
    "bond":                     ["Bond"],
    "fixed income":             ["Bond"],
    "国债":                      ["Bond"],
    "treasury":                 ["Bond"],
    "低波动":                    ["Low Vol"],
    "low vol":                  ["Low Vol"],
    "low volatility":           ["Low Vol"],
    "defensive":                ["Low Vol", "Quality"],
    "防守":                      ["Low Vol", "Quality"],
    "稳健":                      ["Low Vol", "Bond", "Quality"],

    # ── 质量 / 大盘 ──────────────────────────────────────────────
    "质量":                      ["Quality"],
    "quality":                  ["Quality"],
    "大盘":                      ["Mega Cap"],
    "超大盘":                    ["Mega Cap"],
    "mega cap":                 ["Mega Cap"],
    "large cap":                ["Mega Cap"],
    "成长":                      ["Mega Cap", "Technology"],
    "growth":                   ["Mega Cap", "Technology"],

    # ── 行业主题 ─────────────────────────────────────────────────
    "医疗":                      ["Healthcare"],
    "医药":                      ["Healthcare"],
    "healthcare":               ["Healthcare"],
    "biotech":                  ["Healthcare"],
    "生物科技":                  ["Healthcare"],
    "pharma":                   ["Healthcare"],
    "国防":                      ["Defense"],
    "军工":                      ["Defense"],
    "defense":                  ["Defense"],
    "aerospace":                ["Defense"],
    "能源转型":                  ["Energy Transition"],
    "清洁能源":                  ["Energy Transition"],
    "clean energy":             ["Energy Transition"],
    "绿能":                      ["Energy Transition"],
    "renewable":                ["Energy Transition"],
    "电动车":                    ["EV"],
    "新能源车":                   ["EV"],
    "ev":                       ["EV"],
    "electric vehicle":         ["EV"],
    "黄金":                      ["Gold"],
    "gold":                     ["Gold"],
    "贵金属":                    ["Gold"],
    "precious metal":           ["Gold"],
    "机器人":                    ["Robotics"],
    "robotics":                 ["Robotics"],
    "automation":               ["Robotics"],
    "自动化":                    ["Robotics"],
    "cybersecurity":            ["Cybersecurity"],
    "网络安全":                  ["Cybersecurity"],
    "数据中心":                  ["Datacenter", "AI Infrastructure"],
    "datacenter":               ["Datacenter", "AI Infrastructure"],
    "data center":              ["Datacenter", "AI Infrastructure"],
    "logistics":                ["Logistics"],
    "物流":                      ["Logistics"],
    "insurance":                ["Insurance"],
    "保险":                      ["Insurance"],
    "asset management":         ["Asset Management"],
    "资产管理":                  ["Asset Management"],
}

# ── 预设主题 pills ────────────────────────────────────────────────
# label: 显示文字
# tags:  对应的规范标签列表（可多个，结果取 OR）
PRESET_THEMES: list[dict] = [
    {"label": "HALO",        "tags": ["HALO"]},
    {"label": "AI 硬件",     "tags": ["AI Hardware"]},
    {"label": "AI 软件",     "tags": ["AI Software"]},
    {"label": "AI 全栈",     "tags": ["AI Hardware", "AI Software", "AI Infrastructure"]},
    {"label": "半导体",      "tags": ["Semiconductor"]},
    {"label": "亚洲科技",    "tags": ["AI Hardware", "Asia"]},
    {"label": "中国互联网",  "tags": ["China Internet"]},
    {"label": "高股息",      "tags": ["Income/Dividend"]},
    {"label": "美国科技",    "tags": ["US", "Technology"]},
    {"label": "新兴市场",    "tags": ["Emerging Markets"]},
    {"label": "基础设施",    "tags": ["Infrastructure", "Real Estate"]},
    {"label": "低波动债券",  "tags": ["Bond", "Low Vol"]},
    {"label": "全部",        "tags": []},
]
