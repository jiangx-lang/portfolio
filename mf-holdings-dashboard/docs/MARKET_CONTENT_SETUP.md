# 市场笔记 / 播客 / 每日报告（Next + Supabase）

## 1. 数据库

在 Supabase **SQL Editor** 执行项目内 `supabase_market_content.sql`。

## 2. Storage

在 **Storage** 新建两个 **Public** bucket：

- `podcasts` — 播客音频
- `reports` — 每日报告 PDF

为每个 bucket 配置策略（示例，按需在控制台调整）：

- **公开读**：`SELECT` 允许 `anon`
- **上传**：MVP 可允许 `anon` `INSERT`（与当前浏览器端上传一致）；生产建议改为 **仅 authenticated** 或通过 **Edge Function + service_role** 上传

若上传报权限错误，在 Storage → Policies 为对应 bucket 增加 `INSERT` 策略。

## 3. 环境变量

复制 `.env.local.example`，至少配置：

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`（与 `SUPABASE_KEY` 可用同一 anon key）
- `NEXT_PUBLIC_ADMIN_PASSWORD`（可选，默认 `atlas2024`；会打进前端包）

服务端 QDII 仍使用 `SUPABASE_URL` / `SUPABASE_KEY`。

## 4. 路由

| 路径        | 说明           |
|------------|----------------|
| `/notes`   | 市场笔记公开页  |
| `/podcast` | 播客公开页      |
| `/admin`   | 管理员发布后台  |

首页 `LandingSelector` 已指向上述 Next 路由；**WMP** 仍指向 Streamlit 深链。
