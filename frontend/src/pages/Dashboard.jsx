import { useEffect, useState } from 'react'
import { getStats, getHeatmap } from '../utils/api'
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from 'recharts'

// ── Reusable components ────────────────────────────────────────────────────
function StatCard({ label, value, sub, icon, color = 'var(--accent)' }) {
  return (
    <div style={{
      background: 'var(--card)', border: '1px solid var(--border)',
      borderRadius: 12, padding: '20px 24px',
      borderTop: `3px solid ${color}`,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: 1,
          textTransform: 'uppercase', marginBottom: 10 }}>{label}</div>
        <span style={{ fontSize: 20, opacity: 0.6 }}>{icon}</span>
      </div>
      <div style={{ fontSize: 32, fontWeight: 800, lineHeight: 1, color: '#fff' }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color, marginTop: 6 }}>{sub}</div>}
    </div>
  )
}

function RiskBadge({ level }) {
  const map = {
    high:   { bg: 'rgba(239,68,68,0.15)',  color: '#ef4444', label: 'HIGH' },
    medium: { bg: 'rgba(234,179,8,0.15)',  color: '#eab308', label: 'MEDIUM' },
    low:    { bg: 'rgba(34,197,94,0.15)',  color: '#22c55e', label: 'LOW' },
  }
  const s = map[level] || map.low
  return (
    <span style={{
      background: s.bg, color: s.color,
      border: `1px solid ${s.color}44`,
      borderRadius: 6, padding: '2px 10px',
      fontSize: 11, fontWeight: 700,
    }}>{s.label}</span>
  )
}

const CITY_RISK = [
  { city: 'Tokyo',         country: 'Japan',       level: 'high',   events: 847  },
  { city: 'Istanbul',      country: 'Turkey',      level: 'high',   events: 623  },
  { city: 'San Francisco', country: 'USA',         level: 'high',   events: 512  },
  { city: 'Lima',          country: 'Peru',        level: 'medium', events: 389  },
  { city: 'Mexico City',   country: 'Mexico',      level: 'high',   events: 534  },
  { city: 'London',        country: 'UK',          level: 'low',    events: 12   },
  { city: 'Jakarta',       country: 'Indonesia',   level: 'high',   events: 478  },
  { city: 'Santiago',      country: 'Chile',       level: 'high',   events: 394  },
]

export default function Dashboard() {
  const [stats,   setStats]   = useState(null)
  const [heatmap, setHeatmap] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([getStats(), getHeatmap(2000)])
      .then(([s, h]) => {
        setStats(s.data)
        setHeatmap(h.data.points || [])
      })
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '60vh', color: 'var(--muted)', fontSize: 14 }}>
      Loading seismic data...
    </div>
  )

  const highRisk   = CITY_RISK.filter(c => c.level === 'high').length
  const medRisk    = CITY_RISK.filter(c => c.level === 'medium').length
  const lowRisk    = CITY_RISK.filter(c => c.level === 'low').length

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 4 }}>Seismic Overview</h1>
        <p style={{ color: 'var(--muted)', fontSize: 13 }}>
          Global earthquake monitoring and risk intelligence
        </p>
      </div>

      {/* KPI Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        <StatCard
          label='Total Earthquakes'
          value={stats?.total?.toLocaleString()}
          sub={`↑ 12% vs last year`}
          icon='📈'
          color='var(--accent)'
        />
        <StatCard
          label='High Risk Cities'
          value={highRisk}
          sub={`of ${CITY_RISK.length} monitored`}
          icon='⚠️'
          color='#ef4444'
        />
        <StatCard
          label='Medium Risk'
          value={medRisk}
          sub='Moderate seismic zones'
          icon='🏢'
          color='#eab308'
        />
        <StatCard
          label='Low Risk'
          value={lowRisk}
          sub='Stable regions'
          icon='📊'
          color='#22c55e'
        />
      </div>

      {/* Charts Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>

        {/* Frequency Trends */}
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)',
          borderRadius: 12, padding: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>
            Earthquake Frequency Trends
          </div>
          <ResponsiveContainer width='100%' height={200}>
            <AreaChart data={stats?.yearlyStats}>
              <defs>
                <linearGradient id='areaGrad' x1='0' y1='0' x2='0' y2='1'>
                  <stop offset='5%'  stopColor='#00d4aa' stopOpacity={0.3} />
                  <stop offset='95%' stopColor='#00d4aa' stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke='var(--border)' strokeDasharray='3 3' />
              <XAxis dataKey='year' stroke='var(--muted)' fontSize={11} />
              <YAxis stroke='var(--muted)' fontSize={11} />
              <Tooltip
                contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)',
                  borderRadius: 8, fontSize: 12 }}
              />
              <Area type='monotone' dataKey='count' stroke='#00d4aa'
                fill='url(#areaGrad)' strokeWidth={2} dot={{ fill: '#00d4aa', r: 3 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Avg Magnitude by Year */}
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)',
          borderRadius: 12, padding: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>
            Average Magnitude by Year
          </div>
          <ResponsiveContainer width='100%' height={200}>
            <BarChart data={stats?.yearlyStats}>
              <CartesianGrid stroke='var(--border)' strokeDasharray='3 3' />
              <XAxis dataKey='year' stroke='var(--muted)' fontSize={11} />
              <YAxis stroke='var(--muted)' fontSize={11} domain={[5.5, 6.5]} />
              <Tooltip
                contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)',
                  borderRadius: 8, fontSize: 12 }}
              />
              <Bar dataKey='avgMag' fill='#3b82f6' radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Bottom Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

        {/* Top Regions */}
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)',
          borderRadius: 12, padding: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>
            Top Seismic Regions
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {stats?.topRegions?.slice(0, 6).map((r, i) => {
              const max = stats.topRegions[0].count
              const pct = Math.round((r.count / max) * 100)
              return (
                <div key={i}>
                  <div style={{ display: 'flex', justifyContent: 'space-between',
                    marginBottom: 4, fontSize: 12 }}>
                    <span>{r.region}</span>
                    <span style={{ color: 'var(--muted)' }}>{r.count.toLocaleString()}</span>
                  </div>
                  <div style={{ height: 4, background: 'var(--border)', borderRadius: 2 }}>
                    <div style={{ height: 4, width: `${pct}%`,
                      background: 'var(--accent)', borderRadius: 2 }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* City Risk Distribution */}
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)',
          borderRadius: 12, padding: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>
            City Risk Distribution
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {CITY_RISK.map((c, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center',
                justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <RiskBadge level={c.level} />
                  <span style={{ fontSize: 13 }}>{c.city}, {c.country}</span>
                </div>
                <span style={{ color: 'var(--muted)', fontSize: 12 }}>
                  {c.events.toLocaleString()} events
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}