-- 在 Supabase SQL Editor 执行
create table if not exists login_logs (
  id bigserial primary key,
  username text not null,
  logged_in_at timestamptz not null default now(),
  ip text,
  user_agent text
);

-- 关闭 RLS（只用 service role key 写入，不需要用户级权限）
alter table login_logs disable row level security;
