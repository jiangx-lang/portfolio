# MF Holdings Investment Dashboard — Groq Free Tier

Professional investment dashboard: US tech top 10 holdings, options chain, and AI-powered insights. **AI layer: Groq API (free)** — same interface for easy upgrade to Claude later.

## Tech Stack

- **Frontend**: Next.js 14, TypeScript, Tailwind CSS
- **Charts**: Recharts, Chart.js
- **AI**: Groq API (`llama-3.3-70b-versatile`) — FREE at [console.groq.com](https://console.groq.com)
- **Data**: Mock (same schema for easy swap); optional Yahoo Finance or Public.com in API routes
- **State**: Zustand (when needed)
- **Design**: Dark navy `#0a0e1a`, card `#111827`, gain/loss/info as spec

## Quick Start

```bash
cd mf-holdings-dashboard
npm install
cp .env.local.example .env.local
# Add GROQ_API_KEY=your_key_here  (free at console.groq.com)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Works with mock data without keys; add `GROQ_API_KEY` for AI analysis.

## Core Pages

| Route | Description |
|-------|-------------|
| `/` | Portfolio: Top 10 table, AUM/concentration/avg P/E/beta, sector donut, YTD bar |
| `/stock/[ticker]` | Price, IV gauge, options chain (ATM blue, ITM green), 6 strategy cards, payoff diagram, Groq AI signal |
| `/signals` | AI signals (macro + per-stock) — placeholder |
| `/risk` | Risk metrics + stress tests — placeholder |
| `/mrf` | MRF 基金池（Supabase mrf_funds），与 Streamlit 优化器同源 |

## API Routes

- `GET /api/holdings` — Top 10 (mock; same schema for Public.com swap)
- `GET /api/quote/[ticker]` — Yahoo Finance quote (price, change, PE, 52w, beta…)
- `GET /api/options/[ticker]?expiry=YYYY-MM-DD` — Options chain (mock greeks from Black-Scholes)
- `POST /api/analyze` — **Groq** AI: `{ ticker, context, analysisType }` → JSON (signal, thesis, keyRisks, optionsStrategy)
- `GET /api/iv/[ticker]` — IV 30d, IV Rank, IV Percentile (Yahoo or mock)
- `GET /api/mrf/funds` — MRF 基金池（Supabase mrf_funds 表）

## Environment Variables

| Key | Purpose |
|-----|---------|
| `GROQ_API_KEY` | Free at console.groq.com — required for /api/analyze |
| `NEXT_PUBLIC_APP_NAME` | App title |
| `ANTHROPIC_API_KEY` | (Optional) Upgrade: swap in claude.ts and /api/analyze |
| `PUBLICCOM_API_KEY` | (Optional) Live holdings/options later |

## File Structure

```
src/
  app/
    page.tsx
    stock/[ticker]/page.tsx
    signals/page.tsx
    risk/page.tsx
    api/
      analyze/route.ts    ← Groq
      holdings/route.ts
      quote/[ticker]/route.ts
      iv/[ticker]/route.ts
      options/[ticker]/route.ts
  components/
    HoldingsTable.tsx, MetricCard.tsx, SectorChart.tsx, YtdBarChart.tsx
    OptionsChain.tsx, StrategyCards.tsx, PayoffDiagram.tsx
    IVGauge.tsx, AISignalBox.tsx, UpgradeBanner.tsx, StockDetailClient.tsx
  lib/
    groq.ts
    claude.ts             ← stub for upgrade
    yahoo.ts              ← quote + IV with 60s cache, 500ms delay
    mockData.ts
    optionsMock.ts
    blackScholes.ts
    strategies.ts
  types/
    index.ts
```

## Strategy Logic (IV Rank)

- **IV Rank < 30**: recommend debit (LEAP call, bull call spread)
- **IV Rank 30–50**: neutral (iron condors, diagonals)
- **IV Rank > 50**: recommend credit (cash-secured put, covered call)

Strategy cards show max profit, max loss, breakeven, probability of profit; recommended badge by IV Rank.

## Upgrade to Claude

1. `npm install @anthropic-ai/sdk` (already in package.json)
2. In `/api/analyze/route.ts`: use `analyzeWithClaude` from `@/lib/claude` when `ANTHROPIC_API_KEY` is set
3. Set `ANTHROPIC_API_KEY` in `.env.local`
4. Groq and Claude share the same response schema; migration = swap client + model name

## Notes

- Quote/IV: mock from `mockData` with 60s cache. To use Yahoo Finance, add `yahoo-finance2` and call it inside API routes only (avoid importing in shared lib to prevent bundling issues).
- Black-Scholes: approximation only — disclaimer in UI; not for trading.
- All API keys server-side only. Footer: "Powered by Groq".
