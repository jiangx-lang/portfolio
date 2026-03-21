'use client'

import { useEffect, useState } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine
} from 'recharts'

interface NavData {
  isin: string
  ccy: string
  dates: string[]
  navs: number[]
  metrics: {
    totalReturn: number
    oneYearReturn: number
    maxDrawdown: number
    high: number
    low: number
    latest: number
    dataPoints: number
  }
}

interface Props {
  isin: string
  fundCode: string
}

export default function NavChart({ isin, fundCode }: Props) {
  const [data, setData] = useState<NavData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [range, setRange] = useState<'1Y' | '3Y' | 'ALL'>('1Y')

  useEffect(() => {
    if (!isin) return
    setLoading(true)
    fetch(`/api/nav/${isin}`)
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false) })
      .catch(() => { setError('Failed to load NAV data'); setLoading(false) })
  }, [isin])

  if (loading) return (
    <div style={{ background: '#111827', borderRadius: 12, padding: '2rem', textAlign: 'center', color: '#9CA3AF' }}>
      Loading NAV history...
    </div>
  )

  if (error || !data) return (
    <div style={{ background: '#111827', borderRadius: 12, padding: '2rem', textAlign: 'center', color: '#D85A30' }}>
      {error || 'No NAV data available'}
    </div>
  )

  // Filter by range
  const totalPoints = data.dates.length
  const rangeMap = { '1Y': 252, '3Y': 756, 'ALL': totalPoints }
  const sliceFrom = Math.max(0, totalPoints - rangeMap[range])
  const chartDates = data.dates.slice(sliceFrom)
  const chartNavs = data.navs.slice(sliceFrom)

  const chartData = chartDates.map((date, i) => ({
    date: date.slice(0, 10),
    nav: chartNavs[i],
  }))

  const isPositive = data.metrics.oneYearReturn >= 0

  return (
    <div style={{ background: '#111827', borderRadius: 12, padding: '1.5rem' }}>
      {/* Header metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: '1.25rem' }}>
        {[
          { label: 'Latest NAV', value: `${data.ccy} ${data.metrics.latest.toFixed(4)}` },
          { label: '1Y Return', value: `${data.metrics.oneYearReturn >= 0 ? '+' : ''}${data.metrics.oneYearReturn}%`, color: isPositive ? '#1D9E75' : '#D85A30' },
          { label: 'Max Drawdown', value: `-${data.metrics.maxDrawdown}%`, color: '#D85A30' },
          { label: '52W Range', value: `${data.metrics.low.toFixed(2)} – ${data.metrics.high.toFixed(2)}` },
        ].map((m) => (
          <div key={m.label} style={{ background: '#1F2937', borderRadius: 8, padding: '0.75rem 1rem' }}>
            <div style={{ fontSize: 10, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{m.label}</div>
            <div style={{ fontSize: 18, fontWeight: 500, color: m.color ?? '#F9FAFB' }}>{m.value}</div>
          </div>
        ))}
      </div>

      {/* Range selector */}
      <div style={{ display: 'flex', gap: 6, marginBottom: '1rem' }}>
        {(['1Y', '3Y', 'ALL'] as const).map((r) => (
          <button
            key={r}
            onClick={() => setRange(r)}
            style={{
              padding: '4px 12px', borderRadius: 6, fontSize: 12, cursor: 'pointer',
              border: range === r ? '1px solid #185FA5' : '1px solid rgba(255,255,255,0.1)',
              background: range === r ? '#185FA522' : 'transparent',
              color: range === r ? '#60A5FA' : '#9CA3AF',
            }}
          >
            {r}
          </button>
        ))}
        <span style={{ marginLeft: 'auto', fontSize: 11, color: '#6B7280', alignSelf: 'center' }}>
          {data.metrics.dataPoints} data points · source: {data.ccy}
        </span>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={chartData} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: '#6B7280' }}
            tickFormatter={(v) => v.slice(0, 7)}
            interval={Math.floor(chartData.length / 6)}
          />
          <YAxis
            tick={{ fontSize: 10, fill: '#6B7280' }}
            tickFormatter={(v) => v.toFixed(2)}
            width={55}
          />
          <Tooltip
            contentStyle={{ background: '#1F2937', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }}
            labelStyle={{ color: '#9CA3AF' }}
            formatter={(v: number) => [`${data.ccy} ${v.toFixed(4)}`, 'NAV']}
          />
          <ReferenceLine
            y={chartNavs[0]}
            stroke="rgba(255,255,255,0.15)"
            strokeDasharray="4 4"
          />
          <Line
            type="monotone"
            dataKey="nav"
            stroke={isPositive ? '#1D9E75' : '#D85A30'}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: isPositive ? '#1D9E75' : '#D85A30' }}
          />
        </LineChart>
      </ResponsiveContainer>

      <div style={{ marginTop: '0.75rem', fontSize: 11, color: '#4B5563', textAlign: 'center' }}>
        ISIN: {isin} · {fundCode} · Data from Supabase nav_history
      </div>
    </div>
  )
}
