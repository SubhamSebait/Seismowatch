import { useEffect, useState, useRef } from 'react'
import { getHeatmap, getCities, getMap } from '../utils/api'

const MAG_COLORS = {
  high:   '#ef4444',
  medium: '#eab308',
  low:    '#22c55e',
}

function magToColor(mag) {
  if (mag >= 7)   return '#ef4444'
  if (mag >= 6.5) return '#f97316'
  if (mag >= 6)   return '#eab308'
  return '#00d4aa'
}

function magToRadius(mag) {
  if (mag >= 8)   return 16
  if (mag >= 7)   return 12
  if (mag >= 6.5) return 8
  if (mag >= 6)   return 5
  return 3
}

const W = 1100, H = 520

function project(lat, lng) {
  const x = ((lng + 180) / 360) * W
  const y = ((90 - lat) / 180) * H
  return [x, y]
}

// Convert GeoJSON geometry to SVG path string
function geoToPath(geometry) {
  const rings = geometry.type === 'Polygon'
    ? geometry.coordinates
    : geometry.coordinates.flat(1)

  return rings.map(ring =>
    ring.map(([lng, lat], i) => {
      const [x, y] = project(lat, lng)
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
    }).join(' ') + ' Z'
  ).join(' ')
}

export default function RiskHeatmap() {
  const [points,       setPoints]       = useState([])
  const [cities,       setCities]       = useState([])
  const [geojson,      setGeojson]      = useState(null)
  const [minYear,      setMinYear]      = useState(2000)
  const [showClusters, setShowClusters] = useState(true)
  const [showCities,   setShowCities]   = useState(true)
  const [loading,      setLoading]      = useState(true)
  const [tooltip,      setTooltip]      = useState(null)

  useEffect(() => {
    Promise.all([getHeatmap(minYear), getCities(), getMap()])
      .then(([h, c, m]) => {
        setPoints(h.data.points || [])
        setCities(c.data || [])
        setGeojson(m.data)
      })
      .finally(() => setLoading(false))
  }, [minYear])

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 4 }}>Risk Heatmap</h1>
        <p style={{ color: 'var(--muted)', fontSize: 13 }}>
          Full-screen interactive seismic risk visualization
        </p>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 16,
        alignItems: 'center', flexWrap: 'wrap' }}>
        {[
          { label: 'Earthquake Clusters', state: showClusters, set: setShowClusters },
          { label: 'City Risk Markers',   state: showCities,   set: setShowCities   },
        ].map(({ label, state, set }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div onClick={() => set(s => !s)} style={{
              width: 40, height: 22, borderRadius: 11,
              background: state ? 'var(--accent)' : 'var(--border)',
              cursor: 'pointer', position: 'relative', transition: 'background 0.2s',
            }}>
              <div style={{
                position: 'absolute', top: 3, left: state ? 21 : 3,
                width: 16, height: 16, borderRadius: '50%',
                background: '#fff', transition: 'left 0.2s',
              }} />
            </div>
            <span style={{ fontSize: 13 }}>{label}</span>
          </div>
        ))}

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13, color: 'var(--muted)' }}>From:</span>
          <select value={minYear} onChange={e => setMinYear(+e.target.value)}
            style={{ background: 'var(--card)', border: '1px solid var(--border)',
              borderRadius: 8, padding: '6px 12px', color: 'var(--text)',
              fontSize: 13, outline: 'none', cursor: 'pointer' }}>
            {[1950,1960,1970,1980,1990,2000,2010,2015,2020].map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>
            {loading ? 'Loading...' : `${points.length.toLocaleString()} events`}
          </span>
        </div>
      </div>

      {/* Map container */}
      <div style={{ background: '#0a1628', border: '1px solid var(--border)',
        borderRadius: 12, overflow: 'hidden', position: 'relative' }}>

        <svg width='100%' viewBox={`0 0 ${W} ${H}`}
          style={{ display: 'block' }}>

          {/* Ocean background */}
          <rect width={W} height={H} fill='#0a1628' />

          {/* Country polygons from GeoJSON */}
          {geojson?.features?.map((f, i) => {
            try {
              return (
                <path key={i}
                  d={geoToPath(f.geometry)}
                  fill='#0f1e35'
                  stroke='#1e3050'
                  strokeWidth='0.5'
                />
              )
            } catch { return null }
          })}

          {/* Grid lines */}
          {[-60,-30,0,30,60].map(lat => {
            const [,y] = project(lat, 0)
            return <line key={lat} x1={0} y1={y} x2={W} y2={y}
              stroke='#ffffff08' strokeWidth='0.5' />
          })}
          {[-120,-60,0,60,120].map(lng => {
            const [x] = project(0, lng)
            return <line key={lng} x1={x} y1={0} x2={x} y2={H}
              stroke='#ffffff08' strokeWidth='0.5' />
          })}

          {/* Earthquake clusters */}
          {showClusters && points
            .filter(p => p.mag >= 6)
            .map((p, i) => {
              const [x, y] = project(p.lat, p.lng)
              const r      = magToRadius(p.mag)
              const color  = magToColor(p.mag)
              return (
                <g key={i} style={{ cursor: 'pointer' }}
                  onMouseEnter={() => setTooltip({ x, y, ...p })}
                  onMouseLeave={() => setTooltip(null)}>
                  <circle cx={x} cy={y} r={r * 2.5} fill={color} fillOpacity={0.1} />
                  <circle cx={x} cy={y} r={r}        fill={color} fillOpacity={0.75}
                    stroke={color} strokeWidth={0.5} />
                </g>
              )
            })}

          {/* City markers */}
          {showCities && cities.map((c, i) => {
            const [x, y] = project(c.lat, c.lng)
            const color  = MAG_COLORS[c.riskLevel] || '#fff'
            return (
              <g key={i} style={{ cursor: 'pointer' }}
                onMouseEnter={() => setTooltip({
                  x, y, place: `${c.city}, ${c.country}`,
                  mag: c.riskScore, isCity: true, level: c.riskLevel
                })}
                onMouseLeave={() => setTooltip(null)}>
                <circle cx={x} cy={y} r={12} fill={color} fillOpacity={0.12}
                  stroke={color} strokeWidth={1.5} />
                <circle cx={x} cy={y} r={5}  fill={color} />
                <text x={x} y={y - 14} textAnchor='middle'
                  fill='#e2e8f0' fontSize={9} fontWeight={600}
                  style={{ pointerEvents: 'none' }}>{c.city}</text>
              </g>
            )
          })}

          {/* Tooltip */}
          {tooltip && (() => {
            const tx = Math.min(tooltip.x + 10, W - 170)
            const ty = Math.max(tooltip.y - 55, 8)
            return (
              <g>
                <rect x={tx} y={ty} width={160} height={tooltip.isCity ? 52 : 44}
                  rx={6} fill='#0f1623ee' stroke='#1e2d40' strokeWidth={1} />
                <text x={tx+10} y={ty+16} fill='#e2e8f0' fontSize={11} fontWeight={700}>
                  {(tooltip.place || 'Unknown').substring(0, 22)}
                </text>
                {tooltip.isCity ? (
                  <>
                    <text x={tx+10} y={ty+30} fill='#64748b' fontSize={10}>
                      Risk: {tooltip.level?.toUpperCase()}
                    </text>
                    <text x={tx+10} y={ty+43} fill='#64748b' fontSize={10}>
                      Score: {tooltip.mag}
                    </text>
                  </>
                ) : (
                  <>
                    <text x={tx+10} y={ty+30} fill='#64748b' fontSize={10}>
                      Magnitude: M{tooltip.mag?.toFixed(1)}
                    </text>
                    <text x={tx+10} y={ty+43} fill='#64748b' fontSize={10}>
                      Year: {tooltip.year}
                    </text>
                  </>
                )}
              </g>
            )
          })()}
        </svg>

        {/* Legend */}
        <div style={{ position: 'absolute', bottom: 16, right: 16,
          background: 'rgba(10,22,40,0.92)', border: '1px solid var(--border)',
          borderRadius: 8, padding: '10px 14px' }}>
          <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 8,
            letterSpacing: 1 }}>MAGNITUDE</div>
          {[['M8.0+','#ef4444'],['M7.0+','#f97316'],
            ['M6.5+','#eab308'],['M6.0+','#00d4aa']].map(([l,c]) => (
            <div key={l} style={{ display: 'flex', alignItems: 'center',
              gap: 8, marginBottom: 4 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: c }} />
              <span style={{ fontSize: 11 }}>{l}</span>
            </div>
          ))}
          <div style={{ borderTop: '1px solid var(--border)', marginTop: 8, paddingTop: 8 }}>
            <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 6,
              letterSpacing: 1 }}>CITY RISK</div>
            {[['High','#ef4444'],['Medium','#eab308'],['Low','#22c55e']].map(([l,c]) => (
              <div key={l} style={{ display: 'flex', alignItems: 'center',
                gap: 8, marginBottom: 4 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%',
                  border: `2px solid ${c}`, background: c + '33' }} />
                <span style={{ fontSize: 11 }}>{l}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}