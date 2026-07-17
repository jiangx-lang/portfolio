# ATLAS 设计系统规范（2026-07 视觉重构版）

本站为「ATLAS 全资产投研工作台」，深色主题（dark-only），面向中文高净值投资用户。
设计语言：**私行级暗夜 × 香槟金 × 艺术感**。所有页面/组件必须遵守本规范。

## 1. 色彩令牌（只用令牌，禁止新造十六进制）

Tailwind 类（首选）：
- 背景：`bg-navy`（#05070D 页面底）、`bg-navy-card`（#0C1120 卡片）、`bg-navy-elevated`（#111A2E 浮层）
- 品牌金：`text-gold` / `bg-gold`（#C9A84C）、`text-gold-light`（#E3C87A）、`text-gold-dark`（#9A7E2F）
- 信息蓝：`text-info`（#5B93F0）
- **涨跌（中国市场惯例：红涨绿跌）**：`text-rise`（#E85D50 上涨/正收益）、`text-fall`（#2FBF8F 下跌/负收益）、`text-flat`（持平）
- 文字：默认前景 #F4F6FB；次级 `text-slate-400`；弱化 `text-slate-500`

CSS 变量（写 CSS 时用）：`--background`、`--card`、`--card-elevated`、`--border`、`--border-hover`、`--gold`、`--gold-light`、`--rise`、`--fall`、`--info`、`--foreground`、`--foreground-muted`、`--foreground-subtle`。
旧别名 `--bg-card`、`--text-primary`、`--text-muted`、`--text-secondary`、`--border-subtle`、`--border-normal` 已在 globals.css 定义，可直接用，但新代码优先用上面的标准名。

## 2. 字体

- 页面大标题 / Hero / 章节标题：`font-display`（思源宋体，艺术感核心）。大标题可加 `text-gradient-gold` 或 `text-gradient`。
- 正文 / UI：`font-sans`（Inter + PingFang SC，默认）。
- 所有数字（净值、收益率、金额、日期）：`font-mono` 或 `.num`（JetBrains Mono，等宽表格数字）。
- 章节眉标（标题上方小字）：`<span className="eyebrow">MODEL PORTFOLIO</span>` —— 金色、大写字距。

## 3. 现成工具类（globals.css，直接用，不要重复造）

- 卡片：`.glass-card`（玻璃拟态、hover 上浮+金边）、`.glass-panel`（大面板）
- 描边光效：`.glow-border`（金蓝渐变 1px 描边，配合 rounded 容器）
- 渐变文字：`.text-gradient`、`.text-gradient-gold`
- 按钮：`.btn-primary`（蓝）、`.btn-gold`（金，主 CTA）、`.btn-ghost`（幽灵）
- 徽章：`.badge` + `.badge-gold` / `.badge-blue` / `.badge-green` / `.badge-red`
- 表格：外层 `.atlas-table-wrap`，table 用 `.atlas-table`（sticky 表头、金色行 hover 已内置）
- 分隔线：`<hr className="hairline-gold" />`
- 加载：`.skeleton`；入场：`.animate-in`
- 涨跌文字：`.text-rise` / `.text-fall` / `.text-flat`

## 4. 版式规则

- 卡片圆角 16px（`rounded-2xl`），按钮 12px（`rounded-xl`），徽章全圆角。
- 边框一律 1px 半透明：`border` + `border-white/[0.07]` 或 CSS `var(--border)`；hover 时过渡到金色 `rgba(201,168,76,0.3)`。
- 页面骨架：`max-w-7xl mx-auto px-4 sm:px-6 pt-20 pb-24`（顶部留 56px 导航高度 + 间距）。
- 页面标题区标准结构：
  ```tsx
  <header className="mb-8">
    <span className="eyebrow">QDII FUND POOL</span>
    <h1 className="font-display text-3xl sm:text-4xl font-bold mt-2">QDII 基金池</h1>
    <p className="text-sm text-slate-400 mt-2">一句优雅的副标题说明</p>
  </header>
  ```
- 阴影：卡片用 `shadow-card`（或 glass-card 自带）；强调用 `shadow-glow-gold`。
- 动画：入场 `animate-in` 或 framer-motion 轻量 fade/slide（duration ≤0.5s，ease-out）；hover 位移 ≤2px。**禁止花哨弹跳**。

## 5. 图标

- 用 `lucide-react`（已安装，旧版本——只用最常见图标名：TrendingUp, TrendingDown, Lock, Unlock, ArrowRight, ArrowLeft, ChevronDown, ChevronRight, Menu, X, Home, PieChart, Landmark, Wallet, FileText, Podcast, Shield, Radio, Sparkles, Crown, Gem, Search, Filter, Loader2, AlertTriangle, RefreshCw, ExternalLink, Play, Pause, Calendar, BarChart3, LineChart, Activity, Globe, BookOpen, Star, Eye, EyeOff, LogOut, Check, Info）。改完必须 tsc 验证图标名存在。
- **禁止在导航/按钮/标题里用 emoji**（📊🏦📝 等全部换成 lucide）。

## 6. 硬性约束

1. **只改表现层**：数据获取、状态逻辑、Supabase/API 调用、analytics 埋点、middleware、进度系统逻辑一律不动。
2. 保留文件顶部的 `'use client'` 指令（如有）。
3. 消灭内联 `style={{}}` 对象 → 改为 Tailwind 类或 globals.css 工具类（动态计算值除外，如进度条宽度）。
4. 不新增 npm 依赖；不改 tailwind.config.ts / globals.css / layout.tsx（父代理已定型）。
5. 完成后运行 `cd "D:/portoflio for mrf/mf-holdings-dashboard" && npx tsc --noEmit --incremental false` 确认零报错（基线可能有个别既有报错，只保证你改的文件不引入新错误）。
6. **不要运行 `next build` / `next dev`**（多代理并行会冲突，由父代理统一构建）。
7. 中文文案可以润色得更优雅（私行口吻），但专有名词、等级名（新成员/探索者/分析师/资深用户/Atlas 领航员）、功能名不变。
8. 页面页脚/角落不要加"由 AI 生成"之类多余元素。
