import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// Fallback mock for when Supabase is unavailable
const MOCK_HOLDINGS = [
  { ticker: 'NVDA', name: 'NVIDIA Corporation', sector: 'Technology', weight: 12.4, price: 183.67, change: 0.45, changePercent: 0.25, pe: 45.2, ytd: 38.1, beta: 1.62, high52: 212.19, low52: 86.62, sharpe: 1.82, marketCap: 4380000000000, signal: 'strong_buy', thesis: 'AI infrastructure leader, Blackwell demand surge' },
  { ticker: 'MSFT', name: 'Microsoft Corporation', sector: 'Technology', weight: 10.8, price: 412.55, change: 0.7, changePercent: 0.17, pe: 34.1, ytd: 14.3, beta: 0.91, high52: 441.3, low52: 344.0, sharpe: 1.31, marketCap: 3060000000000, signal: 'buy', thesis: 'Azure + Copilot monetization accelerating' },
  { ticker: 'AAPL', name: 'Apple Inc.', sector: 'Technology', weight: 10.1, price: 218.44, change: -0.4, changePercent: -0.18, pe: 29.3, ytd: 8.2, beta: 1.18, high52: 237.2, low52: 164.1, sharpe: 1.14, marketCap: 3320000000000, signal: 'hold', thesis: 'Services growth offsetting hardware cycle' },
  { ticker: 'GOOGL', name: 'Alphabet Inc.', sector: 'Communication Services', weight: 8.6, price: 175.80, change: 1.2, changePercent: 0.69, pe: 23.4, ytd: 19.7, beta: 1.05, high52: 191.8, low52: 130.7, sharpe: 1.28, marketCap: 2160000000000, signal: 'buy', thesis: 'Gemini AI + Search monetization intact' },
  { ticker: 'META', name: 'Meta Platforms', sector: 'Communication Services', weight: 7.9, price: 523.12, change: 2.1, changePercent: 0.40, pe: 26.7, ytd: 31.4, beta: 1.31, high52: 589.0, low52: 370.1, sharpe: 1.51, marketCap: 1320000000000, signal: 'buy', thesis: 'Ad revenue rebound + AI Llama advantage' },
  { ticker: 'AVGO', name: 'Broadcom Inc.', sector: 'Technology', weight: 5.5, price: 172.50, change: 1.05, changePercent: 0.61, pe: 48.2, ytd: 38.2, beta: 1.24, high52: 198.0, low52: 118.0, sharpe: 1.44, marketCap: 810000000000, signal: 'buy', thesis: 'Custom AI chip + VMware integration' },
  { ticker: 'AMZN', name: 'Amazon.com Inc.', sector: 'Consumer Cyclical', weight: 5.0, price: 198.20, change: -1.05, changePercent: -0.53, pe: 78.2, ytd: 24.6, beta: 1.14, high52: 224.0, low52: 151.6, sharpe: 1.25, marketCap: 2090000000000, signal: 'buy', thesis: 'AWS margin expansion + AI services' },
  { ticker: 'TSLA', name: 'Tesla Inc.', sector: 'Consumer Cyclical', weight: 4.2, price: 248.50, change: 2.1, changePercent: 0.85, pe: 72.1, ytd: -18.2, beta: 2.01, high52: 479.9, low52: 138.8, sharpe: 0.48, marketCap: 797000000000, signal: 'hold', thesis: 'Robotaxi optionality vs margin pressure' },
  { ticker: 'AMAT', name: 'Applied Materials', sector: 'Technology', weight: 3.8, price: 248.00, change: 1.02, changePercent: 0.41, pe: 28.4, ytd: 55.2, beta: 1.43, high52: 265.8, low52: 142.3, sharpe: 0.91, marketCap: 208000000000, signal: 'buy', thesis: 'Semi equipment cycle recovery' },
  { ticker: 'CRM', name: 'Salesforce Inc.', sector: 'Technology', weight: 3.4, price: 268.00, change: -0.45, changePercent: -0.17, pe: 42.0, ytd: 12.4, beta: 1.09, high52: 369.0, low52: 212.0, sharpe: 0.97, marketCap: 258000000000, signal: 'hold', thesis: 'Agentforce AI product gaining traction' },
]

export async function GET() {
  try {
    // 1. Get fund list from Supabase
    const { data: fundList, error: fundError } = await supabase
      .from('fund_list')
      .select('code, isin, ccy, nav_source, yahoo_symbol')

    if (fundError || !fundList || fundList.length === 0) {
      console.log('Supabase fund_list unavailable, using mock data')
      return NextResponse.json(MOCK_HOLDINGS)
    }

    // 2. Get latest NAV for each fund
    const { data: latestNavs, error: navError } = await supabase
      .from('nav_history')
      .select('isin, ccy, nav_date, nav')
      .order('nav_date', { ascending: false })

    if (navError || !latestNavs) {
      console.log('Supabase nav_history unavailable, using mock data')
      return NextResponse.json(MOCK_HOLDINGS)
    }

    // 3. Get fund tags
    const { data: tagMap } = await supabase
      .from('fund_tag_map')
      .select('fund_code, tag, score')
      .order('score', { ascending: false })

    // 4. Build latest NAV map (most recent per isin+ccy)
    const navMap: Record<string, { nav: number; nav_date: string }[]> = {}
    for (const row of latestNavs) {
      const key = `${row.isin}_${row.ccy}`
      if (!navMap[key]) navMap[key] = []
      navMap[key].push({ nav: row.nav, nav_date: row.nav_date })
    }

    // 5. Build tag map (top tag per fund)
    const topTagMap: Record<string, string> = {}
    if (tagMap) {
      for (const row of tagMap) {
        if (!topTagMap[row.fund_code]) {
          topTagMap[row.fund_code] = row.tag
        }
      }
    }

    // 6. Calculate holdings
    const equalWeight = parseFloat((100 / fundList.length).toFixed(1))
    const oneYearAgo = new Date()
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)

    const holdings = fundList.map((fund) => {
      const key = `${fund.isin}_${fund.ccy}`
      const navHistory = navMap[key] || []
      const sorted = navHistory.sort((a, b) =>
        b.nav_date.localeCompare(a.nav_date)
      )

      const latestNav = sorted[0]?.nav ?? 1
      const prevNav = sorted[1]?.nav ?? latestNav
      const yearAgoNav = sorted.find(
        (n) => n.nav_date <= oneYearAgo.toISOString().split('T')[0]
      )?.nav ?? latestNav

      const high52 = Math.max(...sorted.slice(0, 252).map((n) => n.nav), latestNav)
      const low52 = Math.min(...sorted.slice(0, 252).map((n) => n.nav), latestNav)
      const ytd = yearAgoNav > 0
        ? parseFloat((((latestNav - yearAgoNav) / yearAgoNav) * 100).toFixed(2))
        : 0
      const change = parseFloat((latestNav - prevNav).toFixed(4))
      const changePercent = prevNav > 0
        ? parseFloat((((latestNav - prevNav) / prevNav) * 100).toFixed(2))
        : 0

      return {
        ticker: fund.code,
        name: `${fund.code} (${fund.ccy})`,
        sector: topTagMap[fund.code] ?? 'QDII',
        weight: equalWeight,
        price: latestNav,
        change,
        changePercent,
        pe: 0,
        ytd,
        beta: 1.0,
        high52,
        low52,
        sharpe: 0,
        marketCap: 0,
        signal: ytd >= 10 ? 'buy' : ytd <= -10 ? 'trim' : 'hold',
        thesis: `${fund.code} QDII Fund — ${fund.ccy} | Source: ${fund.nav_source ?? 'FT/Yahoo'}`,
        isin: fund.isin,
        ccy: fund.ccy,
        isQDII: true,
      }
    })

    return NextResponse.json(holdings)
  } catch (err) {
    console.error('Holdings API error:', err)
    return NextResponse.json(MOCK_HOLDINGS)
  }
}
