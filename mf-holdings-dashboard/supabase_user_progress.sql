-- ============================================================
-- 用户使用成长体系表：user_progress / user_activity
-- 对应 Next API：POST /api/progress/track
-- 在 Supabase SQL Editor 执行一次即可。
-- ============================================================

CREATE TABLE IF NOT EXISTS public.user_progress (
  username TEXT PRIMARY KEY,
  xp INTEGER NOT NULL DEFAULT 0,
  level INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.user_activity (
  id BIGSERIAL PRIMARY KEY,
  username TEXT NOT NULL,
  event_type TEXT NOT NULL,
  xp_delta INTEGER NOT NULL DEFAULT 0,
  page_path TEXT,
  content_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_activity_username
  ON public.user_activity (username, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_activity_event
  ON public.user_activity (event_type, created_at DESC);

-- 根据 XP 自动更新等级
CREATE OR REPLACE FUNCTION public.update_user_level()
RETURNS TRIGGER AS $$
BEGIN
  NEW.level := CASE
    WHEN NEW.xp >= 600 THEN 5
    WHEN NEW.xp >= 300 THEN 4
    WHEN NEW.xp >= 150 THEN 3
    WHEN NEW.xp >= 50 THEN 2
    ELSE 1
  END;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_user_level ON public.user_progress;
CREATE TRIGGER trg_update_user_level
BEFORE INSERT OR UPDATE ON public.user_progress
FOR EACH ROW EXECUTE FUNCTION public.update_user_level();

-- 原子增加 XP
CREATE OR REPLACE FUNCTION public.increment_user_xp(p_username TEXT, p_delta INTEGER)
RETURNS void AS $$
BEGIN
  INSERT INTO public.user_progress (username, xp)
  VALUES (p_username, GREATEST(0, p_delta))
  ON CONFLICT (username) DO UPDATE
  SET xp = GREATEST(0, public.user_progress.xp + p_delta);
END;
$$ LANGUAGE plpgsql;

-- RLS：仅 service_role 读写；应用通过 SUPABASE_SERVICE_ROLE_KEY 访问
ALTER TABLE public.user_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_activity ENABLE ROW LEVEL SECURITY;

GRANT USAGE ON SCHEMA public TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_progress TO service_role;
GRANT SELECT, INSERT ON public.user_activity TO service_role;
