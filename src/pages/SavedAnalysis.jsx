import { useMemo, useState, useEffect } from 'react'
import {
  Search, Eye, Star, Trash2, History, Swords
} from 'lucide-react'
import { Chess } from 'chess.js'
import { useStore } from '../store.jsx'
import { Board, MoveNav } from '../components/board'
import { MoveList } from '../components/panels'
import { ClassificationPanel } from '../components/charts'
import { formatDate } from '../utils/chessUtils'
import { countClassifications } from '../engine/classify'

const TABS = [
  { id: 'all', label: 'All' },
  { id: 'recent', label: 'Recently Added' },
  { id: 'favorites', label: 'Favorites' }
]

export function SavedAnalysis() {
  const { analyses, deleteAnalysis, toggleFavorite, prefs, showToast } = useStore()
  const [tab, setTab] = useState('all')
  const [query, setQuery] = useState('')
  const [viewing, setViewing] = useState(null)
  const [index, setIndex] = useState(0)

  const filtered = useMemo(() => {
    let list = [...analyses]
    if (tab === 'favorites') list = list.filter((a) => a.favorite)
    if (tab === 'recent') list = list.slice(0, 10)
    if (query.trim()) {
      const q = query.trim().toLowerCase()
      list = list.filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          (a.opening || '').toLowerCase().includes(q)
      )
    }
    return list
  }, [analyses, tab, query])

  const viewFen = useMemo(() => {
    if (!viewing) return null
    const c = new Chess()
    for (let i = 0; i < index && i < viewing.sans.length; i++) c.move(viewing.sans[i])
    return c.fen()
  }, [viewing, index])

  const viewCounts = viewing ? countClassifications(viewing.perMove) : {}

  useEffect(() => {
    setIndex(0)
  }, [viewing])

  return (
    <div className="content">
      <div className="card card-pad">
        <div className="header-row">
          <div className="section-title" style={{ marginBottom: 0 }}>
            <History /> Saved Analysis
          </div>
          <div className="search-box">
            <Search />
            <input
              placeholder="Search analysis..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="tabs">
          {TABS.map((t) => (
            <button
              key={t.id}
              className={`tab ${tab === t.id ? 'active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="empty-state">
            <History />
            <div>
              {analyses.length === 0
                ? 'Nothing saved yet. Analyze a game and hit “Save Analysis”.'
                : 'No results for this filter.'}
            </div>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Moves</th>
                  <th>Date Saved</th>
                  <th>Result</th>
                  <th>Top Accuracy</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <div className="row-title">
                        <span className="thumb"><i /><i /><i /><i /></span>
                        {a.name}
                      </div>
                    </td>
                    <td>{a.summary?.moveCount ?? a.sans?.length ?? '—'}</td>
                    <td className="muted small">{formatDate(a.date)}</td>
                    <td>{a.summary?.result}</td>
                    <td className="bold">{a.summary?.topAccuracy ?? '—'}%</td>
                    <td>
                      <div className="row-actions">
                        <button className="icon-btn" title="View" onClick={() => setViewing(a)}>
                          <Eye />
                        </button>
                        <button
                          className={`icon-btn ${a.favorite ? 'starred' : ''}`}
                          title="Favorite"
                          onClick={() => toggleFavorite(a.id)}
                        >
                          <Star fill={a.favorite ? 'currentColor' : 'none'} />
                        </button>
                        <button
                          className="icon-btn danger"
                          title="Delete"
                          onClick={() => {
                            deleteAnalysis(a.id)
                            showToast('Analysis deleted.')
                          }}
                        >
                          <Trash2 />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {viewing && (
        <div className="card card-pad">
          <div className="header-row">
            <div className="section-title" style={{ marginBottom: 0 }}>
              <Swords /> {viewing.name}
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => setViewing(null)}>
              Close viewer
            </button>
          </div>

          <div className="analysis-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <div>
              <Board
                fen={viewFen}
                orientation={prefs.orientation || 'white'}
              />
              <MoveNav
                index={index}
                total={viewing.sans.length}
                onFirst={() => setIndex(0)}
                onPrev={() => setIndex((i) => Math.max(0, i - 1))}
                onNext={() => setIndex((i) => Math.min(viewing.sans.length, i + 1))}
                onLast={() => setIndex(viewing.sans.length)}
                onJump={(n) => setIndex(n)}
              />
            </div>
            <div>
              <div className="pos-result mb-14">
                <div className="line">
                  <span className="k">Opening</span>
                  <span className="v">{viewing.opening || '—'}</span>
                </div>
                <div className="line">
                  <span className="k">Result</span>
                  <span className="v">{viewing.summary?.result}</span>
                </div>
                <div className="line">
                  <span className="k">Top accuracy</span>
                  <span className="v">{viewing.summary?.topAccuracy}%</span>
                </div>
                <div className="line">
                  <span className="k">Engine depth</span>
                  <span className="v">{viewing.depth || '—'}</span>
                </div>
              </div>
              <MoveList
                moves={viewing.perMove.map((m) => ({ san: m.san, classification: m.classification }))}
                index={index}
                onJump={(n) => setIndex(n)}
              />
            </div>
          </div>

          <div className="mt-14">
            <div className="section-title">Move Classification</div>
            <ClassificationPanel counts={viewCounts} />
          </div>
        </div>
      )}
    </div>
  )
}
