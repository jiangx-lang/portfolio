import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(
  _req: Request,
  { params }: { params: { isin: string } }
) {
  const { isin } = params

  try {
    const { data, error } = await supabase
      .from('nav_history')
      .select('nav_date, nav, ccy, source')
      .eq('isin', isin)
      .order('nav_date', { ascending: true })
      .limit(756) // ~3 years of trading days

    if (error || !data) {
      return NextResponse.json({ error: 'No data found', isin }, { status: 404 })
    }

    const dates = data.map((r) => r.nav_date)
    const navs = data.map((r) => r.nav)
    const ccy = data[0]?.ccy ?? 'USD'
    const source = data[0]?.source ?? 'unknown'

    // Calculate performance metrics
    const first = navs[0] ?? 1
    const last = navs[navs.length - 1] ?? 1
    const totalReturn = parseFloat((((last - first) / first) * 100).toFixed(2))
    const high = Math.max(...navs)
    const low = Math.min(...navs)

    // 1-year return
    const oneYearIdx = navs.length > 252 ? navs.length - 252 : 0
    const oneYearReturn = parseFloat(
      (((last - navs[oneYearIdx]) / navs[oneYearIdx]) * 100).toFixed(2)
    )

    // Max drawdown
    let maxDrawdown = 0
    let peak = navs[0]
    for (const nav of navs) {
      if (nav > peak) peak = nav
      const dd = (peak - nav) / peak
      if (dd > maxDrawdown) maxDrawdown = dd
    }

    return NextResponse.json({
      isin,
      ccy,
      source,
      dates,
      navs,
      metrics: {
        totalReturn,
        oneYearReturn,
        maxDrawdown: parseFloat((maxDrawdown * 100).toFixed(2)),
        high,
        low,
        latest: last,
        dataPoints: dates.length,
      },
    })
  } catch (err) {
    console.error('NAV API error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
