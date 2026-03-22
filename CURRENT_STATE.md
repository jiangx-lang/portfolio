# CURRENT_STATE（项目现状快照）

> 生成时间：2026-03-18  
> 工作区：`d:\portoflio for mrf`  

## 0. 截图清单（待人工补充）

当前环境**无法自动打开本地浏览器并截图**（无法访问 `localhost` 进行点击与截图生成）。  
请你按下面清单手动截图后，把图片补充到本文档同目录（或发给 Claude/我），文件名建议用 `shot_01_streamlit_home.png` 这种顺序命名。

- Streamlit
  - `http://localhost:8501`（Streamlit 首页）
  - `http://localhost:8501` 点击“锦城轮动系统 QDII - 电脑”进入后截图
  - `http://localhost:8501` 点击“锦城轮动系统 - 电脑”进入后截图
- Next.js（注意：当前可用端口见第 9 节）
  - `http://localhost:3007`（Next.js 首页）
  - `http://localhost:3007/mrf`
  - `http://localhost:3007/qd`
  - `http://localhost:3007/stock/NVDA`

## 1. Streamlit 系统：配色与入口（`qdii_portfolio`）

### 1.1 `.streamlit/config.toml`

未找到 `qdii_portfolio/.streamlit/config.toml`（输出：`no config.toml`）。

### 1.2 `qdii_portfolio/app.py`（前 ~120 行）

```python
"""
app.py  —  锦城轮动系统 QDII · JinCity Rotation Engine
"""

import streamlit as st
import sys
from pathlib import Path

st.set_page_config(
    page_title="锦城轮动 QDII · JinCity",
    page_icon="🎯",
    layout="wide",
    initial_sidebar_state="expanded",
)

try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).parent / ".env")
except ImportError:
    pass

ROOT = Path(__file__).resolve().parent
DB_PATH = ROOT / "fund_tagging.db"
if "--db" in sys.argv:
    idx = sys.argv.index("--db")
    if idx + 1 < len(sys.argv):
        DB_PATH = Path(sys.argv[idx + 1])

sys.path.insert(0, str(ROOT))
if str(ROOT.parent) not in sys.path:
    sys.path.insert(0, str(ROOT.parent))

import fund_tagging.db as ftdb
ftdb.configure(str(DB_PATH))
try:
    ftdb.init_schema()
except Exception:
    pass

# ── 设备选择逻辑（复用 MRF 模式）────────────────────────────────
def set_device(device_type: str):
    st.session_state["device"] = device_type
    st.rerun()

# URL 参数初始化（MRF 首页传入 ?device=mobile 或 ?device=desktop）
if "device" not in st.session_state:
    params = st.query_params
    if params.get("device") in ("mobile", "desktop"):
        st.session_state["device"] = params.get("device")
    else:
        st.session_state["device"] = "desktop"   # 默认电脑

is_mobile = st.session_state["device"] == "mobile"

# ── 页面路由 ──────────────────────────────────────────────────────
from pages import theme_search, portfolio_builder, nav_chart, miss_log, admin

PAGES = {
    "🔍  主题基金搜索": theme_search,
    "📐  组合构建器":   portfolio_builder,
    "📈  历史业绩曲线": nav_chart,
    "📋  未命中记录":   miss_log,
    "⚙️  管理后台":     admin,
}

MRF_URL  = st.secrets.get("MRF_APP_URL",  "http://43.161.234.75:8501") if hasattr(st, "secrets") else "http://43.161.234.75:8501"
QDII_URL = st.secrets.get("QDII_APP_URL", "http://43.161.234.75:8502") if hasattr(st, "secrets") else "http://43.161.234.75:8502"

# ── 侧栏 ─────────────────────────────────────────────────────────
with st.sidebar:
    # 系统入口
    st.markdown(f"""
<a href="{QDII_URL}" target="_self"
   style="display:block;padding:10px 14px;background:#185FA5;color:white;
          border-radius:8px;text-decoration:none;font-size:13px;font-weight:500;
          margin-bottom:6px;line-height:1.5">
  🎯 锦城轮动 QDII<br>
  <span style="font-size:11px;opacity:0.8;font-weight:400">JinCity Rotation Engine</span>
</a>
<a href="{MRF_URL}" target="_blank"
   style="display:block;padding:10px 14px;background:#0F6E56;color:white;
          border-radius:8px;text-decoration:none;font-size:13px;font-weight:500;
          margin-bottom:2px;line-height:1.5">
  📊 锦城轮动 MRF<br>
  <span style="font-size:11px;opacity:0.8;font-weight:400">JinCity Rotation Engine</span>
</a>
""", unsafe_allow_html=True)

    st.divider()

    # 设备切换
    st.markdown("<p style='font-size:11px;color:gray;margin:0 0 6px 0'>显示模式</p>",
                unsafe_allow_html=True)
    dev_col1, dev_col2 = st.columns(2)
    with dev_col1:
        st.button("📱 手机", key="sw_mobile",
                  type="primary" if is_mobile else "secondary",
                  on_click=set_device, args=("mobile",),
                  use_container_width=True)
    with dev_col2:
        st.button("💻 电脑", key="sw_desktop",
                  type="primary" if not is_mobile else "secondary",
                  on_click=set_device, args=("desktop",),
                  use_container_width=True)

    st.divider()

    st.markdown("<p style='font-size:11px;color:gray;margin:0 0 4px 0'>QDII 功能导航</p>",
                unsafe_allow_html=True)
    choice = st.radio("导航", list(PAGES.keys()), label_visibility="collapsed")

    st.divider()
    device_label = "📱 手机模式" if is_mobile else "💻 电脑模式"
    st.caption(f"{device_label}  ·  `{DB_PATH.name}`")

# ── 渲染（传入 is_mobile）────────────────────────────────────────
PAGES[choice].render(is_mobile=is_mobile)
```

### 1.3 “MRF 推荐算法 / Tab1/2/3 / 手续费 / benchmark / MODEL_TARGET” 关键字检索

对 `qdii_portfolio/app.py` 进行关键字检索（`精选|Tab1|Tab2|Tab3|手续费|fee_rate|benchmark|MODEL_TARGET`）结果为：**No matches found**。  
（这表示这些逻辑可能在 `qdii_portfolio/pages/*` 或其它模块中，而不在 `app.py` 顶部入口文件里。）

### 1.4 Benchmarks（`qdii_portfolio/data/benchmarks.py`）

```python
"""
data/benchmarks.py
渣打 Model Portfolio 三档基准配置
（用于组合构建器的偏差对比）

替换为你们真实的 CIO 数据即可，结构保持不变：
  key = 组合名称（对应 st.selectbox 选项）
  value = {tag_name: 目标得分/权重}
"""

BENCHMARKS: dict[str, dict[str, float]] = {

    "渣打保守型 Conservative": {
        "Bond":            50.0,
        "Low Vol":         40.0,
        "Income/Dividend": 15.0,
        "HALO":             5.0,
        "Quality":          8.0,
        "US":              30.0,
    },

    "渣打稳健型 Balanced": {
        "Bond":            35.0,
        "Equity":          50.0,
        "AI Hardware":      8.0,
        "AI Software":      6.0,
        "Technology":      15.0,
        "Asia":            12.0,
        "HALO":            10.0,
        "Income/Dividend":  8.0,
        "Quality":         12.0,
        "US":              25.0,
    },

    "渣打成长型 Growth": {
        "AI Hardware":     15.0,
        "AI Software":     12.0,
        "Technology":      22.0,
        "Semiconductor":   12.0,
        "China Internet":   8.0,
        "Asia":            15.0,
        "HALO":            12.0,
        "Mega Cap":        20.0,
        "US":              35.0,
    },

}
```

## 2. Next.js Dashboard：颜色/样式与整体结构（`mf-holdings-dashboard`）

### 2.1 Tailwind 颜色配置（`mf-holdings-dashboard/tailwind.config.ts`）

```ts
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: "#0a0e1a",
          card: "#111827",
        },
        gain: "#1D9E75",
        loss: "#D85A30",
        info: "#185FA5",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;
```

### 2.2 全局样式（`mf-holdings-dashboard/src/app/globals.css`）

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --background: #0a0e1a;
  --foreground: #f9fafb;
}

body {
  background: var(--background);
  color: var(--foreground);
}
```

### 2.3 Layout（`mf-holdings-dashboard/src/app/layout.tsx`）

```tsx
import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: process.env.NEXT_PUBLIC_APP_NAME || "MF Holdings Dashboard",
  description: "US tech holdings, options chain, and AI-powered insights",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="min-h-screen font-sans antialiased">{children}</body>
    </html>
  );
}
```

## 3. Next.js 页面入口代码快照

### 3.1 首页（`mf-holdings-dashboard/src/app/page.tsx`）

```tsx
import Link from "next/link";
import { HoldingsTable } from "@/components/HoldingsTable";
import { MetricCard } from "@/components/MetricCard";
import { SectorChart } from "@/components/SectorChart";
import { YtdBarChart } from "@/components/YtdBarChart";
import { PortfolioAIAnalysis } from "@/components/PortfolioAIAnalysis";
import { getPortfolioPositions } from "@/lib/publiccom";
import {
  MOCK_AUM,
  MOCK_CONCENTRATION,
  MOCK_AVG_PE,
  MOCK_PORTFOLIO_BETA,
} from "@/lib/mockData";
import { formatMoney } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function PortfolioDashboard() {
  const holdings = await getPortfolioPositions();

  return (
    <div className="min-h-screen bg-navy">
      <header className="border-b border-white/10 px-6 py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <h1 className="text-xl font-semibold text-white">
            MF Holdings Investment Dashboard
          </h1>
          <nav className="flex gap-4 text-sm">
            <Link href="/" className="text-info underline">
              Portfolio
            </Link>
            <Link href="/qd" className="text-white/70 hover:text-white">
              QD基金
            </Link>
            <Link href="/mrf" className="text-white/70 hover:text-white">
              MRF
            </Link>
            <Link href="/signals" className="text-white/70 hover:text-white">
              AI Signals
            </Link>
            <Link href="/risk" className="text-white/70 hover:text-white">
              Risk
            </Link>
          </nav>
        </div>
      </header>
      {/* ...略... */}
    </div>
  );
}
```

### 3.2 MRF 页面（`mf-holdings-dashboard/src/app/mrf/page.tsx`）

```tsx
"use client";

import dynamic from "next/dynamic";

const MrfPageInner = dynamic(
  () => import("@/components/MrfPageInner").then((m) => m.default),
  { ssr: false }
);

export default function MrfPage() {
  return <MrfPageInner />;
}
```

### 3.3 QD 页面（`mf-holdings-dashboard/src/app/qd/page.tsx`，前 ~80 行）

```tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { QdAISignalBox } from "@/components/QdAISignalBox";
import { getTickerFromHolding, isClickable } from "@/lib/holdingTickerMap";

interface QdFund {
  fund_id: number;
  fund_name_cn: string;
  primary_code: string;
  sc_product_code: string;
  code?: string;
  holdings_count: number;
  as_of_date: string | null;
  tags?: string[];
  holdings?: HoldingRow[];
  holdingsLoading?: boolean;
}
// ...略...
```

### 3.4 Stock 页面（`mf-holdings-dashboard/src/app/stock/[ticker]/page.tsx`，前 ~60 行）

```tsx
import Link from "next/link";
import { getQuote, getIVStats, getOptionsChain } from "@/lib/publiccom";
import { buildStrategyCards } from "@/lib/strategies";
import { notFound } from "next/navigation";
import { StockDetailClient } from "@/components/StockDetailClient";
import { QdiiFundView } from "@/components/QdiiFundView";
import { isUsStock } from "@/lib/constants";
import { getFundByCode, getNavHistory, isSupabaseConfigured } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export default async function StockDetailPage({ params }: { params: Promise<{ ticker: string }> }) {
  const { ticker } = await params;
  const tickerUpper = ticker.toUpperCase();

  if (isUsStock(tickerUpper)) {
    // ...美股详情页（期权/策略/AI）...
  }

  // ...QDII 基金详情页（Supabase NAV 曲线）...
}
```

### 3.5 `StockDetailClient`（`mf-holdings-dashboard/src/components/StockDetailClient.tsx`，前 ~80 行）

```tsx
"use client";

import { useMemo, useState } from "react";
import type { OptionsContract, StrategyCard, IVStats, AISignal } from "@/types";
import { IVGauge } from "./IVGauge";
import { OptionsChain } from "./OptionsChain";
import { StrategyCards } from "./StrategyCards";
import { PayoffDiagram } from "./PayoffDiagram";
import { AISignalBox } from "./AISignalBox";
import { OptionsAIBox } from "./OptionsAIBox";
import { StrategyComparePanel } from "./StrategyComparePanel";
import { getRecommendedStrategyId } from "@/lib/strategies";
import { MetricCard } from "./MetricCard";
import StockPriceChart from "./StockPriceChart";

// ...略...
```

## 4. Next.js 组件清单（`mf-holdings-dashboard/src/components`）

```txt
AISignalBox.tsx
HoldingsTable.tsx
IVGauge.tsx
MetricCard.tsx
MrfAISignalBox.tsx
MrfPageInner.tsx
NavChart.tsx
OptionsAIBox.tsx
OptionsChain.tsx
PayoffDiagram.tsx
PortfolioAIAnalysis.tsx
QdAISignalBox.tsx
QdiiFundView.tsx
SectorChart.tsx
StockDetailClient.tsx
StockPriceChart.tsx
StrategyCards.tsx
StrategyComparePanel.tsx
UpgradeBanner.tsx
YtdBarChart.tsx
```

## 5. Next.js App Router 目录（`mf-holdings-dashboard/src/app`）

```txt
api/
globals.css
layout.tsx
mrf/
page.tsx
qd/
risk/
signals/
stock/
```

## 6. 端口占用（Streamlit + Next.js）

下面是对 `netstat -ano -p tcp` 过滤端口（8501、3000-3009）的结果：

```txt
TCP    0.0.0.0:3000           0.0.0.0:0              LISTENING       39192
TCP    0.0.0.0:8501           0.0.0.0:0              LISTENING       10496
TCP    127.0.0.1:3000         127.0.0.1:65416        ESTABLISHED     39192
TCP    127.0.0.1:65416        127.0.0.1:3000         ESTABLISHED     24204
TCP    172.18.0.1:57174       43.161.234.75:8501     ESTABLISHED     24204
TCP    172.18.0.1:59468       43.161.234.75:8501     ESTABLISHED     24204
```

结论（按当前快照）：
- Streamlit：`8501` 在监听（PID `10496`）
- Next.js：`3000` 在监听（PID `39192`）

