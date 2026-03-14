import { useEffect, useState, useCallback } from 'react'
import { getEarthquakes } from '../utils/api'

function MagBadge({ mag }) {
  const color = mag >= 7 ? '#ef4444' : mag >= 6.5 ? '#f97316' : mag >= 6 ? '#eab308' : 'var(--accent)'
  return (
    <span style={{ color, fontWeight: 700, fontSize: 14 }}>{mag.toFixed(1)}</span>
  )
}

const COLS = [
  { key: 'time',  label: 'Date',       sortable: true  },
  { key: 'place', label: 'Location',   sortable: true  },
  { key: 'lat',   label: 'Latitude',   sortable: false },
  { key: 'lng',   label: 'Longitude',  sortable: false },
  { key: 'mag',   label: 'Magnitude',  sortable: true  },
  { key: 'depth', label: 'Depth (km)', sortable: true  },
]

export default function SeismicExplorer() {
  const [data,    setData]    = useState([])
  const [total,   setTotal]   = useState(0)
  const [page,    setPage]    = useState(1)
  const [search,  setSearch]  = useState('')
  const [minMag,  setMinMag]  = useState('')
  const [sortKey, setSortKey] = useState('time')
  const [sortDir, setSortDir] = useState('desc')
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    setLoading(true)
    getEarthquakes({
      page,
      limit: 50,
      search,
      minMag: minMag || 0,
    }).then(r => {
      setData(r.data.data)
      setTotal(r.data.total)
    }).finally(() => setLoading(false))
  }, [page, search, minMag])

  useEffect(() => { load() }, [load])

  // Client-side sort
  const sorted = [...(data || [])].sort((a, b) => {
    let av = a[sortKey], bv = b[sortKey]
    if (sortKey === 'time') { av = new Date(av); bv = new Date(bv) }
    return sortDir === 'asc' ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1)
  })

  function toggleSort(key) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('desc') }
  }

  const totalPages = Math.ceil(total / 50)

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 4 }}>Seismic Data Explorer</h1>
        <p style={{ color: 'var(--muted)', fontSize: 13 }}>
          Browse, filter, and sort earthquake records
        </p>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <input
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1) }}
          placeholder='🔍  Search location...'
          style={{
            flex: 1, minWidth: 200, background: 'var(--card)',
            border: '1px solid var(--border)', borderRadius: 8,
            padding: '10px 14px', color: 'var(--text)', fontSize: 13, outline: 'none',
          }}
        />
        <select
          value={minMag}
          onChange={e => { setMinMag(e.target.value); setPage(1) }}
          style={{
            background: 'var(--card)', border: '1px solid var(--border)',
            borderRadius: 8, padding: '10px 14px', color: 'var(--text)',
            fontSize: 13, outline: 'none', cursor: 'pointer',
          }}>
          <option value=''>All Magnitudes</option>
          <option value='5.5'>M5.5+</option>
          <option value='6'>M6.0+</option>
          <option value='6.5'>M6.5+</option>
          <option value='7'>M7.0+</option>
          <option value='8'>M8.0+</option>
        </select>
        <div style={{ display: 'flex', alignItems: 'center', color: 'var(--muted)', fontSize: 13 }}>
          {(total || 0).toLocaleString()} records
        </div>
      </div>

      {/* Table */}
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)',
        borderRadius: 12, overflow: 'hidden' }}>

        {/* Header */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '130px 1fr 90px 100px 100px 100px',
          padding: '12px 20px', background: 'var(--surface)',
          borderBottom: '1px solid var(--border)',
        }}>
          {COLS.map(col => (
            <div key={col.key}
              onClick={() => col.sortable && toggleSort(col.key)}
              style={{
                fontSize: 12, color: sortKey === col.key ? 'var(--accent)' : 'var(--muted)',
                cursor: col.sortable ? 'pointer' : 'default',
                userSelect: 'none', fontWeight: 600,
                display: 'flex', alignItems: 'center', gap: 4,
              }}>
              {col.label}
              {col.sortable && (
                <span style={{ fontSize: 10 }}>
                  {sortKey === col.key ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Rows */}
        <div style={{ maxHeight: 480, overflowY: 'auto' }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>
              Loading...
            </div>
          ) : sorted.map((row, i) => (
            <div key={i} style={{
              display: 'grid',
              gridTemplateColumns: '130px 1fr 90px 100px 100px 100px',
              padding: '12px 20px',
              borderBottom: '1px solid var(--border)',
              fontSize: 13,
              transition: 'background 0.15s',
            }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--surface)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <div style={{ color: 'var(--muted)', fontSize: 12 }}>
                {row.time ? row.time.substring(0, 10) : '—'}
              </div>
              <div style={{ fontWeight: 600, paddingRight: 12,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {row.place || '—'}
              </div>
              <div style={{ color: 'var(--muted)' }}>{row.lat?.toFixed(2)}</div>
              <div style={{ color: 'var(--muted)' }}>{row.lng?.toFixed(2)}</div>
              <div><MagBadge mag={row.mag} /></div>
              <div style={{ color: 'var(--muted)' }}>{Math.round(row.depth)}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Pagination */}
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center',
        gap: 8, marginTop: 16 }}>
        <button
          onClick={() => setPage(p => Math.max(1, p - 1))}
          disabled={page === 1}
          style={{
            background: 'var(--card)', border: '1px solid var(--border)',
            color: page === 1 ? 'var(--muted)' : 'var(--text)',
            borderRadius: 8, padding: '6px 16px', fontSize: 13,
          }}>← Prev</button>

        <span style={{ color: 'var(--muted)', fontSize: 13 }}>
          Page {page} of {(totalPages || 1).toLocaleString()}
        </span>

        <button
          onClick={() => setPage(p => Math.min(totalPages, p + 1))}
          disabled={page === totalPages}
          style={{
            background: 'var(--card)', border: '1px solid var(--border)',
            color: page === totalPages ? 'var(--muted)' : 'var(--text)',
            borderRadius: 8, padding: '6px 16px', fontSize: 13,
          }}>Next →</button>
      </div>
    </div>
  )
}