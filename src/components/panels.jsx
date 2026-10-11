import { Save, Sparkles } from 'lucide-react'
import { CLASS_META } from '../engine/classify'
import { formatEval } from '../engine/classify'

export function BestMovePanel({
  moveNo,
  playedSan,
  classification,
  evalCp,
  bestSan,
  explain,
  openingName,
  onSave,
  canSave,
  analyzed
}) {
  if (!analyzed) {
    return (
      <div className="card card-pad best-panel">
        <div className="section-title">
          <Sparkles />
          Engine
        </div>
        <div className="empty-state">
          <Sparkles />
          <div>Paste a PGN or upload a board photo, then run the analyzer to see the engine&apos;s verdict here.</div>
        </div>
      </div>
    )
  }

  const meta = classification ? CLASS_META[classification] : null

  return (
    <div className="card card-pad best-panel">
      <div className="best-head">
        <div className="best-move-label">
          {moveNo != null ? `${moveNo}. ` : ''}
          <span className="mono">{playedSan || '—'}</span>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {meta && (
            <span className="badge" style={{ background: meta.color, color: '#fff' }}>
              {meta.label}
            </span>
          )}
          <span className="eval-chip">{formatEval(evalCp)}</span>
        </div>
      </div>

      {openingName && (
        <div className="small muted bold">{openingName}</div>
      )}

      <p className="explain">{explain || 'No explanation available.'}</p>

      {bestSan && (
        <div className="small muted">
          Engine best: <strong className="mono" style={{ color: 'var(--accent)' }}>{bestSan}</strong>
        </div>
      )}

      <button className="btn btn-primary btn-block mt-10" onClick={onSave} disabled={!canSave}>
        <Save />
        Save Analysis
      </button>
    </div>
  )
}

export function MoveList({ moves, index, onJump }) {
  if (!moves || moves.length === 0) {
    return (
      <div className="empty-state small">
        Detected moves will appear here.
      </div>
    )
  }

  const cells = []
  for (let i = 0; i < moves.length; i++) {
    const m = moves[i]
    const num = Math.floor(i / 2) + 1
    const showNum = i % 2 === 0
    const meta = m.classification ? CLASS_META[m.classification] : null
    cells.push(
      <button
        key={i}
        className={`move-cell ${index === i + 1 ? 'active' : ''}`}
        onClick={() => onJump(i + 1)}
      >
        {showNum && <span className="move-num">{num}.</span>}
        {!showNum && <span className="move-num" />}
        {meta && <span className="dot" style={{ background: meta.color }} />}
        <span>{m.san}</span>
      </button>
    )
  }
  return <div className="move-list">{cells}</div>
}
