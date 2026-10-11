import { CLASS_META, CLASS_ORDER } from '../engine/classify'

export function StatCard({ icon: Icon, color, label, value, sub, spark = [] }) {
  return (
    <div className="stat-card">
      <div className={`stat-icon ${color}`}>
        <Icon />
      </div>
      <div className="stat-info">
        <div className="label">{label}</div>
        <div className="value">{value}</div>
        <div className="sub">{sub}</div>
      </div>
      {spark.length > 1 && (
        <svg className="stat-spark" viewBox="0 0 100 30" preserveAspectRatio="none">
          <polyline
            fill="none"
            stroke="var(--accent)"
            strokeWidth="2"
            points={sparkPoints(spark)}
          />
          <polygon
            fill="var(--accent)"
            opacity="0.12"
            points={`0,30 ${sparkPoints(spark)} 100,30`}
          />
        </svg>
      )}
    </div>
  )
}

function sparkPoints(data) {
  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min || 1
  return data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * 100
      const y = 28 - ((v - min) / range) * 24
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
}

export function Sparkline({ data }) {
  return (
    <svg width="100%" height="30" viewBox="0 0 100 30" preserveAspectRatio="none">
      <polyline fill="none" stroke="var(--accent)" strokeWidth="2" points={sparkPoints(data)} />
    </svg>
  )
}

export function Donut({ counts, size = 150 }) {
  const total = CLASS_ORDER.reduce((s, k) => s + (counts[k] || 0), 0)
  const radius = 54
  const cx = size / 2
  const cy = size / 2
  const circumference = 2 * Math.PI * radius

  if (total === 0) {
    return (
      <div className="donut-box" style={{ width: size, height: size }}>
        <svg width={size} height={size}>
          <circle
            cx={cx} cy={cy} r={radius}
            fill="none" stroke="var(--track)" strokeWidth="16"
          />
        </svg>
        <div className="donut-center">
          <div className="sub">Total Moves</div>
          <div className="val">0</div>
        </div>
      </div>
    )
  }

  let offset = 0
  const segs = []
  for (const key of CLASS_ORDER) {
    const c = counts[key] || 0
    if (c === 0) continue
    const frac = c / total
    const len = frac * circumference
    segs.push(
      <circle
        key={key}
        cx={cx} cy={cy} r={radius}
        fill="none"
        stroke={CLASS_META[key].color}
        strokeWidth="16"
        strokeDasharray={`${len} ${circumference - len}`}
        strokeDashoffset={-offset}
        transform={`rotate(-90 ${cx} ${cy})`}
      />
    )
    offset += len
  }

  return (
    <div className="donut-box" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle cx={cx} cy={cy} r={radius} fill="none" stroke="var(--track)" strokeWidth="16" />
        {segs}
      </svg>
      <div className="donut-center">
        <div className="sub">Total Moves</div>
        <div className="val">{total}</div>
      </div>
    </div>
  )
}

export function QualityLegend({ counts }) {
  const total = CLASS_ORDER.reduce((s, k) => s + (counts[k] || 0), 0)
  return (
    <div className="legend">
      {CLASS_ORDER.map((key) => {
        const c = counts[key] || 0
        const pct = total > 0 ? ((c / total) * 100).toFixed(1) : '0.0'
        return (
          <div className="legend-item" key={key}>
            <span className="legend-dot" style={{ background: CLASS_META[key].color }} />
            <span className="legend-name">{CLASS_META[key].label}</span>
            <span className="legend-count">{c}</span>
            <span className="legend-pct">({pct}%)</span>
          </div>
        )
      })}
    </div>
  )
}

export function ClassificationPanel({ counts }) {
  const shown = ['brilliant', 'great', 'best', 'excellent', 'good', 'book', 'inaccuracy', 'mistake', 'blunder']
  return (
    <div className="class-grid">
      {shown.map((key) => (
        <div className="class-row" key={key}>
          <span className="icon" style={{ background: CLASS_META[key].color }}>
            {CLASS_META[key].symbol}
          </span>
          <span className="nm">{CLASS_META[key].label}</span>
          <span className="ct">{counts[key] || 0}</span>
        </div>
      ))}
    </div>
  )
}
