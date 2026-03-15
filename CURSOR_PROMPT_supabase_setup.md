# Cursor Task: 接入 Supabase，让 QD 基金净值曲线在 Streamlit Cloud 显示最新数据

## 背景

我有一个 QDII Portfolio 系统，已经 push 到 GitHub 并部署在 Streamlit Cloud。
系统里有一个 `pages/nav_chart.py` 页面，显示基金历史净值曲线。

净值数据存在我本地 Windows 的 `E:\FinancialData\nav_history.db`（SQLite），
每天由 `D:\MF\qd_download_nav.py` 自动下载更新。

Streamlit Cloud 无法读取我本地文件，所以需要用 Supabase 做中转。

## 我已经做好的事情

1. 已注册 Supabase，项目信息如下：
   - Project URL: `https://wpsiqvbhxhzrynfhbwno.supabase.co`
   - Anon/Publishable Key: `sb_publishable_8sWmy_vOCTdplogyWYhxbg_ACf1Uxrz`

2. 项目里已有这些文件（Claude 之前帮我写好的）：
   - `supabase_sync.py` — 把本地 SQLite 数据推到 Supabase 的脚本
   - `pages/nav_chart.py` — 自动切换 Supabase / 本地 SQLite 的曲线页面
   - `requirements.txt` — 已包含 `supabase>=2.3.0`

## 请 Cursor 帮我完成以下 4 件事

---

### 任务 1：在 Supabase 建表

打开 Supabase 项目的 SQL Editor（https://supabase.com/dashboard/project/wpsiqvbhxhzrynfhbwno/sql）

执行以下 SQL：

```sql
-- 净值历史表
CREATE TABLE IF NOT EXISTS nav_history (
    isin     TEXT    NOT NULL,
    ccy      TEXT    NOT NULL,
    nav_date DATE    NOT NULL,
    nav      NUMERIC NOT NULL,
    source   TEXT    NOT NULL DEFAULT 'FT',
    PRIMARY KEY (isin, ccy, nav_date)
);

-- 基金列表表
CREATE TABLE IF NOT EXISTS fund_list (
    code       TEXT NOT NULL,
    isin       TEXT NOT NULL,
    ccy        TEXT NOT NULL,
    bbg        TEXT,
    nav_source TEXT,
    PRIMARY KEY (isin, ccy)
);

-- 开放匿名读取权限（Streamlit Cloud 用 anon key 读）
ALTER TABLE nav_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE fund_list   ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow public read nav_history"
    ON nav_history FOR SELECT USING (true);

CREATE POLICY "allow public read fund_list"
    ON fund_list FOR SELECT USING (true);
```

---

### 任务 2：在本地 Windows 创建 `.env` 文件

在项目根目录（和 `app.py` 同级）创建 `.env` 文件，内容：

```
SUPABASE_URL=https://wpsiqvbhxhzrynfhbwno.supabase.co
SUPABASE_KEY=sb_publishable_8sWmy_vOCTdplogyWYhxbg_ACf1Uxrz
NAV_HISTORY_DB=E:\FinancialData\nav_history.db
```

同时确保 `.gitignore` 里有 `.env`（不要把 key 推到 GitHub）：

```
# .gitignore 确保包含这一行
.env
*.db
```

---

### 任务 3：首次全量同步历史数据到 Supabase

在项目根目录运行：

```bash
pip install supabase python-dotenv

# 加载 .env 并首次全量同步（把本地 nav_history.db 全部推上去）
python supabase_sync.py --all
```

如果 `supabase_sync.py` 没有自动加载 `.env`，在文件顶部加这两行：

```python
from dotenv import load_dotenv
load_dotenv()
```

运行完后验证：

```bash
python supabase_sync.py --check
```

预期输出：`✅ Supabase 连接正常，nav_history 共 XXXX 条记录`

---

### 任务 4：修改 `D:\MF\qd_download_nav.py`，让每次下载后自动同步

在文件 `D:\MF\qd_download_nav.py` 的 `main()` 函数末尾，在最后一行 `print(...)` 之前，加入以下代码：

```python
    # ── 同步到 Supabase（供 Streamlit Cloud 读取）──────────────────
    try:
        import sys, os
        # 把项目目录加入 path（根据你的实际路径调整）
        project_dir = r"D:\portoflio for mrf\qdii_portfolio"  # ← 改成你的项目实际路径
        if project_dir not in sys.path:
            sys.path.insert(0, project_dir)
        
        # 加载环境变量
        from dotenv import load_dotenv
        load_dotenv(os.path.join(project_dir, ".env"))
        
        import supabase_sync
        n = supabase_sync.sync(days=7)        # 每次只同步最近7天（增量）
        supabase_sync.sync_fund_list()        # 同步基金列表
        print(f"Supabase 同步完成：{n} 条")
    except Exception as e:
        print(f"Supabase 同步跳过（{e}）")   # 同步失败不影响本地下载
```

---

### 任务 5：配置 Streamlit Cloud Secrets

在 Streamlit Cloud 后台：
- 打开你的 App → Settings → Secrets
- 填入：

```toml
SUPABASE_URL = "https://wpsiqvbhxhzrynfhbwno.supabase.co"
SUPABASE_KEY = "sb_publishable_8sWmy_vOCTdplogyWYhxbg_ACf1Uxrz"
```

保存后 Streamlit Cloud 会自动重新部署。

---

## 验证一切正常

本地运行：
```bash
streamlit run app.py
```

打开「📈 历史业绩曲线」页面，左上角应显示：
> 数据源：Supabase 云端 ☁️ · 每日自动更新

如果显示「数据源：本地数据库」说明 `.env` 没加载，检查环境变量。

---

## 文件改动总结（给 Cursor 参考）

| 文件 | 操作 |
|------|------|
| `supabase_sync.py` | 顶部加 `load_dotenv()` |
| `.env` | 新建（不 commit） |
| `.gitignore` | 确认包含 `.env` 和 `*.db` |
| `D:\MF\qd_download_nav.py` | `main()` 末尾加同步代码 |
| Streamlit Cloud Secrets | 填入2个环境变量 |

其余文件（`pages/nav_chart.py`、`requirements.txt`）不需要改动，
Claude 之前写的版本已经支持 Supabase 自动切换。
