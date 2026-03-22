-- ============================================================
-- analytics_events 完整补丁（可在 Supabase SQL Editor 重复执行）
-- 对应 Next API：POST /api/analytics/track → insert 下列字段
--
-- 若仍 500：在浏览器 Network 里点开 track → Response，看 error 原文。
-- ============================================================

-- 1) 表（public 架构，与 PostgREST 默认一致）
CREATE TABLE IF NOT EXISTS public.analytics_events (
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

-- 2) 旧表补列（若你曾手动建过缺列的表）
ALTER TABLE public.analytics_events ADD COLUMN IF NOT EXISTS event_type TEXT;
ALTER TABLE public.analytics_events ADD COLUMN IF NOT EXISTS page_path TEXT;
ALTER TABLE public.analytics_events ADD COLUMN IF NOT EXISTS content_type TEXT;
ALTER TABLE public.analytics_events ADD COLUMN IF NOT EXISTS content_id INTEGER;
ALTER TABLE public.analytics_events ADD COLUMN IF NOT EXISTS ip TEXT;
ALTER TABLE public.analytics_events ADD COLUMN IF NOT EXISTS user_agent TEXT;
ALTER TABLE public.analytics_events ADD COLUMN IF NOT EXISTS referrer TEXT;
ALTER TABLE public.analytics_events ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;

-- 尽量保证 NOT NULL 列有默认值（避免历史行违反约束）
ALTER TABLE public.analytics_events
  ALTER COLUMN event_type SET DEFAULT 'page';
ALTER TABLE public.analytics_events
  ALTER COLUMN page_path SET DEFAULT '';
ALTER TABLE public.analytics_events
  ALTER COLUMN created_at SET DEFAULT NOW();

UPDATE public.analytics_events
SET event_type = 'page'
WHERE event_type IS NULL;
UPDATE public.analytics_events
SET page_path = ''
WHERE page_path IS NULL;
UPDATE public.analytics_events
SET created_at = NOW()
WHERE created_at IS NULL;

ALTER TABLE public.analytics_events
  ALTER COLUMN event_type SET NOT NULL;
ALTER TABLE public.analytics_events
  ALTER COLUMN page_path SET NOT NULL;
ALTER TABLE public.analytics_events
  ALTER COLUMN created_at SET NOT NULL;

-- 3) 索引
CREATE INDEX IF NOT EXISTS idx_analytics_events_created_at
  ON public.analytics_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_path
  ON public.analytics_events (page_path);

-- 4) RLS：仅允许 anon/authenticated 插入；不设 SELECT（防前端拖库）
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "analytics_events_insert" ON public.analytics_events;
CREATE POLICY "analytics_events_insert" ON public.analytics_events
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- 5) 权限（缺了会导致 insert 500）
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT INSERT ON TABLE public.analytics_events TO anon, authenticated;

-- 仅当 id 为 SERIAL/BIGSERIAL 时才有序列；硬编码 analytics_events_id_seq 在「旧表非 serial」时会报错 42P01
DO $grant_seq$
DECLARE
  seq_name text;
BEGIN
  seq_name := pg_get_serial_sequence('public.analytics_events', 'id');
  IF seq_name IS NOT NULL THEN
    EXECUTE format(
      'GRANT USAGE, SELECT ON SEQUENCE %s TO anon, authenticated',
      seq_name
    );
  END IF;
END $grant_seq$;

-- service_role 读统计用（绕过 RLS）；显式授权无妨
GRANT SELECT ON TABLE public.analytics_events TO service_role;

-- ============================================================
-- 写入字段对照（勿改列名，除非同步改 route.ts）：
-- event_type, page_path, content_type, content_id, ip, user_agent, referrer
-- created_at 默认 NOW()
-- ============================================================
--
-- 若 track 仍失败且 Supabase 报与 id/序列相关：
-- 说明当前表是早期手工建的，id 可能不是 BIGSERIAL。可在 SQL Editor 先清空再建（会丢统计）：
--
--   DROP TABLE IF EXISTS public.analytics_events CASCADE;
--
-- 然后重新从本文件「第 1) 表」整段执行一遍。
-- ============================================================
