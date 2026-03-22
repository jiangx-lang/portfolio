-- ============================================================
-- 页面访问日志 visitor_logs（自建服务器 / 腾讯云等，不依赖 Vercel）
-- 写入：Next API POST /api/track（使用 SUPABASE_SERVICE_ROLE_KEY，绕过 RLS）
-- 读取：GET /api/admin/visitors（同上）
-- 在 Supabase SQL Editor 执行一次即可。
-- ============================================================

CREATE TABLE IF NOT EXISTS public.visitor_logs (
  id SERIAL PRIMARY KEY,
  page TEXT NOT NULL,
  ip TEXT,
  country TEXT,
  city TEXT,
  user_agent TEXT,
  referer TEXT,
  visited_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_visitor_logs_visited_at
  ON public.visitor_logs (visited_at DESC);

ALTER TABLE public.visitor_logs ENABLE ROW LEVEL SECURITY;

-- 不添加面向 anon/authenticated 的 policy：默认拒绝；仅 service_role（Secret key）绕过 RLS 可读写。
