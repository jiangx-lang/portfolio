# MRF 基金池接入 Supabase（方案 A）

## 1. 在 Supabase 建表并导入数据

1. 打开 [Supabase Dashboard](https://supabase.com/dashboard) → 你的项目 → **SQL Editor**。
2. 复制并执行仓库根目录下 **scripts/mrf_funds_schema.sql** 中的 SQL。
3. 执行后会创建表 `mrf_funds` 并插入与 app.py 一致的 16 只基金种子数据。

## 2. Streamlit (app.py)

- 已接入：启动时优先从 Supabase 读取 `mrf_funds`，成功则覆盖硬编码的 `MRF_POOL`，失败则使用代码内默认字典。
- 凭证：环境变量 `SUPABASE_URL`、`SUPABASE_KEY`，或 Streamlit 的 `st.secrets["SUPABASE_URL"]` / `SUPABASE_KEY`。
- 本地测试：在项目根目录执行  
  `python scripts/load_mrf_pool_from_supabase.py`  
  若配置正确会打印前 3 条记录。

## 3. Next.js Dashboard

- **GET /api/mrf/funds**：从 Supabase `mrf_funds` 表读取并返回基金列表。
- **/mrf** 页面：展示 MRF 基金池表格（基金名称、品牌、股/债/现金占比、申购费率）。
- 需在 mf-holdings-dashboard 的 `.env.local` 中配置与 Streamlit 相同的 `SUPABASE_URL`、`SUPABASE_KEY`。

## 4. 表结构 (mrf_funds)

| 列名 | 类型 | 说明 |
|------|------|------|
| fund_name | TEXT PK | 基金名称 |
| brand | TEXT | 品牌 |
| equity_pct | INTEGER | 股票 % |
| fixed_income_pct | INTEGER | 固定收益 % |
| cash_pct | INTEGER | 现金 % |
| fee_rate | REAL | 申购费率 % |
| updated_at | TIMESTAMPTZ | 更新时间 |

后续在 Supabase 中直接修改或插入行即可，Streamlit 与 Next.js 下次请求会自动使用最新数据。
