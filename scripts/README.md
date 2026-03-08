# MRF 净值下载脚本（AKShare）

## 依赖

```bash
pip install akshare pandas
```

## 1. 下载过去 5 年净值 → data/nav/*.csv

```bash
python scripts/download_mrf_nav_akshare.py
```

- 从东方财富香港基金排行取 968 系列，按 `scripts/mrf_akshare_mapping.csv`（或简称模糊匹配）对应到 app.py 的 MRF_POOL 名称。
- 输出：`data/nav/{基金名}.csv`，格式 `csvdate,nav`，UTF-8，可直接给 Streamlit 用（或 push 到 GitHub Raw）。

## 2. 查看 968 代码与东方财富简称（便于补映射）

```bash
python scripts/list_968_funds.py
```

- 输出当前 akshare 中所有 968 基金的「基金代码」与「基金简称」。
- 若某只 MRF_POOL 基金未匹配，把对应行的 `基金代码` 与 app.py 中的名称写成 `基金代码,display_name` 追加到 `mrf_akshare_mapping.csv` 即可。

## 映射表 mrf_akshare_mapping.csv

- 格式：`基金代码,display_name`
- `display_name` 必须与 app.py 里 MRF_POOL 的 key **完全一致**（用作文件名）。
- 存在该文件时优先使用；未出现在表中的 968 会尝试按「基金简称」与 MRF_POOL 名称模糊匹配。

## 数据范围

- 默认：**过去 5 年**（`YEARS_BACK = 5`），在 `download_mrf_nav_akshare.py` 顶部可改。
