-- ═══════════════════════════════════════════════════════════════════
--  管理员看板所需表：在 Supabase SQL Editor 中执行
--  file_clicks：文件点击记录（播客/报告）
--  page_entries：用户行为偏好（进入哪个模块）
-- ═══════════════════════════════════════════════════════════════════

-- 文件点击记录表
CREATE TABLE IF NOT EXISTS file_clicks (
    id          BIGSERIAL PRIMARY KEY,
    file_name   TEXT NOT NULL,
    file_type   TEXT NOT NULL,          -- 'podcast' | 'pdf'
    ip          TEXT,
    clicked_at  TEXT NOT NULL
);

-- 页面进入记录表（用户偏好：config / wmp / notes / podcast）
CREATE TABLE IF NOT EXISTS page_entries (
    id          BIGSERIAL PRIMARY KEY,
    entry       TEXT NOT NULL,          -- 'config' | 'wmp' | 'notes' | 'podcast'
    ip          TEXT,
    entered_at  TEXT NOT NULL
);

-- 使用 service_role 写入时可关闭 RLS；若启用 RLS 需自行配置 policy
ALTER TABLE file_clicks  DISABLE ROW LEVEL SECURITY;
ALTER TABLE page_entries DISABLE ROW LEVEL SECURITY;
