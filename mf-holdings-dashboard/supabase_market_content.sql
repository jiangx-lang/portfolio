-- ============================================================
-- 市场笔记 / 播客 / 每日报告（Next.js 管理员与公开页）
-- 在 Supabase SQL Editor 执行；执行后去 Storage 创建公开 bucket：
--   podcasts（public）、reports（public）
-- 并为各 bucket 添加策略：允许 anon 读取；上传策略按需在控制台配置
-- （MVP 下可设「允许公开上传」仅限内网管理，生产建议用 signed URL + 服务端上传）
-- ============================================================

CREATE TABLE IF NOT EXISTS market_notes (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS podcasts (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  date DATE NOT NULL,
  audio_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS daily_reports (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  date DATE NOT NULL,
  file_url TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS：公开读 + anon 可写（与浏览器端 anon key 发布一致；生产请改为服务端 + service_role）
ALTER TABLE market_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE podcasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "market_notes_select" ON market_notes;
DROP POLICY IF EXISTS "market_notes_insert" ON market_notes;
CREATE POLICY "market_notes_select" ON market_notes FOR SELECT USING (true);
CREATE POLICY "market_notes_insert" ON market_notes FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "podcasts_select" ON podcasts;
DROP POLICY IF EXISTS "podcasts_insert" ON podcasts;
CREATE POLICY "podcasts_select" ON podcasts FOR SELECT USING (true);
CREATE POLICY "podcasts_insert" ON podcasts FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "daily_reports_select" ON daily_reports;
DROP POLICY IF EXISTS "daily_reports_insert" ON daily_reports;
CREATE POLICY "daily_reports_select" ON daily_reports FOR SELECT USING (true);
CREATE POLICY "daily_reports_insert" ON daily_reports FOR INSERT WITH CHECK (true);
