import { useEffect, useState } from 'react'
import axios from 'axios'

const W = 1100, H = 520

function project(lat, lng) {
  return [
    ((lng + 180) / 360) * W,
    ((90 - lat) / 180) * H,
  ]
}

function ScoreBar({ value, max = 100 }) {
  const color = value >= 65 ? '#ef4444' : value >= 40 ? '#eab308' : '#22c55e'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 6, background: 'var(--border)', borderRadius: 3 }}>
        <div style={{ height: 6, width: `${(value / max) * 100}%`,
          background: color, borderRadius: 3, transition: 'width 0.8s ease' }} />
      </div>
      <span style={{ fontSize: 12, fontWeight: 700, color, minWidth: 32 }}>{value}</span>
    </div>
  )
}

function RiskBadge({ level }) {
  const map = {
    high:   { bg: 'rgba(239,68,68,0.15)',  color: '#ef4444' },
    medium: { bg: 'rgba(234,179,8,0.15)',  color: '#eab308' },
    low:    { bg: 'rgba(34,197,94,0.15)',  color: '#22c55e' },
  }
  const s = map[level] || map.low
  return (
    <span style={{ background: s.bg, color: s.color,
      border: `1px solid ${s.color}44`, borderRadius: 6,
      padding: '2px 10px', fontSize: 11, fontWeight: 700,
      textTransform: 'uppercase' }}>{level}</span>
  )
}

export default function Forecast() {
  const [forecast,      setForecast]      = useState(null)
  const [activeRegions, setActiveRegions] = useState([])
  const [selected,      setSelected]      = useState(null)
  const [loading, setLoading] = useState(true)
const [tab,     setTab]     = useState('forecast')
const [geojson, setGeojson] = useState(null)

  useEffect(() => {
  Promise.all([
    axios.get('http://localhost:5000/api/predict/forecast'),
    axios.get('http://localhost:5000/api/predict/active-cities'),
    axios.get('http://localhost:5000/api/map'),
  ]).then(([f, a, m]) => {
    setForecast(f.data)
    setActiveRegions(a.data.active_regions || [])
    setSelected(f.data.top_zones?.[0] || null)
    setGeojson(m.data)
  }).finally(() => setLoading(false))
}, [])

  if (loading) return (
    <div style={{ color: 'var(--muted)', padding: 40, textAlign: 'center' }}>
      🔄 Fetching live seismic data from USGS...
    </div>
  )

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
          <h1 style={{ fontSize: 26, fontWeight: 800 }}>Seismic Forecast</h1>
          <span style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444',
            border: '1px solid #ef444444', borderRadius: 6,
            padding: '2px 10px', fontSize: 11, fontWeight: 700 }}>
            EXPERIMENTAL
          </span>
        </div>
        <p style={{ color: 'var(--muted)', fontSize: 13 }}>
          ML ensemble + Omori Law sequence analysis · {forecast?.generated_at}
        </p>
        <p style={{ color: '#eab308', fontSize: 11, marginTop: 4 }}>
          ⚠ {forecast?.disclaimer}
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20 }}>
        {[['forecast','🤖 ML Forecast'],['active','🌍 Active Regions']].map(([k,l]) => (
          <button key={k} onClick={() => setTab(k)} style={{
            background: tab === k ? 'rgba(0,212,170,0.1)' : 'var(--card)',
            border: `1px solid ${tab === k ? 'var(--accent)' : 'var(--border)'}`,
            color: tab === k ? 'var(--accent)' : 'var(--muted)',
            borderRadius: 8, padding: '8px 18px', fontSize: 13,
            fontFamily: 'inherit', cursor: 'pointer',
          }}>{l}</button>
        ))}
      </div>

      {/* ── ML FORECAST TAB ── */}
      {tab === 'forecast' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 16 }}>

          {/* Map */}
          <div style={{ background: '#0a1628', border: '1px solid var(--border)',
            borderRadius: 12, overflow: 'hidden' }}>
            <svg width='100%' viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
              <rect width={W} height={H} fill='#0a1628' />
              {/* Country polygons */}
{geojson?.features?.map((f, i) => {
  try {
    const rings = f.geometry.type === 'Polygon'
      ? f.geometry.coordinates
      : f.geometry.coordinates.flat(1)
    const d = rings.map(ring =>
      ring.map(([lng, lat], i) => {
        const [x, y] = project(lat, lng)
        return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
      }).join(' ') + ' Z'
    ).join(' ')
    return <path key={i} d={d} fill='#0f1e35' stroke='#1e3050' strokeWidth='0.5' />
  } catch { return null }
})}  
              {/* Grid */}
              {[-60,-30,0,30,60].map(lat => {
                const [,y] = project(lat, 0)
                return <line key={lat} x1={0} y1={y} x2={W} y2={y}
                  stroke='#ffffff06' strokeWidth='0.5' />
              })}

              {/* Live events */}
              {forecast?.live_events?.filter(e => e.mag >= 3).map((e, i) => {
                const [x, y] = project(e.lat, e.lng)
                const color  = e.mag >= 5 ? '#ef4444' : e.mag >= 4 ? '#eab308' : '#00d4aa'
                return (
                  <circle key={i} cx={x} cy={y}
                    r={Math.max(2, (e.mag - 2) * 2)}
                    fill={color} fillOpacity={0.5} />
                )
              })}

              {/* Top zones */}
              {forecast?.top_zones?.map((z, i) => {
                const [x, y] = project(z.sample_lat, z.sample_lng)
                const color  = z.ml_risk === 'high' ? '#ef4444'
                             : z.ml_risk === 'medium' ? '#eab308' : '#22c55e'
                const isSelected = selected?.grid_lat === z.grid_lat &&
                                   selected?.grid_lng === z.grid_lng
                return (
                  <g key={i} style={{ cursor: 'pointer' }}
                    onClick={() => setSelected(z)}>
                    <circle cx={x} cy={y} r={isSelected ? 22 : 16}
                      fill={color} fillOpacity={0.12}
                      stroke={color} strokeWidth={isSelected ? 2 : 1} />
                    <circle cx={x} cy={y} r={isSelected ? 8 : 6}
                      fill={color} fillOpacity={0.9} />
                    <text x={x} y={y - 18} textAnchor='middle'
                      fill='#fff' fontSize={9} fontWeight={700}
                      style={{ pointerEvents: 'none' }}>
                      #{i + 1} {z.sample_place?.split(',').pop()?.trim()?.substring(0, 12)}
                    </text>
                    <text x={x} y={y + 20} textAnchor='middle'
                      fill={color} fontSize={8} fontWeight={700}
                      style={{ pointerEvents: 'none' }}>
                      {z.final_score}
                    </text>
                  </g>
                )
              })}
            </svg>

            {/* Map legend */}
            <div style={{ padding: '8px 16px', borderTop: '1px solid var(--border)',
              display: 'flex', gap: 16, fontSize: 11, color: 'var(--muted)' }}>
              <span>🔴 High risk zone</span>
              <span>🟡 Medium risk zone</span>
              <span>🟢 Low risk zone</span>
              <span style={{ marginLeft: 'auto' }}>
                {forecast?.total_live_events} live events · {forecast?.zones_analyzed} zones
              </span>
            </div>
          </div>

          {/* Zone detail */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

            {/* Top zones list */}
            <div style={{ background: 'var(--card)', border: '1px solid var(--border)',
              borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)',
                fontSize: 11, color: 'var(--muted)', letterSpacing: 1 }}>
                TOP ELEVATED ZONES
              </div>
              <div style={{ maxHeight: 220, overflowY: 'auto' }}>
                {forecast?.top_zones?.map((z, i) => (
                  <div key={i} onClick={() => setSelected(z)}
                    style={{
                      padding: '10px 16px', cursor: 'pointer',
                      background: selected?.grid_lat === z.grid_lat ? 'rgba(0,212,170,0.06)' : 'transparent',
                      borderLeft: selected?.grid_lat === z.grid_lat ? '3px solid var(--accent)' : '3px solid transparent',
                      borderBottom: '1px solid var(--border)',
                    }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between',
                      alignItems: 'center', marginBottom: 4 }}>
                      <span style={{ fontSize: 12, fontWeight: 600 }}>
                        #{i+1} {z.sample_place?.substring(0, 28)}
                      </span>
                      <RiskBadge level={z.ml_risk} />
                    </div>
                    <ScoreBar value={z.final_score} />
                  </div>
                ))}
              </div>
            </div>

            {/* Selected zone detail */}
            {selected && (
              <div style={{ background: 'var(--card)', border: '1px solid var(--border)',
                borderRadius: 12, padding: 16 }}>
                <div style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: 1,
                  marginBottom: 12 }}>ZONE ANALYSIS</div>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>
                  {selected.sample_place}
                </div>

                {/* Scores */}
                {[
                  ['Final Score',    selected.final_score],
                  ['Omori Surge',    selected.omori_score],
                  ['ML Confidence',  selected.ml_confidence],
                ].map(([l, v]) => (
                  <div key={l} style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>{l}</div>
                    <ScoreBar value={v} />
                  </div>
                ))}

                {/* Probabilities */}
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 8 }}>
                    ML PROBABILITIES
                  </div>
                  {[
                    ['High',   selected.proba_high,   '#ef4444'],
                    ['Medium', selected.proba_medium, '#eab308'],
                    ['Low',    selected.proba_low,    '#22c55e'],
                  ].map(([l, v, c]) => (
                    <div key={l} style={{ display: 'flex', alignItems: 'center',
                      gap: 8, marginBottom: 6 }}>
                      <span style={{ fontSize: 11, color: c, minWidth: 48 }}>{l}</span>
                      <div style={{ flex: 1, height: 4,
                        background: 'var(--border)', borderRadius: 2 }}>
                        <div style={{ height: 4, width: `${v}%`,
                          background: c, borderRadius: 2 }} />
                      </div>
                      <span style={{ fontSize: 11, color: c, minWidth: 36 }}>{v}%</span>
                    </div>
                  ))}
                </div>

                {/* Stats */}
                <div style={{ marginTop: 12, display: 'grid',
                  gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {[
                    ['24hr Shocks',  selected.shock_count],
                    ['Max Mag',      selected.live_max_mag?.toFixed(1)],
                    ['Hist Avg Mag', selected.hist_avg_mag?.toFixed(2)],
                    ['Shallow %',   Math.round(selected.shallow_ratio * 100) + '%'],
                  ].map(([l, v]) => (
                    <div key={l} style={{ background: 'var(--surface)',
                      borderRadius: 8, padding: '8px 12px' }}>
                      <div style={{ fontSize: 10, color: 'var(--muted)' }}>{l}</div>
                      <div style={{ fontSize: 16, fontWeight: 700 }}>{v}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── ACTIVE REGIONS TAB ── */}
      {tab === 'active' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
          {activeRegions.map((r, i) => (
            <div key={i} style={{ background: 'var(--card)',
              border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between',
                alignItems: 'flex-start', marginBottom: 12 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{r.region}</div>
                  <div style={{ color: 'var(--muted)', fontSize: 11, marginTop: 2 }}>
                    {r.count} events · Max M{r.max_mag?.toFixed(1)}
                  </div>
                </div>
                <span style={{
                  background: r.max_mag >= 6 ? 'rgba(239,68,68,0.15)' : 'rgba(234,179,8,0.15)',
                  color: r.max_mag >= 6 ? '#ef4444' : '#eab308',
                  border: `1px solid ${r.max_mag >= 6 ? '#ef444444' : '#eab30844'}`,
                  borderRadius: 6, padding: '2px 10px', fontSize: 12, fontWeight: 800,
                }}>M{r.max_mag?.toFixed(1)}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {r.events?.map((e, j) => (
                  <div key={j} style={{ display: 'flex', justifyContent: 'space-between',
                    fontSize: 12, padding: '4px 0',
                    borderBottom: j < r.events.length - 1 ? '1px solid var(--border)' : 'none' }}>
                    <span style={{ color: 'var(--muted)', flex: 1,
                      overflow: 'hidden', textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap' }}>{e.place}</span>
                    <span style={{ color: e.mag >= 6 ? '#ef4444' : '#eab308',
                      fontWeight: 700, marginLeft: 8 }}>M{e.mag}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}