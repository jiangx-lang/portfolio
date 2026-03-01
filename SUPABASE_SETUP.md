# Supabase 访客雷达配置说明

## 1. 在 Supabase 中建表

打开 Supabase 项目 → **SQL Editor**，执行：

```sql
CREATE TABLE IF NOT EXISTS visitor_logs (
  ip TEXT PRIMARY KEY,
  visits INTEGER NOT NULL DEFAULT 1,
  last_visit TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 可选：允许匿名访问（若用 anon key）
ALTER TABLE visitor_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for anon" ON visitor_logs FOR ALL USING (true) WITH CHECK (true);
```

## 2. Streamlit Cloud 配置 Secrets

在 Streamlit 仪表盘 → 你的应用 → **Settings** → **Secrets**，填入（格式 TOML）：

```toml
SUPABASE_URL = "https://wpsiqvbhxhzrynfhbwno.supabase.co"
SUPABASE_KEY = "你的 anon/service_role key（从 Supabase 项目 Settings → API 复制）"
```

保存后重新部署或刷新应用即可。未配置时访客追踪静默跳过，网页正常运行。
