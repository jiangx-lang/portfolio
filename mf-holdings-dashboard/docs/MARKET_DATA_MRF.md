# 股票数据抓取 · MRF / QD Top10 · 深度分析（给 Cursor / 维护者）

## 数据管道

1. **`scripts/fetch_market_data.py`**（Python）  
   - 按后缀路由：`HK` → AkShare 估值 + yfinance；`CN` → AkShare A 股 + yfinance；`KR` → Naver `_per/_pbr` + yfinance；`US` → yfinance + 期权链。  
   - CLI：`py -3 scripts/fetch_market_data.py @holdings.json`（Windows 推荐 `@文件` 避免 PowerShell 拆参数）。  
   - 依赖：`scripts/requirements-market.txt`（`yfinance`、`pandas`、`akshare`）。

2. **Next API**  
   - `POST /api/market-data`：体 `{ holdings: [{ ticker, weight }] }` → 调 `fetchMarketDataViaPython`。  
   - `POST /api/holdings-analysis`：同上 + **Groq** 结构化摘要（`src/lib/fundDeepAnalysisGroq.ts`），prompt 中带每行 `market`、`data_source`、加权 PE/PB/IV。

3. **MRF 前端**  
   - `src/lib/holdingTickerMap.ts`：持仓名称 → Yahoo 代码；`isClickable()` 对 **美股 + 港/韩/A/日欧等带交易所后缀的标的** 为 true。  
   - `src/components/MrfPageInner.tsx`：Top Holdings 名称链到 `/stock/{ticker}`（`encodeURIComponent`）。  
   - `src/app/stock/[ticker]/page.tsx`：美股全功能；**`isGlobalEquityTicker`** 走简版 `GlobalEquityView`（mock 报价 + 走势图）；否则再试 QDII 净值页。

## 新增名称映射时

在 `HOLDING_TICKER_MAP` 增加 **PDF/数据库里的标准名** → **Yahoo 符号**（如 `0700.HK`、`000660.KS`、`300308.SZ`）。  
若仅用于展示链接，需后缀能被 `isGlobalEquityTicker` 识别（见 `src/lib/constants.ts` 中 `GLOBAL_EXCHANGE_SUFFIXES`）。

## 本地看阶段性结果

```bash
cd mf-holdings-dashboard
npm install
npm run dev
```

浏览器打开 `/mrf` 或 `/qd`，展开基金 → Top Holdings 点击标的；在「持仓深度分析」运行分析查看 PE/PB 与「数据源」列。
