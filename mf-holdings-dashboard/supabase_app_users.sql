-- ============================================================
-- 自助注册账号表：app_users
-- 对应 Next API：POST /api/auth/register、POST /api/auth/login
-- 在 Supabase SQL Editor 执行一次即可。
-- ============================================================

CREATE TABLE IF NOT EXISTS public.app_users (
  username TEXT PRIMARY KEY,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS：不建任何 anon/authenticated 策略 —— 只允许 service_role 读写
-- （注册/登录均在服务端走 SUPABASE_SERVICE_ROLE_KEY，anon key 无法访问）
ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;

GRANT USAGE ON SCHEMA public TO service_role;
GRANT SELECT, INSERT ON public.app_users TO service_role;
