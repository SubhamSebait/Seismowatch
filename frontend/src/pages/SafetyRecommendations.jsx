export default function SafetyRecommendations() {
  const zones = [
    {
      title: 'High Risk Zone Construction',
      level: 'HIGH RISK',
      color: '#ef4444',
      icon: '⚠️',
      desc: 'Critical earthquake-resistant measures for regions with frequent seismic activity (M6.0+).',
      items: [
        'Base isolation systems with rubber bearings',
        'Steel moment-resisting frames (SMRF)',
        'Reinforced concrete shear walls',
        'Cross-braced steel structures',
        'Tuned mass dampers for tall buildings',
        'Deep pile foundations to bedrock',
        'Seismic gap between adjacent buildings',
        'Emergency power and water systems',
      ]
    },
    {
      title: 'Medium Risk Zone Construction',
      level: 'MEDIUM RISK',
      color: '#eab308',
      icon: '🏢',
      desc: 'Recommended seismic provisions for areas with moderate earthquake probability.',
      items: [
        'Reinforced masonry with steel ties',
        'Confined masonry construction',
        'Lightweight roofing materials',
        'Proper wall-to-foundation connections',
        'Symmetric building plans to reduce torsion',
        'Regular structural inspections',
        'Retrofitting older structures',
        'Emergency exit planning',
      ]
    },
    {
      title: 'Low Risk Zone Construction',
      level: 'LOW RISK',
      color: '#22c55e',
      icon: '✅',
      desc: 'Basic seismic awareness and minimum code compliance for stable regions.',
      items: [
        'Standard building code compliance',
        'Proper concrete mix ratios',
        'Adequate rebar placement in foundations',
        'Non-structural element anchoring',
        'Emergency exit planning',
        'Annual safety audits',
        'Staff earthquake awareness training',
        'Basic emergency supply kits',
      ]
    },
  ]

  const tips = [
    { icon: '🏠', title: 'Secure Heavy Furniture',
      desc: 'Anchor bookshelves, water heaters, and heavy appliances to walls.' },
    { icon: '🎒', title: 'Emergency Kit',
      desc: 'Keep 72-hour supply of water (4L/person/day), food, flashlight, first aid.' },
    { icon: '📍', title: 'Safe Spots',
      desc: 'Identify safe spots in each room — under sturdy tables, against interior walls.' },
    { icon: '📞', title: 'Family Plan',
      desc: 'Establish meeting points and out-of-area contact person for your family.' },
    { icon: '🔌', title: 'Utility Shutoffs',
      desc: 'Know how to shut off gas, water, and electricity at main switches.' },
    { icon: '🏃', title: 'Drop Cover Hold',
      desc: 'During shaking: Drop, take Cover under sturdy furniture, Hold on until shaking stops.' },
  ]

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 4 }}>
          Safety & Construction Recommendations
        </h1>
        <p style={{ color: 'var(--muted)', fontSize: 13 }}>
          Earthquake-resistant building guidelines by risk zone
        </p>
      </div>

      {/* Zone cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)',
        gap: 16, marginBottom: 24 }}>
        {zones.map(z => (
          <div key={z.level} style={{
            background: 'var(--card)', border: `1px solid ${z.color}33`,
            borderRadius: 12, padding: 20,
            borderTop: `3px solid ${z.color}`,
          }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start',
              gap: 12, marginBottom: 12 }}>
              <div style={{
                width: 40, height: 40, borderRadius: 10,
                background: z.color + '22', display: 'flex',
                alignItems: 'center', justifyContent: 'center', fontSize: 20,
                flexShrink: 0,
              }}>{z.icon}</div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>
                  {z.title}
                </div>
                <span style={{
                  background: z.color + '22', color: z.color,
                  border: `1px solid ${z.color}44`,
                  borderRadius: 6, padding: '2px 10px',
                  fontSize: 11, fontWeight: 700,
                }}>{z.level}</span>
              </div>
            </div>

            <p style={{ color: 'var(--muted)', fontSize: 12,
              marginBottom: 16, lineHeight: 1.6 }}>{z.desc}</p>

            {/* Items */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {z.items.map((item, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <div style={{
                    width: 18, height: 18, borderRadius: '50%',
                    border: `1.5px solid ${z.color}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0, marginTop: 1,
                  }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%',
                      background: z.color }} />
                  </div>
                  <span style={{ fontSize: 13, lineHeight: 1.5 }}>{item}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Personal safety tips */}
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)',
        borderRadius: 12, padding: 20 }}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>
          🛡️ Personal Safety Tips
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
          {tips.map((t, i) => (
            <div key={i} style={{
              background: 'var(--surface)', borderRadius: 10, padding: 16,
              border: '1px solid var(--border)',
            }}>
              <div style={{ fontSize: 24, marginBottom: 8 }}>{t.icon}</div>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>{t.title}</div>
              <div style={{ color: 'var(--muted)', fontSize: 12, lineHeight: 1.6 }}>{t.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}