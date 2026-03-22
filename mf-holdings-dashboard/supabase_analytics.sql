-- ============================================================
-- 访问与阅读统计（由 Next API 写入；仅 service_role 可读全表）
-- 在 Supabase SQL Editor 执行一次。
-- 服务端写入使用 SUPABASE_KEY（通常为 anon）+ 下方 INSERT 策略。
-- 管理员后台读统计需在部署环境配置 SUPABASE_SERVICE_ROLE_KEY。
-- ============================================================

CREATE TABLE IF NOT EXISTS analytics_events (
  id BIGSERIAL PRIMARY KEY,
  event_type TEXT NOT NULL DEFAULT 'page',
  page_path TEXT NOT NULL DEFAULT '',
  content_type TEXT,
  content_id INTEGER,
  ip TEXT,
  user_agent TEXT,
  referrer TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analytics_events_created_at ON analytics_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_path ON analytics_events (page_path);

ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "analytics_events_insert" ON analytics_events;
CREATE POLICY "analytics_events_insert" ON analytics_events
  FOR INSERT
  WITH CHECK (true);

-- 不添加 SELECT 策略：anon/authenticated 无法直接读表；service_role 绕过 RLS。
