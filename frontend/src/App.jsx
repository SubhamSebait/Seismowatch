import { useState } from 'react'
import { Routes, Route, NavLink } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import CityRiskAnalysis from './pages/CityRiskAnalysis'
import SeismicExplorer from './pages/SeismicExplorer'
import RiskHeatmap from './pages/RiskHeatmap'
import SafetyRecommendations from './pages/SafetyRecommendations'
import Forecast from './pages/Forecast'

const NAV = [
  { path: '/',             label: 'Dashboard',            icon: '▦' },
  { path: '/cities',       label: 'City Risk Analysis',   icon: '⊞' },
  { path: '/explorer',     label: 'Seismic Data Explorer','icon': '≡' },
  { path: '/heatmap',      label: 'Risk Heatmap',         icon: '◈' },
  { path: '/safety',       label: 'Safety Recommendations',icon: '⊙' },
  { path: '/forecast', label: 'Seismic Forecast', icon: '🔮' },
]

export default function App() {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>

      {/* ── Sidebar ── */}
      <aside style={{
        width: collapsed ? 60 : 260,
        background: 'var(--surface)',
        borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column',
        transition: 'width 0.25s ease',
        flexShrink: 0,
      }}>
        {/* Logo */}
        <div style={{
          padding: '18px 16px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            fontSize: 16, flexShrink: 0,
          }}>🌍</div>
          {!collapsed && (
            <span style={{ fontWeight: 700, fontSize: 13, lineHeight: 1.3 }}>
              Earthquake Risk<br />Intelligence Platform
            </span>
          )}
        </div>

        {/* Nav label */}
        {!collapsed && (
          <div style={{ padding: '16px 16px 8px', fontSize: 10,
            letterSpacing: 2, color: 'var(--muted)', textTransform: 'uppercase' }}>
            Navigation
          </div>
        )}

        {/* Nav links */}
        <nav style={{ flex: 1, padding: '4px 8px' }}>
          {NAV.map(({ path, label, icon }) => (
            <NavLink key={path} to={path} end={path === '/'} style={({ isActive }) => ({
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '10px 12px', borderRadius: 8, marginBottom: 2,
              background: isActive ? 'rgba(0,212,170,0.1)' : 'transparent',
              color: isActive ? 'var(--accent)' : 'var(--muted)',
              borderLeft: isActive ? '2px solid var(--accent)' : '2px solid transparent',
              transition: 'all 0.15s', fontSize: 13, fontWeight: isActive ? 600 : 400,
            })}>
              <span style={{ fontSize: 16, flexShrink: 0 }}>{icon}</span>
              {!collapsed && <span>{label}</span>}
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* ── Main area ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Topbar */}
        <header style={{
          height: 52, background: 'var(--surface)',
          borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center',
          padding: '0 20px', gap: 12, flexShrink: 0,
        }}>
          <button onClick={() => setCollapsed(c => !c)} style={{
            background: 'transparent', border: 'none',
            color: 'var(--muted)', fontSize: 18, padding: 4,
          }}>☰</button>
          <span style={{ color: 'var(--muted)', fontSize: 13 }}>
            Earthquake Risk Intelligence Platform
          </span>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%',
              background: 'var(--accent)', boxShadow: '0 0 6px var(--accent)' }} />
            <span style={{ color: 'var(--accent)', fontSize: 12, fontWeight: 600 }}>LIVE</span>
          </div>
        </header>

        {/* Page content */}
        <main style={{ flex: 1, overflow: 'auto', padding: 24 }}>
          <Routes>
            <Route path='/'         element={<Dashboard />} />
            <Route path='/cities'   element={<CityRiskAnalysis />} />
            <Route path='/explorer' element={<SeismicExplorer />} />
            <Route path='/heatmap'  element={<RiskHeatmap />} />
            <Route path='/safety'   element={<SafetyRecommendations />} />
            <Route path='/forecast' element={<Forecast />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}