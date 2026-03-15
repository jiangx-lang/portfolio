# 标签体系迁移说明：数据位置 + HALO 含义 + 完整 Taxonomy

供你写「迁移 + 重建」脚本时精确对接。

---

## 一、标签数据在哪里

| 数据 | 位置 | 说明 |
|------|------|------|
| **Taxonomy（标签定义）** | 数据库表 | `fund_tagging.db` → 表 `tag_taxonomy` |
| **Taxonomy（代码源）** | 代码文件 | `fund_tagging/seed_taxonomy_47.py` → 变量 `TAXONOMY_47`（64 条，为表数据来源） |
| **持仓→标签映射** | 数据库表 | `fund_tagging.db` → 表 `holding_tag_map` |
| **基金→标签聚合** | 数据库表 | `fund_tagging.db` → 表 `fund_tag_map` |
| **股票标签种子 CSV** | 文件 | `fund_tagging/stock_tag_seed.csv`（ticker, company, tags） |
| **持仓暴露** | 数据库表 | `fund_tagging.db` → 表 `fund_holding_exposure` |

**数据库路径（相对项目根）**：`fund_tagging.db`（与 `fund_tagging/` 目录同级时，也可用 `fund_tagging/fund_tagging.db` 视你 run 的 cwd 而定）。

---

## 二、HALO 是什么含义

- **tag_id**：110  
- **tag_name**：`HALO`  
- **category**：**`theme`**（已从 custom 迁入 theme，搜索用 `--themes "HALO"`）  
- **含义**：销售侧使用的「核心叙事组合」标签，指：**AI 芯片（NVIDIA、BROADCOM、TSMC 等）+ 亚洲基础设施 REITs（CapitaLand、Keppel DC 等）**；纯国债/政府债不标 HALO（见债券 HALO 过滤）。  
- **aliases**：`halo strategy,halo portfolio`  
- **注意**：另有 `halo`（小写，tag_id=100，custom），若只迁一套以 **HALO（110）** 为准。

---

## 三、表结构（便于你建表 / 映射）

### 1. tag_taxonomy

```sql
CREATE TABLE tag_taxonomy (
    tag_id         INTEGER PRIMARY KEY,
    tag_name       TEXT NOT NULL UNIQUE,
    category       TEXT NOT NULL,
    parent_tag_id  INTEGER REFERENCES tag_taxonomy(tag_id),
    aliases        TEXT,
    is_active      INTEGER NOT NULL DEFAULT 1,
    created_at     TEXT
);
```

**category 取值**：`region` | `sector` | `theme` | `style` | `asset_class` | `custom`

### 2. holding_tag_map（持仓→标签）

```sql
CREATE TABLE holding_tag_map (
    holding_name_std  TEXT NOT NULL,
    tag_id            INTEGER NOT NULL REFERENCES tag_taxonomy(tag_id),
    confidence_score  REAL NOT NULL,
    source            TEXT NOT NULL,  -- 'rule' | 'llm' | 'manual' | 'seed'
    created_at        TEXT,
    PRIMARY KEY (holding_name_std, tag_id)
);
```

### 3. fund_tag_map（基金→标签聚合）

```sql
CREATE TABLE fund_tag_map (
    fund_id           INTEGER NOT NULL,
    tag_id            INTEGER NOT NULL REFERENCES tag_taxonomy(tag_id),
    aggregated_score  REAL NOT NULL,
    explanation       TEXT,   -- JSON: {"NVIDIA": 8.5, "TSMC": 4.2}
    as_of_date        TEXT,
    updated_at        TEXT,
    PRIMARY KEY (fund_id, tag_id)
);
```

---

## 四、完整 Taxonomy 数据（64 条，可直接导入）

以下为 `(tag_id, tag_name, category, parent_tag_id, aliases)`，`parent_tag_id` 空写为 NULL。

```csv
tag_id,tag_name,category,parent_tag_id,aliases
1,US,region,,usa,united states,american,美国,美股
2,Europe,region,,eu,eurozone,欧洲
3,Asia,region,,apac,asia pacific,亚洲
4,China,region,3,china mainland,中国,A股
5,Japan,region,3,japan,日本,日股
6,Global,region,,world,global markets,全球
7,Emerging Markets,region,,emerging markets,em,新兴市场
20,Technology,sector,,tech,it,科技
21,Financials,sector,,finance,banking,金融
22,Healthcare,sector,,health,biotech,医疗
23,Industrials,sector,,industrial,manufacturing,工业
24,Consumer,sector,,consumer discretionary,consumer staples,消费
25,Energy,sector,,oil,gas,能源
26,Materials,sector,,basic materials,metals,材料
27,Utilities,sector,,power,electricity,公用事业
28,Real Estate,sector,,reit,property,房地产
29,Communication Services,sector,,media,telecom,通信
40,AI,theme,,artificial intelligence,人工智能,生成式AI
111,AI Software,theme,40,ai software,ai application,ai platform
112,AI Hardware,theme,40,ai hardware,ai chips,ai infrastructure
113,AI Infrastructure,theme,40,ai infrastructure,datacenter,ai datacenter
115,AI Datacenter,theme,113,ai datacenter,data center
116,Datacenter,theme,,datacenter,data center,数据中心
117,China Internet,theme,4,china internet,中国互联网
118,Enterprise Software,theme,,enterprise software,企业软件
41,SaaS,theme,,software as a service,cloud software,云软件
42,Semiconductor,theme,,chips,semis,半导体
114,Semiconductor Equipment,theme,,semi equipment,semiconductor equipment
43,Cloud,theme,,cloud computing,云计算
44,Internet,theme,,internet platform,在线平台
45,Robotics,theme,,robot,automation,机器人
46,Cybersecurity,theme,,security software,网络安全
47,Gold,theme,,gold miners,precious metals,黄金
48,Infrastructure,theme,,infrastructure,基建
49,Defense,theme,,defense,aerospace,军工
119,Energy Transition,theme,,energy transition,clean energy,能源转型
120,EV,theme,,ev,electric vehicle,电动车
121,Logistics,theme,,logistics,物流
122,Insurance,theme,,insurance,保险
123,Asset Management,theme,,asset management,资产管理
60,Value,style,,value investing,价值
61,Growth,style,,growth investing,成长
62,Blend,style,,core blend,混合
63,Quality,style,,high quality,高质量
64,Low Vol,style,,low volatility,低波动
65,Income,style,,income strategy,收益型
66,Broad Market,style,,index market,broad exposure,宽基
67,Concentrated,style,,high conviction,集中持仓
68,Mega Cap,style,,mega cap,mega-cap,large cap,超大市值
80,Equity,asset_class,,stocks,股票
81,Bond,asset_class,,fixed income,债券
86,Investment Grade,asset_class,81,投资级别,IG,investment grade
87,Non-Investment Grade,asset_class,81,非投资级别,高收益,垃圾债,high yield,HY,non-investment grade
82,Multi Asset,asset_class,,balanced,multi asset,多资产
83,Commodity,asset_class,,commodities,大宗商品
84,REIT,asset_class,,real estate investment trust,房地产信托
85,Money Market,asset_class,,cash fund,货币基金
100,halo,custom,,halo strategy
110,HALO,custom,,halo strategy,halo portfolio
101,core,custom,,core holding,核心仓
102,satellite,custom,,satellite position,卫星仓
103,defensive,custom,,defense portfolio,防守
104,aggressive,custom,,aggressive strategy,进攻
105,watchlist,custom,,watch list,观察池
```

（上表 aliases 中逗号在 CSV 内需按你格式转义或拆列。）

**可直接导入的 CSV**：已从当前库导出为 `fund_tagging/tag_taxonomy_export.csv`（列：tag_id, tag_name, category, parent_tag_id, aliases, is_active），你方迁移脚本可直接读此文件写入你的 taxonomy 表。

---

## 五、SQL 导出命令（从当前 fund_tagging.db 拉取）

在你环境中执行，即可得到「当前库里的」标签与映射数据，用于迁移脚本的输入：

```sql
-- 导出 tag_taxonomy（完整 64 条）
SELECT tag_id, tag_name, category, parent_tag_id, aliases, is_active
FROM tag_taxonomy
ORDER BY tag_id;

-- 导出 holding_tag_map（约 1665 条）
SELECT holding_name_std, tag_id, confidence_score, source
FROM holding_tag_map
ORDER BY holding_name_std, tag_id;

-- 导出 fund_tag_map（141 只基金 × 多标签）
SELECT fund_id, tag_id, aggregated_score, explanation, as_of_date
FROM fund_tag_map
ORDER BY fund_id, tag_id;
```

---

## 六、迁移脚本建议顺序

1. **建表**：按你库的语法创建 `tag_taxonomy`、`holding_tag_map`、`fund_tag_map`（若你库已有等价表，可只做字段映射）。  
2. **清空或备份**：清空你当前的「临时标签」相关表或做备份。  
3. **导入 taxonomy**：用上面第四节或 `SELECT * FROM tag_taxonomy` 的结果，插入到你的 `tag_taxonomy`（或等价表），**保持 tag_id 一致**，便于后续映射。  
4. **导入 holding_tag_map**：用 `holding_tag_map` 的导出结果，写入你的「持仓→标签」表（需把 `holding_name_std` 映射到你方的持仓主键/名称字段）。  
5. **导入 fund_tag_map**：用 `fund_tag_map` 的导出结果，写入你的「基金→标签」表（需把 `fund_id` 映射到你方的基金主键）。  
6. **校验**：检查 HALO（tag_id=110）等关键标签在你 pipeline 中的展示与筛选是否一致。

若你提供你方的表结构（表名 + 字段名），我可以按上述顺序写成一份可直接运行的「迁移 + 重建」脚本（含你库的 SQL 或 Python 示例）。
