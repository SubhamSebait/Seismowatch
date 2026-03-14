import { useEffect, useState } from 'react'
import { getCities, predictCity } from '../utils/api'
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
  LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid
} from 'recharts'

function RiskBadge({ level }) {
  const map = {
    high:   { bg: 'rgba(239,68,68,0.15)',  color: '#ef4444', label: 'high' },
    medium: { bg: 'rgba(234,179,8,0.15)',  color: '#eab308', label: 'medium' },
    low:    { bg: 'rgba(34,197,94,0.15)',  color: '#22c55e', label: 'low' },
  }
  const s = map[level] || map.low
  return (
    <span style={{
      background: s.bg, color: s.color,
      border: `1px solid ${s.color}44`,
      borderRadius: 20, padding: '2px 12px',
      fontSize: 11, fontWeight: 700,
    }}>{s.label}</span>
  )
}

function StatBox({ label, value, icon }) {
  return (
    <div style={{ background: 'var(--surface)', borderRadius: 10,
      padding: '14px 16px', flex: 1 }}>
      <div style={{ fontSize: 20, marginBottom: 4 }}>{icon}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: '#fff' }}>{value}</div>
      <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{label}</div>
    </div>
  )
}

export default function CityRiskAnalysis() {
  const [cities,   setCities]   = useState([])
  const [selected, setSelected] = useState(null)
  const [predict,  setPredict]  = useState(null)
  const [search,   setSearch]   = useState('')
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    getCities().then(r => {
      setCities(r.data)
      setSelected(r.data[0])
    }).finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!selected) return
    predictCity(selected.city.toLowerCase().replace(' ', '-'))
      .then(r => setPredict(r.data))
      .catch(() => setPredict(null))
  }, [selected])

  const filtered = cities.filter(c =>
    c.city.toLowerCase().includes(search.toLowerCase()) ||
    c.country.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) return (
    <div style={{ color: 'var(--muted)', padding: 40 }}>Loading city data...</div>
  )

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 4 }}>City Risk Analysis</h1>
        <p style={{ color: 'var(--muted)', fontSize: 13 }}>
          Detailed seismic risk assessment by city
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 20 }}>

        {/* ── City List ── */}
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)',
          borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

          {/* Search */}
          <div style={{ padding: 12, borderBottom: '1px solid var(--border)' }}>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder='Search city...'
              style={{
                width: '100%', background: 'var(--surface)',
                border: '1px solid var(--border)', borderRadius: 8,
                padding: '8px 12px', color: 'var(--text)', fontSize: 13,
                outline: 'none',
              }}
            />
          </div>

          {/* List */}
          <div style={{ flex: 1, overflowY: 'auto', maxHeight: 520 }}>
            {filtered.map(c => (
              <div key={c.city}
                onClick={() => setSelected(c)}
                style={{
                  padding: '12px 16px', cursor: 'pointer',
                  background: selected?.city === c.city ? 'rgba(0,212,170,0.08)' : 'transparent',
                  borderLeft: selected?.city === c.city ? '3px solid var(--accent)' : '3px solid transparent',
                  borderBottom: '1px solid var(--border)',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  transition: 'all 0.15s',
                }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{c.city}</div>
                  <div style={{ color: 'var(--muted)', fontSize: 12 }}>{c.country}</div>
                </div>
                <RiskBadge level={c.riskLevel} />
              </div>
            ))}
          </div>
        </div>

        {/* ── Detail Panel ── */}
        {selected && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* City header */}
            <div style={{ background: 'var(--card)', border: '1px solid var(--border)',
              borderRadius: 12, padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <h2 style={{ fontSize: 22, fontWeight: 800 }}>
                  {selected.city}, {selected.country}
                </h2>
                <RiskBadge level={selected.riskLevel} />
                {predict && (
                  <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--muted)' }}>
                    ML Confidence:
                    <span style={{ color: 'var(--accent)', fontWeight: 700, marginLeft: 4 }}>
                      {predict.confidence}%
                    </span>
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <StatBox label='Historical Earthquakes' value={selected.eqCount} icon='📊' />
                <StatBox label='Avg Magnitude'          value={selected.avgMag}  icon='⚡' />
                <StatBox label='Soil Vulnerability'     value={`${selected.soilVulnerability}%`} icon='📍' />
                <StatBox label='Pop. Density'           value={`${selected.popDensity}/km²`} icon='👥' />
              </div>
            </div>

            {/* Charts row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

              {/* Historical Trends */}
              <div style={{ background: 'var(--card)', border: '1px solid var(--border)',
                borderRadius: 12, padding: 20 }}>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>
                  Historical Trends
                </div>
                {selected.trend?.length > 0 ? (
                  <ResponsiveContainer width='100%' height={200}>
                    <LineChart data={selected.trend}>
                      <CartesianGrid stroke='var(--border)' strokeDasharray='3 3' />
                      <XAxis dataKey='year' stroke='var(--muted)' fontSize={11} />
                      <YAxis stroke='var(--muted)' fontSize={11} />
                      <Tooltip contentStyle={{ background: 'var(--card)',
                        border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                      <Line type='monotone' dataKey='count' stroke='var(--accent)'
                        strokeWidth={2} dot={{ fill: 'var(--accent)', r: 3 }} />
                      <Line type='monotone' dataKey='avgMag' stroke='#3b82f6'
                        strokeWidth={2} dot={{ fill: '#3b82f6', r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div style={{ color: 'var(--muted)', fontSize: 13, padding: '40px 0',
                    textAlign: 'center' }}>
                    Insufficient trend data for this city
                  </div>
                )}
              </div>

              {/* Radar Chart */}
              <div style={{ background: 'var(--card)', border: '1px solid var(--border)',
                borderRadius: 12, padding: 20 }}>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>
                  Risk Factor Breakdown
                </div>
                <ResponsiveContainer width='100%' height={200}>
                  <RadarChart data={selected.radarData}>
                    <PolarGrid stroke='var(--border)' />
                    <PolarAngleAxis dataKey='factor' fontSize={10} stroke='var(--muted)' />
                    <Radar dataKey='value' stroke='var(--accent)'
                      fill='var(--accent)' fillOpacity={0.2} strokeWidth={2} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* ML Prediction box */}
            {predict && (
              <div style={{ background: 'var(--card)', border: '1px solid var(--border)',
                borderRadius: 12, padding: 20 }}>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>
                  🤖 ML Risk Prediction — Ensemble Model
                </div>
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                  {Object.entries(predict.probabilities || {}).map(([level, pct]) => (
                    <div key={level} style={{ flex: 1, minWidth: 100 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between',
                        marginBottom: 6, fontSize: 12 }}>
                        <span style={{ textTransform: 'capitalize' }}>{level}</span>
                        <span style={{ fontWeight: 700 }}>{pct}%</span>
                      </div>
                      <div style={{ height: 6, background: 'var(--border)', borderRadius: 3 }}>
                        <div style={{
                          height: 6, borderRadius: 3, width: `${pct}%`,
                          background: level === 'high' ? '#ef4444'
                            : level === 'medium' ? '#eab308' : '#22c55e',
                          transition: 'width 0.8s ease',
                        }} />
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 12, fontSize: 12, color: 'var(--muted)' }}>
                  Based on {predict.eq_count} earthquakes ·
                  Avg mag {predict.avg_mag} ·
                  {predict.freq_per_year} events/year ·
                  {Math.round(predict.shallow_ratio * 100)}% shallow
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}