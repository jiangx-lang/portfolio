'use client'

import { useEffect, useState } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts'

interface MrfFund {
  fund_name: string
  brand: string
  equity_pct: number
  fixed_income_pct: number
  cash_pct: number
  fee_rate: number
}

const BRAND_COLORS: Record<string, string> = {
  Amundi:       '#185FA5',
  BEA:          '#1D9E75',
  ValuePartners:'#534AB7',
  JPM:          '#BA7517',
  Pictet:       '#D85A30',
  BOC:          '#639922',
  Schroders:    '#888780',
}

const ALLOC_COLORS = ['#185FA5', '#1D9E75', '#BA7517']

type FilterType = 'ALL' | 'equity' | 'balanced' | 'fixed'

function getRiskLabel(equity: number): { label: string; color: string } {
  if (equity >= 80) return { label: '进取型', color: '#D85A30' }
  if (equity >= 40) return { label: '均衡型', color: '#BA7517' }
  return { label: '稳健型', color: '#1D9E75' }
}

export default function MrfPage() {
  const [funds, setFunds] = useState<MrfFund[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FilterType>('ALL')
  const [selectedBrand, setSelectedBrand] = useState<string>('ALL')
  const [selected, setSelected] = useState<MrfFund | null>(null)

  useEffect(() => {
    fetch('/api/mrf/funds')
      .then(r => r.json())
      .then(d => { setFunds(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const brands = ['ALL', ...Array.from(new Set(funds.map(f => f.brand)))]

  const filtered = funds.filter(f => {
    const brandOk = selectedBrand === 'ALL' || f.brand === selectedBrand
    const typeOk =
      filter === 'ALL' ? true :
      filter === 'equity' ? f.equity_pct >= 80 :
      filter === 'balanced' ? f.equity_pct >= 30 && f.equity_pct < 80 :
      f.equity_pct < 30
    return brandOk && typeOk
  })

  // Brand distribution for pie
  const brandData = Object.entries(
    funds.reduce((acc, f) => { acc[f.brand] = (acc[f.brand] || 0) + 1; return acc }, {} as Record<string, number>)
  ).map(([name, value]) => ({ name, value }))

  // Avg allocation
  const avgAlloc = filtered.length ? {
    equity: Math.round(filtered.reduce((s, f) => s + f.equity_pct, 0) / filtered.length),
    fixed: Math.round(filtered.reduce((s, f) => s + f.fixed_income_pct, 0) / filtered.length),
    cash: Math.round(filtered.reduce((s, f) => s + f.cash_pct, 0) / filtered.length),
  } : { equity: 0, fixed: 0, cash: 0 }

  const s: Record<string, React.CSSProperties> = {
    page:    { padding: '1.5rem', fontFamily: 'var(--font-sans, Inter, sans-serif)', color: '#F9FAFB', minHeight: '100vh' },
    grid4:   { display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 10, marginBottom: '1.25rem' },
    metric:  { background: '#1F2937', borderRadius: 8, padding: '0.75rem 1rem' },
    mlabel:  { fontSize: 10, color: '#9CA3AF', textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginBottom: 4 },
    mval:    { fontSize: 20, fontWeight: 500 },
    card:    { background: '#111827', border: '0.5px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '1rem 1.25rem' },
    stitle:  { fontSize: 11, fontWeight: 500, color: '#9CA3AF', textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 10 },
    row:     { display: 'flex', gap: 8, marginBottom: '1rem', flexWrap: 'wrap' as const },
    tab:     { padding: '5px 12px', borderRadius: 6, fontSize: 12, cursor: 'pointer', border: '0.5px solid transparent', color: '#9CA3AF', background: 'transparent' },
    tabA:    { padding: '5px 12px', borderRadius: 6, fontSize: 12, cursor: 'pointer', border: '0.5px solid #185FA5', color: '#60A5FA', background: '#185FA522' },
    table:   { width: '100%', borderCollapse: 'collapse' as const, fontSize: 13 },
    th:      { padding: '8px 12px', textAlign: 'left' as const, fontSize: 10, fontWeight: 500, color: '#9CA3AF', textTransform: 'uppercase' as const, letterSpacing: '0.04em', borderBottom: '0.5px solid rgba(255,255,255,0.08)', background: '#1F2937' },
    thr:     { padding: '8px 12px', textAlign: 'right' as const, fontSize: 10, fontWeight: 500, color: '#9CA3AF', textTransform: 'uppercase' as const, letterSpacing: '0.04em', borderBottom: '0.5px solid rgba(255,255,255,0.08)', background: '#1F2937' },
    td:      { padding: '10px 12px', color: '#F9FAFB', borderBottom: '0.5px solid rgba(255,255,255,0.05)', cursor: 'pointer' },
    tdr:     { padding: '10px 12px', color: '#F9FAFB', borderBottom: '0.5px solid rgba(255,255,255,0.05)', textAlign: 'right' as const, fontVariantNumeric: 'tabular-nums', cursor: 'pointer' },
  }

  if (loading) return <div style={{ ...s.page, textAlign: 'center', paddingTop: '4rem', color: '#9CA3AF' }}>Loading MRF funds...</div>

  return (
    <div style={s.page}>

      {/* Metric cards */}
      <div style={s.grid4}>
        {[
          { label: 'MRF 基金池', value: `${funds.length} 只` },
          { label: '平均费率', value: `${(funds.reduce((s,f)=>s+f.fee_rate,0)/Math.max(funds.length,1)).toFixed(2)}%` },
          { label: '筛选结果', value: `${filtered.length} 只` },
          { label: '平均股票比', value: `${avgAlloc.equity}%`, color: avgAlloc.equity >= 70 ? '#D85A30' : avgAlloc.equity >= 40 ? '#BA7517' : '#1D9E75' },
        ].map(m => (
          <div key={m.label} style={s.metric}>
            <div style={s.mlabel}>{m.label}</div>
            <div style={{ ...s.mval, color: m.color ?? '#F9FAFB' }}>{m.value}</div>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: '1.25rem' }}>
        <div style={s.card}>
          <div style={s.stitle}>按品牌分布</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
            {brandData.map(b => (
              <span key={b.name} style={{ display:'flex', alignItems:'center', gap:4, fontSize:11, color:'#9CA3AF' }}>
                <span style={{ width:8, height:8, borderRadius:2, background: BRAND_COLORS[b.name] ?? '#888' }}></span>
                {b.name} {b.value}只
              </span>
            ))}
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={brandData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} innerRadius={40}>
                {brandData.map(b => <Cell key={b.name} fill={BRAND_COLORS[b.name] ?? '#888'} />)}
              </Pie>
              <Tooltip contentStyle={{ background:'#1F2937', border:'1px solid rgba(255,255,255,0.1)', borderRadius:8, fontSize:12 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div style={s.card}>
          <div style={s.stitle}>资产配置对比（当前筛选）</div>
          <div style={{ display:'flex', gap:12, marginBottom:8 }}>
            {[['股票', avgAlloc.equity, '#185FA5'], ['固定收益', avgAlloc.fixed, '#1D9E75'], ['现金', avgAlloc.cash, '#BA7517']].map(([l,v,c]) => (
              <div key={l as string} style={{ textAlign:'center' }}>
                <div style={{ fontSize:18, fontWeight:500, color: c as string }}>{v}%</div>
                <div style={{ fontSize:10, color:'#9CA3AF' }}>{l}</div>
              </div>
            ))}
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={filtered.slice(0,8).map(f=>({ name: f.fund_name.slice(0,8), 股票: f.equity_pct, 固定收益: f.fixed_income_pct, 现金: f.cash_pct }))} margin={{ top:0, right:0, bottom:0, left:-20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="name" tick={{ fontSize:9, fill:'#6B7280' }} />
              <YAxis tick={{ fontSize:9, fill:'#6B7280' }} />
              <Tooltip contentStyle={{ background:'#1F2937', border:'none', borderRadius:8, fontSize:11 }} />
              <Bar dataKey="股票" stackId="a" fill="#185FA5" />
              <Bar dataKey="固定收益" stackId="a" fill="#1D9E75" />
              <Bar dataKey="现金" stackId="a" fill="#BA7517" radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Filters */}
      <div style={s.row}>
        <span style={{ fontSize:11, color:'#6B7280', alignSelf:'center' }}>风险类型：</span>
        {([['ALL','全部'],['equity','进取型 ≥80%'],['balanced','均衡型 30-80%'],['fixed','稳健型 <30%']] as const).map(([v,l]) => (
          <button key={v} onClick={()=>setFilter(v as FilterType)} style={filter===v ? s.tabA : s.tab}>{l}</button>
        ))}
        <span style={{ fontSize:11, color:'#6B7280', alignSelf:'center', marginLeft:12 }}>品牌：</span>
        {brands.map(b => (
          <button key={b} onClick={()=>setSelectedBrand(b)} style={selectedBrand===b ? s.tabA : s.tab}>{b}</button>
        ))}
      </div>

      {/* Table */}
      <div style={s.card}>
        <table style={s.table}>
          <thead>
            <tr>
              <th style={s.th}>基金名称</th>
              <th style={s.th}>品牌</th>
              <th style={s.thr}>股票%</th>
              <th style={s.thr}>固定收益%</th>
              <th style={s.thr}>现金%</th>
              <th style={s.thr}>申购费率</th>
              <th style={s.thr}>风险类型</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(f => {
              const risk = getRiskLabel(f.equity_pct)
              const isSelected = selected?.fund_name === f.fund_name
              return (
                <tr key={f.fund_name} onClick={()=>setSelected(isSelected ? null : f)}
                  style={{ background: isSelected ? 'rgba(24,95,165,0.12)' : 'transparent' }}>
                  <td style={s.td}>
                    <div style={{ fontWeight:500, fontSize:13 }}>{f.fund_name}</div>
                  </td>
                  <td style={s.td}>
                    <span style={{ display:'inline-block', padding:'2px 8px', borderRadius:4, fontSize:11,
                      background: (BRAND_COLORS[f.brand] ?? '#888') + '22',
                      color: BRAND_COLORS[f.brand] ?? '#9CA3AF' }}>
                      {f.brand}
                    </span>
                  </td>
                  <td style={s.tdr}>{f.equity_pct}%</td>
                  <td style={s.tdr}>{f.fixed_income_pct}%</td>
                  <td style={s.tdr}>{f.cash_pct}%</td>
                  <td style={s.tdr} style={{ ...s.tdr, color: f.fee_rate >= 3 ? '#D85A30' : f.fee_rate >= 2 ? '#BA7517' : '#1D9E75' }}>
                    {f.fee_rate.toFixed(1)}%
                  </td>
                  <td style={s.tdr}>
                    <span style={{ display:'inline-block', padding:'2px 8px', borderRadius:4, fontSize:11,
                      background: risk.color + '22', color: risk.color }}>
                      {risk.label}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {/* Selected fund detail */}
        {selected && (
          <div style={{ marginTop:'1rem', padding:'1rem', background:'#1F2937', borderRadius:8, borderLeft:`2px solid ${BRAND_COLORS[selected.brand] ?? '#888'}` }}>
            <div style={{ fontSize:12, fontWeight:500, color:'#F9FAFB', marginBottom:8 }}>{selected.fund_name}</div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8 }}>
              {[
                ['配置', `股票${selected.equity_pct}% / 债${selected.fixed_income_pct}% / 现金${selected.cash_pct}%`],
                ['申购费率', `${selected.fee_rate.toFixed(1)}%`],
                ['风险等级', getRiskLabel(selected.equity_pct).label],
              ].map(([k,v]) => (
                <div key={k}>
                  <div style={{ fontSize:10, color:'#6B7280', marginBottom:2 }}>{k}</div>
                  <div style={{ fontSize:13, color:'#F9FAFB' }}>{v}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div style={{ marginTop:'1rem', fontSize:11, color:'#4B5563', textAlign:'center' }}>
        数据来源：Supabase mrf_funds · Powered by Groq AI
      </div>
    </div>
  )
}
