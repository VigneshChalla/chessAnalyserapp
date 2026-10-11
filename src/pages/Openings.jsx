import { useMemo, useState } from 'react'
import {
  BookOpen, Plus, Pencil, Trash2, Compass, X, Check
} from 'lucide-react'
import { useStore } from '../store.jsx'
import { OPENINGS, OPENING_COLORS, OPENING_ICONS } from '../data/openings'
import { uid } from '../utils/chessUtils'

export function Openings() {
  const { myOpenings, addOpening, updateOpening, deleteOpening, showToast } = useStore()
  const [tab, setTab] = useState('mine')
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState(null)

  const explore = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return OPENINGS
    return OPENINGS.filter(
      (o) =>
        o.name.toLowerCase().includes(q) ||
        o.eco.toLowerCase().includes(q) ||
        o.moves.toLowerCase().includes(q)
    )
  }, [query])

  function saveForm() {
    if (!editing) return
    if (!editing.name.trim() || !editing.moves.trim()) {
      showToast('Name and moves are required.', 'error')
      return
    }
    if (editing.isNew) {
      addOpening({
        id: uid(),
        name: editing.name.trim(),
        eco: editing.eco.trim() || '—',
        moves: editing.moves.trim(),
        desc: editing.desc?.trim() || '',
        color: editing.color || OPENING_COLORS[0],
        icon: editing.icon || OPENING_ICONS[0]
      })
      showToast('Opening saved.')
    } else {
      updateOpening(editing.id, {
        name: editing.name.trim(),
        eco: editing.eco.trim() || '—',
        moves: editing.moves.trim(),
        desc: editing.desc?.trim() || ''
      })
      showToast('Opening updated.')
    }
    setEditing(null)
  }

  return (
    <div className="content">
      <div className="card card-pad">
        <div className="header-row">
          <div className="section-title" style={{ marginBottom: 0 }}>
            <BookOpen /> Chess Openings
          </div>
          <div className="row-8">
            <div className="search-box">
              <SearchIcon />
              <input
                placeholder="Search openings..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <button
              className="btn btn-primary btn-sm"
              onClick={() =>
                setEditing({
                  isNew: true,
                  name: '',
                  eco: '',
                  moves: '',
                  desc: '',
                  color: OPENING_COLORS[Math.floor(Math.random() * OPENING_COLORS.length)],
                  icon: OPENING_ICONS[Math.floor(Math.random() * OPENING_ICONS.length)]
                })
              }
            >
              <Plus /> Add New Opening
            </button>
          </div>
        </div>

        <div className="tabs">
          <button className={`tab ${tab === 'mine' ? 'active' : ''}`} onClick={() => setTab('mine')}>
            My Openings
          </button>
          <button className={`tab ${tab === 'explore' ? 'active' : ''}`} onClick={() => setTab('explore')}>
            <Compass size={14} style={{ verticalAlign: -2 }} /> Explore Openings
          </button>
        </div>

        {tab === 'mine' ? (
          myOpenings.length === 0 ? (
            <div className="empty-state">
              <BookOpen />
              <div>You haven&apos;t saved any openings yet. Use “Add New Opening” or save lines from analysis.</div>
            </div>
          ) : (
            <div className="openings-grid">
              {myOpenings.map((o, i) => (
                <div className="opening-card" key={o.id}>
                  <div
                    className="opening-icon"
                    style={{ background: o.color || OPENING_COLORS[i % OPENING_COLORS.length] }}
                  >
                    {o.icon || OPENING_ICONS[i % OPENING_ICONS.length]}
                  </div>
                  <div className="opening-info">
                    <div className="nm">{o.name}</div>
                    <div className="meta">
                      {o.moves.split(/\s+/).filter(Boolean).length} moves · {o.eco}
                    </div>
                  </div>
                  <div className="opening-actions">
                    <button
                      className="icon-btn"
                      title="Edit"
                      onClick={() => setEditing({ ...o, isNew: false })}
                    >
                      <Pencil />
                    </button>
                    <button
                      className="icon-btn danger"
                      title="Delete"
                      onClick={() => {
                        deleteOpening(o.id)
                        showToast('Opening removed.')
                      }}
                    >
                      <Trash2 />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          <div className="openings-grid">
            {explore.map((o, i) => (
              <div className="opening-card" key={o.eco + o.name}>
                <div
                  className="opening-icon"
                  style={{ background: OPENING_COLORS[i % OPENING_COLORS.length] }}
                >
                  {OPENING_ICONS[i % OPENING_ICONS.length]}
                </div>
                <div className="opening-info">
                  <div className="nm">{o.name}</div>
                  <div className="meta">
                    {o.moves.split(/\s+/).length} moves · ECO {o.eco}
                  </div>
                  <div className="meta mono" style={{ marginTop: 3, fontSize: 11 }}>
                    {o.moves}
                  </div>
                </div>
                <div className="opening-actions">
                  <button
                    className="icon-btn"
                    title="Add to my openings"
                    onClick={() => {
                      addOpening({
                        id: uid(),
                        name: o.name,
                        eco: o.eco,
                        moves: o.moves,
                        desc: o.desc,
                        color: OPENING_COLORS[i % OPENING_COLORS.length],
                        icon: OPENING_ICONS[i % OPENING_ICONS.length]
                      })
                      showToast(`Added “${o.name}” to My Openings.`)
                    }}
                  >
                    <Plus />
                  </button>
                </div>
              </div>
            ))}
            {explore.length === 0 && (
              <div className="empty-state">No openings match that search.</div>
            )}
          </div>
        )}
      </div>

      {editing && (
        <div className="card card-pad">
          <div className="header-row">
            <div className="section-title" style={{ marginBottom: 0 }}>
              {editing.isNew ? <Plus /> : <Pencil />}
              {editing.isNew ? 'Add New Opening' : 'Edit Opening'}
            </div>
            <button className="icon-btn" onClick={() => setEditing(null)}><X /></button>
          </div>
          <div className="settings-grid">
            <div>
              <div className="field">
                <label>Name</label>
                <input
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  placeholder="e.g. Sicilian Defense"
                />
              </div>
              <div className="field">
                <label>ECO code</label>
                <input
                  value={editing.eco}
                  onChange={(e) => setEditing({ ...editing, eco: e.target.value })}
                  placeholder="B20"
                />
              </div>
            </div>
            <div>
              <div className="field">
                <label>Moves (SAN)</label>
                <input
                  value={editing.moves}
                  onChange={(e) => setEditing({ ...editing, moves: e.target.value })}
                  placeholder="e4 c5 Nf3 d6"
                />
              </div>
              <div className="field">
                <label>Description</label>
                <input
                  value={editing.desc || ''}
                  onChange={(e) => setEditing({ ...editing, desc: e.target.value })}
                  placeholder="Short note about the line"
                />
              </div>
            </div>
          </div>
          <div className="row-8 mt-10">
            <button className="btn btn-primary" onClick={saveForm}>
              <Check /> {editing.isNew ? 'Add Opening' : 'Save Changes'}
            </button>
            <button className="btn btn-ghost" onClick={() => setEditing(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function SearchIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  )
}
