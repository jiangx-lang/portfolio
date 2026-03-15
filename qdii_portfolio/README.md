# QDII Portfolio System

基于渣打 Model Portfolio 的主题化基金配置工具。

## 快速启动

```bash
# 1. 安装依赖
pip install -r requirements.txt

# 2. 生成基金元数据（首次运行）
python -m data.fund_meta_builder

# 3. 启动（在 qdii_portfolio 目录下，或从项目根指定 db）
streamlit run app.py
streamlit run app.py -- --db ../fund_tagging.db
```

## 目录结构

- `app.py` — Streamlit 主入口
- `fund_tagging/` — 核心引擎（在项目根，通过 sys.path 引用）
- `pages/` — theme_search, portfolio_builder, miss_log, admin
- `data/` — tag_aliases.py, benchmarks.py, miss_store.py, fund_meta_builder.py

## 常见操作

- 新增搜索别名：编辑 `data/tag_aliases.py` 的 `TAG_ALIASES`
- 新增预设主题：编辑 `data/tag_aliases.py` 的 `PRESET_THEMES`
- 更新基准：编辑 `data/benchmarks.py`
