# Supabase 访客雷达：建表与开门

## 1. 在 Supabase 中建表

1. 打开 [Supabase 控制台](https://supabase.com/dashboard) → 进入你的项目。
2. 左侧黑色菜单栏点击 **SQL Editor**（终端图标）。
3. 点击 **+ New query**，在代码框中粘贴下面整段 SQL：

```sql
-- 1. 创建名为 visitor_logs 的数据表
CREATE TABLE visitor_logs (
  ip TEXT PRIMARY KEY,
  visits INTEGER DEFAULT 1,
  last_visit TEXT
);

-- 2. 关闭表级别的行级安全（RLS），允许网页写入数据
ALTER TABLE visitor_logs DISABLE ROW LEVEL SECURITY;
```

4. 点击右下角绿色 **Run**。
5. 看到 **"Success, no rows returned"** 即表示表已建好、大门已敞开。

---

## 2. Streamlit 保险箱（必做）

建表后，务必在 Streamlit 后台放入两把钥匙：

1. 打开 **Streamlit 仪表盘** → 找到你的 App → 右侧 **⋮** → **Settings**。
2. 左侧点 **Secrets**。
3. 在文本框里按下面格式粘贴（替换成你自己的 URL 和 anon key），然后 **Save**：

```toml
SUPABASE_URL = "https://你刚才复制的那个.supabase.co"
SUPABASE_KEY = "eyJhbG...你刚才复制的那一长串anon钥匙..."
```

- **SUPABASE_URL**：Supabase 项目 **Settings → API** 里的 Project URL。
- **SUPABASE_KEY**：同一页的 **anon public** 密钥（一长串 JWT）。

保存后刷新你的网页，在页面**最底部左侧**展开「♏ 引擎状态监控」，应能看到「总独立访客 IP」≥ 1，表格里出现你的访问记录，雷达即点亮。

---

## 3. 若出现 PGRST205：强制刷新 Schema 缓存

建表后若网页报 **PGRST205**（PostgREST 找不到表），多半是 **Schema 缓存未更新**：API 还在用旧“地图”，不知道新表已建好。

**解决：在 Supabase 里刷新缓存**

1. 打开 **SQL Editor** → **+ New query**（或清空当前查询框）。
2. 粘贴下面一行并 **Run**：

```sql
NOTIFY pgrst, 'reload schema';
```

3. 回到你的网页**刷新**，红字报错应消失，变为绿色 ✅ 和雷达表。

**备用：** 若上述指令后仍报错，可到 **Table Editor** → 点开 **visitor_logs** 表看一眼，后台 UI 操作有时也会触发 API 自动刷新。
