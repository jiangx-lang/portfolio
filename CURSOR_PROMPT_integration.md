# 整合任务：把以下4个文件复制到对应位置，然后做3处修改

## 第一步：复制新文件（直接替换/新建）

### 1. src/lib/supabase.ts（新建）
import { createClient } from '@supabase/supabase-js'
const supabaseUrl = process.env.SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_KEY!
export const supabase = createClient(supabaseUrl, supabaseKey)

### 2. src/app/api/holdings/route.ts（替换现有文件）
用 integration/src/app/api/holdings/route.ts 的内容完整替换

### 3. src/app/api/nav/[isin]/route.ts（新建目录+文件）
用 integration/src/app/api/nav/[isin]/route.ts 的内容

### 4. src/components/NavChart.tsx（新建）
用 integration/src/components/NavChart.tsx 的内容

## 第二步：修改 src/app/stock/[ticker]/page.tsx

在文件顶部加入判断逻辑：
const US_TICKERS = ['NVDA','MSFT','AAPL','GOOGL','META','AVGO','AMZN','TSLA','AMAT','CRM']
const isUSStock = US_TICKERS.includes(ticker.toUpperCase())
const isQDII = !isUSStock

在 JSX 中：
- 如果 isQDII：隐藏 OptionsChain 和 StrategyCards，显示 <NavChart isin={holding.isin} fundCode={ticker} />
- 如果 isUSStock：保持原有期权链和策略卡不变

在文件顶部 import NavChart：
import NavChart from '@/components/NavChart'

## 第三步：修改 src/types/index.ts

在 Holding interface 末尾加入可选字段：
isin?: string
ccy?: string
isQDII?: boolean

## 第四步：安装依赖

在 mf-holdings-dashboard 目录运行：
npm install @supabase/supabase-js

## 第五步：更新 .env.local

确认 .env.local 包含：
SUPABASE_URL=https://wpsiqvbhxhzrynfhbwno.supabase.co
SUPABASE_KEY=（你的key）
NEXT_PUBLIC_SHOW_QDII=true

## 验证

运行 npm run dev 后：
1. http://localhost:3000 → Holdings 表应显示真实 QD 基金数据（或 fallback mock）
2. 点击任意美股（NVDA等）→ 显示期权链 + 策略卡
3. 点击任意 QDII 基金 → 显示历史净值曲线 + metrics

## 注意
- holdings/route.ts 有完整 fallback：Supabase 连不上时自动用 mock 美股数据
- NavChart 支持 1Y / 3Y / ALL 切换
- 所有 Supabase key 只在 server-side API routes 使用，不暴露客户端
