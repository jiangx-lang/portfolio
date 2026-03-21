# MRF 方案 A 整合 — Cursor 执行步骤

## 第一步：复制新文件到项目

| 来源文件 | 目标路径 |
|---------|---------|
| mrf_route.ts | src/app/api/mrf/funds/route.ts（新建目录）|
| mrf_page.tsx | src/app/mrf/page.tsx（新建目录）|
| load_mrf_pool_from_supabase.py | qdii_portfolio/scripts/load_mrf_pool_from_supabase.py |

## 第二步：修改 src/app/layout.tsx（加导航链接）

在现有导航 <nav> 里加入 MRF 链接：
<Link href="/mrf">MRF</Link>

导航顺序建议：Portfolio | Stock | MRF | AI Signals | Risk

## 第三步：Supabase 建表 + 导入种子数据

1. 打开 https://supabase.com/dashboard
2. 进入你的项目 → SQL Editor
3. 把 mrf_funds.sql 文件内容完整粘贴进去
4. 点 Run → 看到 16 行返回即成功

## 第四步：验证 app.py（Streamlit）

确认 qdii_portfolio/scripts/ 目录下有 load_mrf_pool_from_supabase.py
app.py 里已有这段代码（无需再改）：
  try:
      from scripts.load_mrf_pool_from_supabase import load_mrf_pool_from_supabase
      _mrf_loaded = load_mrf_pool_from_supabase()
      if _mrf_loaded:
          MRF_POOL = _mrf_loaded
  except Exception:
      pass

若 scripts/ 目录不存在，新建并加空的 __init__.py：
  mkdir qdii_portfolio/scripts
  touch qdii_portfolio/scripts/__init__.py

## 第五步：运行验证

npm run dev 后访问：
- http://localhost:3000/mrf → MRF 基金池页面
- http://localhost:3000/api/mrf/funds → 应返回 16 条 JSON 数据

## 完成后整体架构

Supabase
  ├── nav_history    → /api/nav/[isin]     → QDII 净值曲线
  ├── fund_list      → /api/holdings       → 首页持仓表
  └── mrf_funds      → /api/mrf/funds      → MRF 基金池页面
                     → app.py MRF_POOL     → Streamlit 组合构建器

## MRF 页面功能
- 4个指标卡：基金数、平均费率、筛选结果、平均股票比
- 品牌分布饼图（Amundi/BEA/JPM/Pictet/BOC/ValuePartners/Schroders）
- 资产配置堆叠柱状图
- 风险类型筛选：进取型/均衡型/稳健型
- 品牌筛选 tabs
- 完整基金表（点击行展示详情）
- 费率颜色编码：红≥3% / 黄≥2% / 绿<2%
